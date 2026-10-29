// Operator tools. Usage:
//   node bridge/src/cli.mjs probe <sandbox> <https-url>   try a request from inside a sandbox and flush its audit rows
//   node bridge/src/cli.mjs flush <sandbox>               send pending audit rows to the ledger
//   node bridge/src/cli.mjs pool                          show assignments
import { createApi } from "./api.mjs";
import { loadConfig } from "./config.mjs";
import { createEgressFlusher } from "./egress.mjs";
import { createPool } from "./pool.mjs";
import { nemo } from "./shell.mjs";
import { makeStore } from "./state.mjs";

const cfg = loadConfig();
const log = (...a) => process.stdout.write(`${a.join(" ")}\n`);
const pool = createPool(cfg, log);
const flush = createEgressFlusher({ api: createApi(cfg), pool, cursors: makeStore(cfg.stateDir, "ocsf-cursors.json", () => ({})), cfg, log });
const [cmd, sandbox, url] = process.argv.slice(2);

if (cmd === "probe" && sandbox && url) {
  await pool.ensureRunning(sandbox);
  const r = await nemo([sandbox, "exec", "--no-tty", "--timeout", "30", "--", "curl", "-s", "-m", "15", "-o", "/dev/null", "-w", "%{http_code}", url], { timeoutMs: 60_000 });
  log(`curl ${url} inside ${sandbox}: http ${r.stdout.trim() || "none"} (000 or 403 means blocked)`);
  const rows = await flush(sandbox);
  log(JSON.stringify(rows.filter((x) => x.domain.includes(new URL(url).hostname))));
} else if (cmd === "flush" && sandbox) {
  log(`${(await flush(sandbox)).length} rows sent`);
} else if (cmd === "pool") {
  log(JSON.stringify(pool.store.data, null, 2));
} else {
  log("usage: cli.mjs probe <sandbox> <url> | flush <sandbox> | pool");
  process.exitCode = 1;
}
