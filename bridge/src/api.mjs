import { sleep } from "./shell.mjs";

/** Outbound-only client for the Worker's /api/bridge/* routes. */
export function createApi(cfg) {
  async function call(path, { method = "GET", body, sandboxes } = {}) {
    const res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: {
        "x-bridge-secret": cfg.secret,
        "content-type": "application/json",
        ...(sandboxes !== undefined ? { "x-bridge-sandboxes": String(sandboxes) } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
    return res.json();
  }
  async function retry(fn, tries = 4) {
    let last;
    for (let i = 0; i < tries; i++) {
      try { return await fn(); } catch (e) { last = e; await sleep(500 * 2 ** i); }
    }
    throw last;
  }
  return {
    next: async (sandboxes) => (await call("/api/bridge/next", { sandboxes })).task,
    result: (payload) => retry(() => call("/api/bridge/result", { method: "POST", body: payload })),
    egress: (payload) => retry(() => call("/api/bridge/egress", { method: "POST", body: payload })),
  };
}
