import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { addTimelineLine, extractJson } from "../src/json.mjs";
import { parseOcsf } from "../src/ocsf.mjs";
import { createPool } from "../src/pool.mjs";

const cfgFor = () => ({
  stateDir: mkdtempSync(join(tmpdir(), "settla-pool-")),
  sampleUserId: "sample-arjun", sampleSandbox: "companion-arjun",
  poolNames: ["settla-pool-01", "settla-pool-02"], idleStopMs: 15 * 60_000,
});
const container = (n) => `openshell-default--${n}-5942dce5-8f4a-4e8a-ba9b-bdede86a894f`;
function fakeIo(runningNames) {
  const calls = [];
  return {
    calls,
    docker: async () => ({ code: 0, stdout: runningNames.map(container).join("\n"), stderr: "" }),
    nemo: async (args) => { calls.push(args.join(" ")); if (args[1] === "start") runningNames.push(args[0]); return { code: 0, stdout: "", stderr: "" }; },
  };
}

test("pool assigns free sandboxes, keeps users stable, pins the sample", async () => {
  const pool = createPool(cfgFor(), () => {}, fakeIo(["companion-arjun", "settla-pool-01", "settla-pool-02"]));
  assert.equal(pool.sandboxOf("sample-arjun"), "companion-arjun");
  const a = await pool.acquire("u1"); a.release();
  const b = await pool.acquire("u2"); b.release();
  assert.deepEqual([a.sandbox, b.sandbox], ["settla-pool-01", "settla-pool-02"]);
  const again = await pool.acquire("u1"); again.release();
  assert.equal(again.sandbox, "settla-pool-01");
  assert.equal(again.fresh, false);
});

test("pool recycles the least recently used non-sample sandbox after wiping it", async () => {
  const io = fakeIo(["companion-arjun", "settla-pool-01", "settla-pool-02"]);
  const pool = createPool(cfgFor(), () => {}, io);
  (await pool.acquire("u1")).release();
  await new Promise((r) => setTimeout(r, 5));
  (await pool.acquire("u2")).release();
  await new Promise((r) => setTimeout(r, 5));
  (await pool.acquire("u1")).release(); // u2 is now least recently used
  await new Promise((r) => setTimeout(r, 5));
  const c = await pool.acquire("u3"); c.release();
  assert.equal(c.sandbox, "settla-pool-02");
  assert.equal(c.recycledFrom, "u2");
  assert.ok(io.calls.some((x) => x.startsWith("settla-pool-02 exec") && x.includes("rm -rf /sandbox/case.md")));
  assert.equal(pool.sandboxOf("u2"), undefined);
  assert.equal(pool.sandboxOf("sample-arjun"), "companion-arjun");
});

test("pool never recycles a busy sandbox and starts stopped ones on demand", async () => {
  const io = fakeIo(["companion-arjun"]);
  const pool = createPool(cfgFor(), () => {}, io);
  const a = await pool.acquire("u1");
  const b = await pool.acquire("u2");
  await assert.rejects(pool.acquire("u3"), /busy/);
  assert.ok(io.calls.includes("settla-pool-01 start"));
  a.release(); b.release();
});

test("pool stops pool sandboxes idle for 15 minutes but never the sample, busy or recent ones", async () => {
  const io = fakeIo(["companion-arjun", "settla-pool-01", "settla-pool-02"]);
  const pool = createPool(cfgFor(), () => {}, io);
  const a = await pool.acquire("u1");
  const flushed = [];
  assert.deepEqual(await pool.stopIdle(async (n) => flushed.push(n), Date.now() + 16 * 60_000), ["settla-pool-02"]);
  assert.deepEqual(flushed, ["settla-pool-02"]);
  assert.deepEqual(await pool.stopIdle(null, Date.now() + 60_000), []);
  a.release();
});

test("parseOcsf maps OpenShell network rows to Allowed/Denied ledger rows", () => {
  const line = (o) => JSON.stringify(o);
  const base = { category_uid: 4, time: 2000 };
  const text = [
    line({ ...base, class_uid: 4001, action: "Allowed", dst_endpoint: { domain: "api.tokenfactory.nebius.com", port: 443 }, actor: { process: { name: "/opt/venv/bin/python3" } } }),
    line({ ...base, time: 2500, class_uid: 4001, action: "Allowed", dst_endpoint: { domain: "api.tokenfactory.nebius.com", port: 443 }, actor: { process: { name: "/opt/venv/bin/python3" } } }),
    line({ ...base, time: 3000, class_uid: 4001, action: "Denied", message: "CONNECT denied example.com:443", dst_endpoint: { domain: "example.com", port: 443 }, actor: { process: { name: "/usr/bin/curl" } } }),
    line({ ...base, time: 3100, class_uid: 4002, action: "Allowed", dst_endpoint: { domain: "api.tokenfactory.nebius.com" }, http_request: { http_method: "POST" } }),
    line({ ...base, time: 3200, class_uid: 4001, action: "Allowed", message: "ssh relay open" }),
    line({ ...base, time: 100, class_uid: 4001, action: "Allowed", dst_endpoint: { domain: "old.example", port: 443 } }),
    "not json",
  ].join("\n");
  const rows = parseOcsf(text, 1000);
  assert.deepEqual(rows.map((r) => [r.domain, r.action]), [["api.tokenfactory.nebius.com", "Allowed"], ["example.com", "Denied"]]);
  assert.match(rows[1].reason, /denied/);
});

test("extractJson tolerates reasoning blocks and fences; addTimelineLine keeps order", () => {
  assert.deepEqual(extractJson("<think>hmm {x}</think>```json\n{\"a\":1}\n```"), { a: 1 });
  assert.throws(() => extractJson("no object here"));
  const md = "# Case\n\n**Timeline:**\n- 18 Sep: fingerprints\n\n**Deadline:** none\n";
  assert.match(addTimelineLine(md, "- 5 Nov: wrap-up"), /- 18 Sep: fingerprints\n- 5 Nov: wrap-up\n\n\*\*Deadline/);
});
