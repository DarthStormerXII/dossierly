import assert from "node:assert/strict";
import { test } from "node:test";
import { createAsrLoop } from "../src/asr.mjs";

const cfg = { url: "https://app.example", secret: "s3cret" };
const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const setup = (handler) => {
  const calls = [];
  const logs = [];
  const fetchImpl = async (url, init = {}) => { calls.push({ url: String(url), init }); return handler(String(url), init, calls); };
  return { calls, logs, loop: createAsrLoop(cfg, (...a) => logs.push(a.join(" ")), { fetchImpl, intervalMs: 1, errorMs: 1, warmMs: 0 }) };
};
const wav = Buffer.from("RIFFfakewavbytes").toString("base64");

test("204 means idle and posts nothing", async () => {
  const { loop, calls } = setup(() => json(204));
  assert.equal(await loop.tick(), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["x-bridge-secret"], "s3cret");
});

test("a job is decoded, transcribed locally and the result posted without leaking text to logs", async () => {
  const { loop, calls, logs } = setup((url) => {
    if (url.endsWith("/asr-next")) return json(200, { id: "a1", lang: "pl", audio: wav });
    if (url.includes("127.0.0.1:8091/transcribe")) return json(200, { text: "Dzień dobry", ms: 321 });
    return json(200, { ok: true });
  });
  assert.equal(await loop.tick(), true);
  const local = calls[1];
  assert.equal(Buffer.from(local.init.body).toString(), "RIFFfakewavbytes");
  const posted = JSON.parse(calls[2].init.body);
  assert.equal(calls[2].url, "https://app.example/api/bridge/asr-result");
  assert.deepEqual(posted, { id: "a1", ok: true, text: "Dzień dobry", ms: 321, model: "nvidia/parakeet-tdt-0.6b-v3" });
  assert.ok(!logs.join("\n").includes("Dzień"));
});

test("bad audio (400) or a down local server reports ok:false", async () => {
  let mode = "bad";
  const { loop, calls } = setup((url) => {
    if (url.endsWith("/asr-next")) return json(200, { id: "a2", lang: "en", audio: wav });
    if (url.includes("8091")) { if (mode === "down") throw new TypeError("fetch failed"); return json(400, { error: "not a decodable WAV" }); }
    return json(200, {});
  });
  await loop.tick();
  let posted = JSON.parse(calls.at(-1).init.body);
  assert.equal(posted.ok, false);
  assert.equal(posted.error, "not a decodable WAV");
  mode = "down";
  await loop.tick();
  posted = JSON.parse(calls.at(-1).init.body);
  assert.equal(posted.ok, false);
  assert.match(posted.error, /asr unavailable/);
});

test("run tolerates 404 from the Worker, logs once, keeps polling, and stops", async () => {
  let polls = 0;
  const { loop, logs } = setup(() => { polls++; if (polls > 4) loop.stop(); return json(404, { error: "x" }); });
  await loop.run();
  assert.ok(polls >= 4);
  assert.equal(logs.filter((l) => l.includes("asr poll failed")).length, 1);
});

test("translate job also calls Canary and returns translation; a Canary failure keeps the transcript", async () => {
  let canaryDown = false;
  const { loop, calls } = setup((url) => {
    if (url.endsWith("/asr-next")) return json(200, { id: "a3", lang: "pl", translate: "en", audio: wav });
    if (url.includes("8091")) return json(200, { text: "Dzień dobry", ms: 200 });
    if (url.includes("8092/translate?src=pl&tgt=en")) { if (canaryDown) throw new TypeError("fetch failed"); return json(200, { text: "Good morning", ms: 700 }); }
    return json(200, {});
  });
  await loop.tick();
  let posted = JSON.parse(calls.at(-1).init.body);
  assert.equal(posted.text, "Dzień dobry");
  assert.equal(posted.translation, "Good morning");
  assert.equal(posted.translationModel, "nvidia/canary-1b-v2");
  canaryDown = true;
  await loop.tick();
  posted = JSON.parse(calls.at(-1).init.body);
  assert.equal(posted.ok, true);
  assert.equal(posted.translation, undefined);
});
