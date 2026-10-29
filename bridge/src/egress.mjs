import { collectEgress } from "./ocsf.mjs";

/** Builds flushEgress(sandbox): sends new OpenShell audit rows to the owner's privacy ledger. */
export function createEgressFlusher({ api, pool, cursors, cfg, log }) {
  return async function flushEgress(sandbox) {
    const since = cursors.data[sandbox] ?? Date.now() - 10 * 60_000;
    const { rows, cursor } = await collectEgress(sandbox, since);
    const owner = Object.entries(pool.assignments()).find(([, a]) => a.sandbox === sandbox)?.[0] ?? null;
    for (let i = 0; i < rows.length; i += 100) {
      await api.egress({ sandbox, userId: owner, policySha256: cfg.policySha256, rows: rows.slice(i, i + 100) });
    }
    cursors.data[sandbox] = cursor;
    cursors.save();
    if (rows.length) log("egress", sandbox, `${rows.length} rows`, `${rows.filter((r) => r.action === "Denied").length} denied`);
    return rows;
  };
}
