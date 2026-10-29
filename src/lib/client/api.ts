import type {
  AgentTask, Case, CaseEvent, Interpretation, Intro, Language, Ledger, Letter, LetterLink, LetterRead, Me, Plan,
  Product, Status, TurnInput, WatchResult, WrapResult,
} from "./types";

export type ApiFailure = { ok: false; status: number; error: string; code?: string };
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

/** Codes the UI reacts to: pay-walls route to pricing, rate limits get a calm retry message. */
export const needsPlan = (f: ApiFailure) => f.status === 402 || f.status === 403;
export const isRateLimited = (f: ApiFailure) => f.status === 429 || f.code === "rate_limited";

export function friendlyError(f: ApiFailure): string {
  if (isRateLimited(f)) return "Lots of requests just now. Wait a few seconds and try again.";
  if (needsPlan(f)) return "This needs a Case Pass or credits.";
  if (f.status === 0) return "You seem to be offline. Check the connection and try again.";
  if (f.code === "over_budget") return "Today's live model budget is used up; showing a recorded answer instead.";
  return f.error || "Something went wrong. Try again.";
}

let sessionPromise: Promise<ApiResult<Me>> | null = null;

async function raw<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    return { ok: false, status: 0, error: "Network unavailable", code: "offline" };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok) return { ok: true, data: body as T };
  const b = (body ?? {}) as { error?: string; code?: string };
  return { ok: false, status: res.status, error: b.error ?? `Request failed (${res.status})`, code: b.code };
}

/** Idempotent: the server reuses a valid cookie. Concurrent callers share one request. */
export function ensureSession(): Promise<ApiResult<Me>> {
  if (!sessionPromise) {
    sessionPromise = raw<Me>("/api/session", { method: "POST" }).then((r) => {
      if (!r.ok) sessionPromise = null;
      return r;
    });
  }
  return sessionPromise;
}

/** Switches identity: {sample:true} joins the shared SAMPLE user, {sample:false} creates a fresh private user. */
export async function startSession(sample: boolean): Promise<ApiResult<Me>> {
  const r = await raw<Me>("/api/session", { method: "POST", body: JSON.stringify({ sample }) });
  sessionPromise = r.ok ? Promise.resolve(r) : null;
  return r;
}

/** Sandbox names are internal ids; show only the pool slot (e.g. "pool-03"). */
export function sandboxLabel(name?: string | null): string {
  if (!name) return "";
  return name.replace(/^settla[-_]?/i, "").replace(/^companion-arjun$/, "sample agent");
}

/** Fetch with typed results; a missing session is created once and the call retried. */
export async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const first = await raw<T>(path, init);
  if (first.ok || first.status !== 401 || first.code !== "no_session") return first;
  sessionPromise = null;
  const s = await ensureSession();
  if (!s.ok) return s;
  return raw<T>(path, init);
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

const maskProfile = (c: Case) => ({ name: c.profile.name, addresses: c.profile.addresses ?? [] });

export const api = {
  me: () => call<Me>("/api/me"),
  status: () => call<Status>("/api/status"),
  ledger: () => call<Ledger>("/api/ledger?limit=200"),
  intro: (name: string, language: Language, office: string) => post<Intro>("/api/intro", { name, language, office }),
  interpret: (c: Case, speaker: "user" | "official", text: string, recent: TurnInput[]) =>
    post<Interpretation>("/api/interpret", { speaker, text, language: c.profile.language, recent: recent.slice(-8), profile: maskProfile(c) }),
  watch: (c: Case, turns: TurnInput[]) =>
    post<WatchResult>("/api/watch", { turns: turns.slice(-12), language: c.profile.language, office: c.office, profile: maskProfile(c) }),
  wrap: (c: Case, turns: TurnInput[]) =>
    post<WrapResult>("/api/wrap", { turns: turns.slice(-80), language: c.profile.language, office: c.office, profile: maskProfile(c) }),
  readLetter: (pages: string[], language: Language) => post<LetterRead>("/api/letters/read", { pages, language }),
  linkLetter: (c: Case, letter: Letter, deliveryDate: string) =>
    post<LetterLink>("/api/letters/link", { letter, deliveryDate, case: c, language: c.profile.language }),
  prepare: (c: Case, appointment: { office: string; purpose: string; date: string }) =>
    post<{ taskId: string; retrieval?: string; masked?: number }>("/api/prepare", { appointment, case: c, language: c.profile.language }),
  fileEvent: (c: Case, event: CaseEvent) => post<{ taskId: string }>("/api/agent/file", { event, case: c }),
  reminder: (date: string, label: string) => post<unknown>("/api/me/deadlines", { date, label: label.slice(0, 120) }),
  task: <R>(id: string) => call<AgentTask<R>>(`/api/agent/tasks/${encodeURIComponent(id)}`),
  hubChanges: () => call<{ changes: { title: string; summary: string; url: string; detectedAt: string }[] }>("/api/hub/changes?country=pl"),
  checkout: (product: Product, code?: string) => post<{ checkoutUrl: string }>("/api/checkout", code ? { product, code } : { product }),
  redeem: (code: string) => post<{ plan: Plan }>("/api/redeem", { code }),
};

/** Polls an agent task until done/failed, reporting every snapshot. Stops when `signal` aborts. */
export async function pollTask<R>(
  id: string,
  onUpdate: (t: AgentTask<R>) => void,
  signal: AbortSignal,
  intervalMs = 1200,
): Promise<ApiResult<AgentTask<R>>> {
  for (let i = 0; i < 150 && !signal.aborted; i++) {
    const r = await api.task<R>(id);
    if (!r.ok) {
      if (isRateLimited(r) || r.status === 0) {
        await wait(intervalMs * 2, signal);
        continue;
      }
      return r;
    }
    onUpdate(r.data);
    if (r.data.status === "done" || r.data.status === "failed") return r;
    await wait(intervalMs, signal);
  }
  return { ok: false, status: 408, error: "The agent is taking longer than expected.", code: "timeout" };
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });
