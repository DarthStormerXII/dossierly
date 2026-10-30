import type { AskResult, Passage, PrepareInput, PrepareResult } from "./schemas";

const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’“”"'`]/g, "").replace(/\s+/g, " ").trim();

/** Lower-case word tokens without diacritics or short filler words, for fuzzy matching. */
const STOP = new Set(["the", "and", "for", "with", "your", "you", "from", "that", "this", "of", "to", "a", "an", "or", "all", "nr", "no", "copy", "original"]);
export function tokens(s: string): Set<string> {
  const plain = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").toLowerCase();
  return new Set(plain.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, "")));
}
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;

export type CitationReport = { dropped: number; repaired: number };

/** The sentence-sized window of the passage that best matches what the item is about (verbatim from the passage). */
export function bestExcerpt(text: string, about: string, max = 200): string | null {
  const want = tokens(about);
  const parts = text.split(/(?<=[.;:!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 20);
  let best: { s: string; score: number } | null = null;
  for (const s of parts) {
    const score = overlap(want, tokens(s));
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best ? best.s.slice(0, max) : null;
}

/**
 * Enforces "cite only provided passages". An item whose url is not a provided passage is dropped. A quote that is
 * not a verbatim excerpt is replaced by the passage sentence that best matches the item (or, failing that, the
 * passage opening), always verbatim from the passage.
 */
export function enforcePrepareCitations(r: PrepareResult, passages: Passage[]): { result: PrepareResult; report: CitationReport } {
  const byUrl = new Map(passages.map((p) => [p.url, p]));
  const report: CitationReport = { dropped: 0, repaired: 0 };
  const checklist: PrepareResult["checklist"] = [];
  for (const it of r.checklist) {
    const p = byUrl.get(it.citation.url);
    if (!p) {
      report.dropped++;
      continue;
    }
    if (norm(p.text).includes(norm(it.citation.quote))) {
      checklist.push({ ...it, citation: { ...it.citation, title: p.title } });
      continue;
    }
    // Prefer the sentence that matches the item; with none, fall back to the passage opening rather than lose the line.
    const quote = bestExcerpt(p.text, `${it.item} ${it.citation.quote}`) ?? p.text.trim().slice(0, 200);
    report.repaired++;
    checklist.push({ ...it, citation: { url: p.url, title: p.title, quote } });
  }
  return { result: { ...r, checklist }, report };
}

/**
 * "have" and "missing" come from the case's own document list, not from the model: an item that clearly names a
 * listed document takes that document's state; anything else stays "check".
 */
export function applyCaseStatus(r: PrepareResult, documents: PrepareInput["case"]["documents"]): PrepareResult {
  const docs = documents.map((d) => ({ have: d.have, t: tokens(d.name) })).filter((d) => d.t.size > 0);
  const checklist = r.checklist.map((it) => {
    const t = tokens(it.item);
    let best: { have: boolean; score: number } | null = null;
    for (const d of docs) {
      const score = overlap(t, d.t) / d.t.size;
      if (score >= 0.5 && (!best || score > best.score)) best = { have: d.have, score };
    }
    return { ...it, status: best ? (best.have ? ("have" as const) : ("missing" as const)) : ("check" as const) };
  });
  return { ...r, checklist };
}

export function enforceAskCitations(r: AskResult, passages: Passage[]): { result: AskResult; report: CitationReport } {
  const byUrl = new Map(passages.map((p) => [p.url, p]));
  const report: CitationReport = { dropped: 0, repaired: 0 };
  const citations = r.citations.flatMap((c) => {
    const p = byUrl.get(c.url);
    if (!p || !norm(p.text).includes(norm(c.quote))) {
      report.dropped++;
      return [];
    }
    return [{ ...c, title: p.title }];
  });
  return { result: { ...r, citations }, report };
}
