/* Live smoke test against Token Factory (costs a few cents). Needs NEBIUS_API_KEY.
   Run: node --env-file=.env.local --import tsx scripts/smoke.ts [probe|features] */
import { introduce, interpret, watch, wrap } from "../src/lib/features/interpret";
import { linkLetter, readLetter } from "../src/lib/features/letters";
import { MODEL_IDS } from "../src/lib/config";
import { freshLocalEnv } from "../src/lib/server/local";

const out = (s: string) => process.stdout.write(`${s}\n`);
const KEY = process.env.NEBIUS_API_KEY ?? "";
const BASE = "https://api.tokenfactory.nebius.com/v1";
const Q = 'Translate to Polish: "Where do I pay the fee?" Reply as JSON {"translation": string}.';
const schema = { type: "json_schema", json_schema: { name: "t", strict: true, schema: { type: "object", properties: { translation: { type: "string" } }, required: ["translation"], additionalProperties: false } } };

async function raw(model: string, extra: Record<string, unknown>, content = Q) {
  const t = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, store: false, max_tokens: 300, temperature: 0.2, messages: [{ role: "user", content }], ...extra }),
  });
  const j = (await res.json().catch(() => ({}))) as { usage?: { completion_tokens?: number; prompt_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }; choices?: Array<{ message?: { content?: string }; logprobs?: { content?: unknown[] } }> };
  const u = j.usage;
  return `status=${res.status} ms=${Date.now() - t} out=${u?.completion_tokens} in=${u?.prompt_tokens} cached=${u?.prompt_tokens_details?.cached_tokens ?? "n/a"} logprobs=${j.choices?.[0]?.logprobs?.content?.length ?? "no"} reply=${JSON.stringify(String(j.choices?.[0]?.message?.content ?? "").slice(0, 80))}`;
}

async function probe() {
  const off = { chat_template_kwargs: { enable_thinking: false } };
  for (const [name, model] of Object.entries(MODEL_IDS)) {
    out(`== ${name} ${model}`);
    out(" default (thinking)  " + (await raw(model, {})));
    out(" kwargs think off    " + (await raw(model, off)));
    out(" reasoning_effort    " + (await raw(model, { reasoning_effort: "none" })));
    out(" json_object + off   " + (await raw(model, { ...off, response_format: { type: "json_object" } })));
    out(" json_schema + off   " + (await raw(model, { ...off, response_format: schema })));
    out(" logprobs + off      " + (await raw(model, { ...off, logprobs: true, top_logprobs: 1 })));
  }
  const prefix = "RULES: " + "You are a careful interpreter. Keep names, numbers and dates exact. ".repeat(400);
  for (const [name, model] of Object.entries(MODEL_IDS)) {
    for (let i = 0; i < 2; i++) {
      out(` cache ${name} try${i}  ` + (await raw(model, off, `${prefix}\nSay ${i}.`)));
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  out(" flex lightning       " + (await raw(MODEL_IDS.lightning, { ...off, service_tier: "flex" })));
}

const step = async (name: string, fn: () => Promise<unknown>) => {
  const t = Date.now();
  try {
    const r = JSON.stringify(await fn());
    out(`PASS ${name} (${Date.now() - t} ms) ${r.slice(0, 300)}`);
    return true;
  } catch (e) {
    out(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
};

async function features() {
  const env = freshLocalEnv({ NEBIUS_API_KEY: KEY });
  const ctx = { env, userId: "smoke" };
  const turns = [{ speaker: "official" as const, original: "Decyzję może Pan odebrać do 14 listopada w pokoju 112.", translation: "You can collect the decision by 14 November in room 112." }];
  const ok = [
    await step("intro", () => introduce(ctx, { name: "Arjun Raman", language: "en", office: "Mazowiecki Urząd Wojewódzki" })),
    await step("interpret EN->PL", () => interpret(ctx, { speaker: "user", text: "I have my passport. Where do I pay the fee?", language: "en", recent: [] })),
    await step("interpret PL->HI", () => interpret(ctx, { speaker: "official", text: "Proszę o paszport i potwierdzenie opłaty skarbowej.", language: "hi", recent: [] })),
    await step("advice flag", () => interpret(ctx, { speaker: "user", text: "Should I sign this contract? Is it legal?", language: "en", recent: [] })),
    await step("watch", () => watch(ctx, { turns, language: "en" })),
    await step("wrap", () => wrap(ctx, { turns, language: "uk", office: "Mazowiecki Urząd Wojewódzki" })),
  ];
  const png = process.argv[3];
  if (png) {
    const { readFileSync } = await import("node:fs");
    const page = `data:image/png;base64,${readFileSync(png).toString("base64")}`;
    let letter: Awaited<ReturnType<typeof readLetter>>["letter"] | null = null;
    ok.push(
      await step("letters/read", async () => {
        const res = await readLetter(ctx, { pages: [page], language: "en" });
        letter = res.letter;
        return res;
      }),
    );
    if (letter !== null) {
      const c = { id: "c1", country: "pl" as const, type: "temporary_residence_work", office: "Mazowiecki Urząd Wojewódzki", caseNumber: "WSC-II-P.6151.48213.2026", profile: { name: "Arjun Raman", language: "en" as const }, events: [{ id: "e1", date: "2026-09-18", kind: "appointment" as const, title: "Fingerprints", summary: "Fingerprints taken." }], documents: [{ name: "Rental agreement", have: true }, { name: "Health insurance", have: false }], deadlines: [] };
      ok.push(await step("letters/link", async () => linkLetter(ctx, { letter: letter as never, deliveryDate: "2026-10-27", case: c, language: "en" })));
    }
  }
  process.exit(ok.every(Boolean) ? 0 : 1);
}

async function main() {
  if (!KEY) {
    out("NEBIUS_API_KEY is not set. Run: node --env-file=.env.local --import tsx scripts/smoke.ts [probe|features [letter.png]]");
    process.exit(2);
  }
  const mode = process.argv[2] ?? "features";
  if (mode === "probe") await probe();
  else await features();
}
void main();
