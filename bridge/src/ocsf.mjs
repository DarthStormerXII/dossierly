import { nemo } from "./shell.mjs";

const IGNORED = new Set(["inference.local", "host.openshell.internal"]);

/** Parses OpenShell OCSF JSON lines (class 4001 Network Activity, 4002 HTTP Activity) into ledger rows. */
export function parseOcsf(text, sinceMs) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("{")) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.class_uid !== 4001 && e.class_uid !== 4002) continue;
    const domain = e.dst_endpoint?.domain || e.http_request?.url?.hostname;
    if (!domain || IGNORED.has(domain) || !(e.time > sinceMs)) continue;
    const action = e.action === "Denied" || e.disposition === "Blocked" ? "Denied" : "Allowed";
    if (e.class_uid === 4002 && action === "Allowed") continue; // the 4001 connect row already records it
    rows.push({
      ts: e.time,
      domain,
      port: e.dst_endpoint?.port,
      action,
      method: e.http_request?.http_method,
      process: e.actor?.process?.name?.slice(0, 200),
      reason: action === "Denied" ? String(e.message ?? "").slice(0, 300) : undefined,
    });
  }
  // Collapse bursts: same domain + action + process within 3 s is one connection attempt.
  const out = [];
  for (const r of rows.sort((a, b) => a.ts - b.ts)) {
    const prev = out.findLast((p) => p.domain === r.domain && p.action === r.action && p.process === r.process);
    if (prev && r.ts - prev.ts < 3000) continue;
    out.push(r);
  }
  return out;
}

/** Reads the sandbox's own audit log (written because ocsf_json_enabled=true) and returns rows newer than the cursor. */
export async function collectEgress(name, sinceMs) {
  const r = await nemo([name, "exec", "--no-tty", "--timeout", "30", "--", "sh", "-c",
    "cat /var/log/openshell-ocsf.*.log 2>/dev/null | grep -E '\"class_uid\":400[12]' | tail -n 600"], { timeoutMs: 45_000 });
  if (r.code !== 0) return { rows: [], cursor: sinceMs };
  const rows = parseOcsf(r.stdout, sinceMs);
  const newest = r.stdout.split("\n").reduce((m, l) => { const t = /"time":(\d{13})/.exec(l); return t ? Math.max(m, Number(t[1])) : m; }, sinceMs);
  return { rows, cursor: newest };
}
