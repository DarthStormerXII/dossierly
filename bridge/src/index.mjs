import { createApi } from "./api.mjs";
import { loadConfig } from "./config.mjs";
import { createEgressFlusher } from "./egress.mjs";
import { createPool } from "./pool.mjs";
import { runTask } from "./runner.mjs";
import { nemo, sleep } from "./shell.mjs";
import { makeStore } from "./state.mjs";

const cfg = loadConfig();
const log = (...a) => process.stdout.write(`${new Date().toISOString()} ${a.join(" ")}\n`);
if (!cfg.secret) { log("BRIDGE_SECRET missing in ~/.settla/bridge.env"); process.exit(1); }

const api = createApi(cfg);
const pool = createPool(cfg, log);
const cursors = makeStore(cfg.stateDir, "ocsf-cursors.json", () => ({}));
let mask = null;
if (cfg.mask === "gliner") {
  try { mask = (await import("./mask.mjs")).createMasker(log); } catch (e) { log("masking disabled:", e.message); }
}

async function existingSandboxes() {
  const r = await nemo(["list", "--json"], { timeoutMs: 30_000 });
  try { return new Set(JSON.parse(r.stdout).sandboxes.map((s) => s.name)); } catch { return new Set(pool.allNames()); }
}

const flushEgress = createEgressFlusher({ api, pool, cursors, cfg, log });

const active = new Set();
let stopping = false;

async function handle(task) {
  log("claimed", task.id, task.kind, "user", task.userId.slice(0, 8));
  const out = await runTask(task, { cfg, pool, mask }, log);
  try {
    await api.result(out.payload);
    log(out.payload.ok ? "done" : "failed", task.id, `${out.payload.durationMs}ms`, out.sandbox ?? "");
  } catch (e) {
    log("could not post result", task.id, e.message);
  } finally {
    out.release?.();
  }
  if (out.sandbox) await flushEgress(out.sandbox).catch((e) => log("egress flush failed", e.message));
}

async function main() {
  const exists = await existingSandboxes();
  const known = pool.allNames().filter((n) => exists.has(n));
  log("bridge up", cfg.url, `sandboxes ${known.length}/${pool.allNames().length}`, `policy ${cfg.policySha256?.slice(0, 12) ?? "?"}`);
  let backoff = cfg.pollMs;
  let lastSweep = Date.now();
  while (!stopping) {
    try {
      while (active.size < cfg.maxConcurrent && !stopping) {
        const task = await api.next(known.length);
        backoff = cfg.pollMs;
        if (!task) break;
        const p = handle(task).finally(() => active.delete(p));
        active.add(p);
      }
    } catch (e) {
      log("poll failed:", e.message);
      backoff = Math.min(backoff * 2, 30_000);
    }
    if (Date.now() - lastSweep > 60_000) {
      lastSweep = Date.now();
      pool.stopIdle(flushEgress).then((s) => s.length && log("stopped idle", s.join(","))).catch((e) => log("idle sweep failed", e.message));
    }
    await sleep(backoff);
  }
  await Promise.allSettled([...active]);
}

for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { stopping = true; });
await main();
