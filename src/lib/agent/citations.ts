import type { AskResult, Passage, PrepareResult } from "./schemas";

const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’“”"'`]/g, "").replace(/\s+/g, " ").trim();

export type CitationReport = { dropped: number; repaired: number };

/**
 * Enforces "cite only provided passages". An item whose url is not a provided passage is dropped;
 * a quote that is not a verbatim excerpt is replaced by the passage's own opening text and the
 * item is downgraded to "check" so the UI never shows an unverified claim as confirmed.
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
    const verbatim = norm(p.text).includes(norm(it.citation.quote));
    if (verbatim) {
      checklist.push({ ...it, citation: { ...it.citation, title: p.title } });
    } else {
      report.repaired++;
      checklist.push({ item: it.item, status: "check", citation: { url: p.url, title: p.title, quote: p.text.trim().slice(0, 200) } });
    }
  }
  return { result: { ...r, checklist }, report };
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
