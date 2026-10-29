import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./shell.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = join(homedir(), ".settla/venv/bin/python");

/** Free-text fields of a task input that can carry personal data. Structured identity fields stay as the agent needs them. */
function slots(input) {
  const out = [];
  const push = (obj, key) => { if (obj && typeof obj[key] === "string" && obj[key].length > 3) out.push([obj, key]); };
  push(input, "question");
  push(input.event, "summary");
  push(input.event, "title");
  push(input.appointment, "purpose");
  for (const e of input.case?.events ?? []) { push(e, "summary"); push(e, "title"); }
  for (const d of input.case?.deadlines ?? []) push(d, "what");
  return out;
}

/** GLiNER-PII (nvidia/gliner-PII) on CPU, run on the M2 itself: names, addresses, phones, ids are replaced with tags before the agent sees the text. */
export function createMasker(log) {
  return async function mask(input) {
    const copy = structuredClone(input);
    const s = slots(copy);
    if (s.length === 0) return { input: copy, count: 0 };
    const t0 = Date.now();
    const r = await run(PY, [join(HERE, "mask_pii.py")], { input: JSON.stringify({ texts: s.map(([o, k]) => o[k]) }), timeoutMs: 120_000 });
    if (r.code !== 0) { log("masking failed, continuing without it:", r.stderr.slice(-200)); return { input: copy, count: undefined }; }
    const res = JSON.parse(r.stdout);
    s.forEach(([o, k], i) => { o[k] = res.texts[i]; });
    log("masked", res.count, "entities in", `${Date.now() - t0}ms`, JSON.stringify(res.labels));
    return { input: copy, count: res.count };
  };
}
