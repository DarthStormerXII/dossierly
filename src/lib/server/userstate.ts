/** Logic behind UserDO, storage-agnostic so it also backs the in-memory local stub and tests. */
export interface StateStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  setAlarm(at: number): Promise<void>;
}

export type Deadline = { date: string; label: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DEADLINES = 50;

type Window = { start: number; count: number };

export class UserState {
  constructor(private store: StateStorage, private now: () => number = Date.now) {}

  async rateLimit(key: string, limit: number, windowSec: number) {
    const k = `rl:${key}`;
    const t = this.now();
    const w = (await this.store.get<Window>(k)) ?? { start: t, count: 0 };
    if (t - w.start >= windowSec * 1000) {
      w.start = t;
      w.count = 0;
    }
    if (w.count >= limit) return { ok: false, remaining: 0, retryAfterSec: Math.ceil((w.start + windowSec * 1000 - t) / 1000) };
    w.count += 1;
    await this.store.put(k, w);
    return { ok: true, remaining: limit - w.count, retryAfterSec: 0 };
  }

  async getEntitlement() {
    const hit = await this.store.get<{ value: unknown; exp: number }>("ent");
    return hit && hit.exp > this.now() ? hit.value : null;
  }

  async setEntitlement(value: unknown, ttlSec = 60) {
    await this.store.put("ent", { value, exp: this.now() + ttlSec * 1000 });
  }

  async listDeadlines(): Promise<Deadline[]> {
    return (await this.store.get<Deadline[]>("deadlines")) ?? [];
  }

  /** Stores only {date, label}; schedules the alarm for the next upcoming date. */
  async addDeadline(d: Deadline): Promise<Deadline[]> {
    if (!DATE.test(d.date)) throw new Error("date must be YYYY-MM-DD");
    const list = (await this.listDeadlines()).filter((x) => !(x.date === d.date && x.label === d.label));
    list.push({ date: d.date, label: d.label.slice(0, 120) });
    list.sort((a, b) => a.date.localeCompare(b.date));
    const trimmed = list.slice(-MAX_DEADLINES);
    await this.store.put("deadlines", trimmed);
    await this.scheduleNext(trimmed);
    return trimmed;
  }

  /** Alarm fired: move everything due to `due`, then reschedule. */
  async onAlarm(): Promise<void> {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    const list = await this.listDeadlines();
    const due = list.filter((d) => d.date <= today);
    const rest = list.filter((d) => d.date > today);
    if (due.length) {
      const fired = (await this.store.get<Deadline[]>("due")) ?? [];
      await this.store.put("due", [...fired, ...due].slice(-MAX_DEADLINES));
    }
    await this.store.put("deadlines", rest);
    await this.scheduleNext(rest);
  }

  async listDue(): Promise<Deadline[]> {
    return (await this.store.get<Deadline[]>("due")) ?? [];
  }

  private async scheduleNext(list: Deadline[]) {
    const next = list[0];
    if (!next) return;
    const at = Date.parse(`${next.date}T07:00:00Z`);
    await this.store.setAlarm(Math.max(at, this.now() + 1000));
  }
}

/** Request router shared by the DO class and the local stub. */
export async function handleUserRequest(state: UserState, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  switch (url.pathname) {
    case "/rate":
      return Response.json(await state.rateLimit(String(body.key), Number(body.limit), Number(body.windowSec)));
    case "/entitlement":
      if (req.method === "POST") {
        await state.setEntitlement(body.value, Number(body.ttlSec ?? 60));
        return Response.json({ ok: true });
      }
      return Response.json({ value: await state.getEntitlement() });
    case "/deadlines":
      if (req.method === "POST") {
        return Response.json({ deadlines: await state.addDeadline({ date: String(body.date), label: String(body.label ?? "") }) });
      }
      return Response.json({ deadlines: await state.listDeadlines(), due: await state.listDue() });
    default:
      return Response.json({ error: "Not found" }, { status: 404 });
  }
}
