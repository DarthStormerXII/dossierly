import { docker, nemo, sleep } from "./shell.mjs";
import { makeStore } from "./state.mjs";

const CONTAINER_RE = /^openshell-default--(.+?)-[0-9a-f]{8}-[0-9a-f]{4}-/;

/**
 * Sandbox pool: userId -> sandbox, persisted in ~/.settla/assignments.json.
 * The sample person is pinned to the sample sandbox and is never recycled. When every pool sandbox
 * is taken, the least recently used non-sample, non-busy one is wiped and reassigned: its previous
 * owner loses the agent's memory (the case itself lives on the person's device and is re-sent).
 */
export function createPool(cfg, log = () => {}, io = { nemo, docker }) {
  const store = makeStore(cfg.stateDir, "assignments.json", () => ({ version: 1, assignments: {}, recycled: [] }));
  const d = store.data;
  d.assignments[cfg.sampleUserId] ??= { sandbox: cfg.sampleSandbox, pinned: true, assignedAt: Date.now(), lastUsed: 0 };
  store.save();
  const busy = new Map();
  const used = new Map(); // sandbox -> last use (ms); a fresh bridge counts as "just used"
  const booted = Date.now();
  const lastUsed = (name) => used.get(name) ?? Math.max(booted, ...Object.values(d.assignments).filter((a) => a.sandbox === name).map((a) => a.lastUsed ?? 0));
  let chain = Promise.resolve();
  const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

  const ownerOf = (sandbox) => Object.entries(d.assignments).find(([, a]) => a.sandbox === sandbox)?.[0];
  const allNames = () => [cfg.sampleSandbox, ...cfg.poolNames];

  async function running() {
    const r = await io.docker(["ps", "--format", "{{.Names}}"], { timeoutMs: 20_000 });
    return new Set(r.stdout.split("\n").map((n) => CONTAINER_RE.exec(n.trim())?.[1]).filter(Boolean));
  }

  async function ensureRunning(name) {
    if ((await running()).has(name)) return false;
    const r = await io.nemo([name, "start"], { timeoutMs: 120_000 });
    if (r.code !== 0) throw new Error(`could not start sandbox ${name}`);
    for (let i = 0; i < 10; i++) {
      const p = await io.nemo([name, "exec", "--no-tty", "--timeout", "15", "--", "true"], { timeoutMs: 30_000 });
      if (p.code === 0) return true;
      await sleep(1000);
    }
    return true;
  }

  async function wipe(name) {
    await ensureRunning(name);
    const r = await io.nemo([name, "exec", "--no-tty", "--timeout", "60", "--", "sh", "-c",
      "rm -rf /sandbox/case.md /sandbox/task /sandbox/.deepagents/conversation_history/* /tmp/dcode-artifacts-* 2>/dev/null; true"], { timeoutMs: 90_000 });
    if (r.code !== 0) throw new Error(`could not wipe ${name}`);
  }

  async function assign(userId) {
    const now = Date.now();
    const existing = d.assignments[userId];
    if (existing) {
      existing.lastUsed = now;
      store.save();
      return { sandbox: existing.sandbox, fresh: false };
    }
    const taken = new Set(Object.values(d.assignments).map((a) => a.sandbox));
    const free = cfg.poolNames.find((n) => !taken.has(n));
    let recycledFrom;
    let sandbox = free;
    if (!sandbox) {
      const candidates = cfg.poolNames.filter((n) => !busy.get(n) && !d.assignments[ownerOf(n)]?.pinned);
      if (candidates.length === 0) throw new Error("every sandbox is busy; try again shortly");
      sandbox = candidates.sort((a, b) => lastUsed(a) - lastUsed(b))[0];
      recycledFrom = ownerOf(sandbox);
      await wipe(sandbox);
      delete d.assignments[recycledFrom];
      d.recycled.push({ sandbox, userId: recycledFrom, at: now });
      d.recycled = d.recycled.slice(-100);
      log("recycled", sandbox, "from a least-recently-used user");
    }
    d.assignments[userId] = { sandbox, pinned: false, assignedAt: now, lastUsed: now };
    store.save();
    return { sandbox, fresh: true, recycledFrom };
  }

  return {
    store,
    allNames,
    running,
    ensureRunning,
    wipe,
    /** Returns the user's sandbox, running, with a lease held until release(). */
    acquire: (userId) => serial(async () => {
      const a = await assign(userId);
      busy.set(a.sandbox, (busy.get(a.sandbox) ?? 0) + 1);
      try {
        const started = await ensureRunning(a.sandbox);
        return { ...a, started, release: () => { busy.set(a.sandbox, Math.max(0, (busy.get(a.sandbox) ?? 1) - 1)); used.set(a.sandbox, Date.now()); } };
      } catch (err) {
        busy.set(a.sandbox, Math.max(0, (busy.get(a.sandbox) ?? 1) - 1));
        throw err;
      }
    }),
    /** Stops sandboxes idle longer than idleStopMs. onBeforeStop lets the caller flush audit rows first. */
    async stopIdle(onBeforeStop, now = Date.now()) {
      const up = await running();
      const stopped = [];
      for (const name of allNames()) {
        // The shared sample agent stays warm (about 25 MB idle) so a visitor never waits for a cold start.
        if (name === cfg.sampleSandbox) continue;
        if (!up.has(name) || busy.get(name) || now - lastUsed(name) < cfg.idleStopMs) continue;
        try { await onBeforeStop?.(name); } catch { /* flushing is best effort */ }
        const r = await io.nemo([name, "stop"], { timeoutMs: 60_000 });
        if (r.code === 0) stopped.push(name);
      }
      return stopped;
    },
    stats: () => ({ users: Object.keys(d.assignments).length, busy: [...busy].filter(([, n]) => n > 0).map(([k]) => k) }),
    assignments: () => d.assignments,
    sandboxOf: (userId) => d.assignments[userId]?.sandbox,
  };
}
