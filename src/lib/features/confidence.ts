import type { TokenLogprob } from "../model/types";

const DATE_KEYS = ["dateOnLetter", "deadlineRule.days"];

/**
 * Fields whose digit tokens the model was unsure about (probability below `threshold`).
 * Without logprobs every date-bearing field is marked for confirmation instead.
 */
export function lowConfidenceFields(raw: string, tokens: TokenLogprob[] | undefined, threshold = 0.85): string[] {
  if (!tokens?.length) return [...DATE_KEYS, "asks"];
  const limit = Math.log(threshold);
  const out = new Set<string>();
  let pos = 0;
  const keyPositions: Array<{ key: string; at: number }> = [];
  for (const m of raw.matchAll(/"([A-Za-z]+)"\s*:/g)) keyPositions.push({ key: m[1], at: m.index ?? 0 });
  for (const t of tokens) {
    const at = raw.indexOf(t.token, pos);
    const start = at === -1 ? pos : at;
    pos = start + t.token.length;
    if (t.logprob >= limit || !/\d/.test(t.token)) continue;
    const owner = [...keyPositions].reverse().find((k) => k.at < start)?.key;
    if (!owner) continue;
    out.add(owner === "days" ? "deadlineRule.days" : owner === "quote" ? "deadlineRule.quote" : owner);
  }
  return [...out];
}
