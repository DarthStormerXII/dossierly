import { detectIdentifiers, type PatternType, type Span } from "./patterns";

export type MaskType = PatternType | "NAME" | "ADDRESS";

const PLACEHOLDER = /\[\s*([A-Z]+)[_\s-]*(\d+)\s*\]/g;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export interface MaskTerms {
  /** The user's own name, e.g. "Arjun Raman". Each part of 3+ letters is masked too. */
  names?: string[];
  /** Addresses from the case profile, matched whole (case and whitespace insensitive). */
  addresses?: string[];
  /** Exact strings that must never leave, e.g. the case signature. */
  literals?: string[];
}

/**
 * One Masker per request. mask() replaces personal identifiers with stable placeholders
 * ([PESEL_1], [NAME_1]...), restore() puts the originals back into model output.
 * The same value always maps to the same placeholder within a Masker.
 */
export class Masker {
  private forward = new Map<string, string>();
  private reverse = new Map<string, string>();
  private counters = new Map<string, number>();
  private nameRes: RegExp[] = [];
  private addrRes: RegExp[] = [];
  private literalRes: RegExp[] = [];
  /** Distinct private values replaced so far (what the API reports as `masked`). */
  get count(): number {
    return this.forward.size;
  }

  constructor(terms: MaskTerms = {}) {
    const flex = (s: string) => esc(s.trim()).replace(/\s+/g, "\\s+");
    const names = (terms.names ?? []).map((n) => n.trim()).filter(Boolean);
    for (const n of names) this.nameRes.push(new RegExp(`(?<![\\p{L}\\p{N}])${flex(n)}(?![\\p{L}\\p{N}])`, "giu"));
    const parts = new Set(names.flatMap((n) => n.split(/\s+/)).filter((p) => [...p].length >= 3));
    for (const p of parts) {
      const stem = [...p].length >= 5 ? "\\p{L}{0,3}" : "";
      this.nameRes.push(new RegExp(`(?<![\\p{L}\\p{N}])${esc(p)}${stem}(?![\\p{L}\\p{N}])`, "giu"));
    }
    for (const a of terms.addresses ?? []) if (a.trim()) this.addrRes.push(new RegExp(flex(a), "giu"));
    for (const l of terms.literals ?? []) if (l.trim()) this.literalRes.push(new RegExp(flex(l), "giu"));
  }

  private placeholder(type: MaskType, original: string): string {
    const key = `${type}:${norm(original)}`;
    const hit = this.forward.get(key);
    if (hit) return hit;
    const n = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, n);
    const ph = `[${type}_${n}]`;
    this.forward.set(key, ph);
    this.reverse.set(`${type}_${n}`, original);
    return ph;
  }

  private spansFor(text: string): Array<Span | { type: MaskType; start: number; end: number }> {
    const spans: Array<{ type: MaskType; start: number; end: number }> = [];
    const add = (res: RegExp[], type: MaskType) => {
      for (const re of res) for (const m of text.matchAll(re)) spans.push({ type, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
    };
    add(this.literalRes, "CASE");
    add(this.addrRes, "ADDRESS");
    spans.push(...detectIdentifiers(text));
    add(this.nameRes, "NAME");
    return spans;
  }

  mask(text: string): string {
    if (!text) return text;
    const spans = this.spansFor(text);
    // Earlier-listed claims win; a later span that overlaps an accepted one is dropped.
    const accepted: typeof spans = [];
    for (const s of spans) {
      if (!accepted.some((a) => s.start < a.end && s.end > a.start)) accepted.push(s);
    }
    accepted.sort((a, b) => b.start - a.start);
    let out = text;
    for (const s of accepted) {
      out = out.slice(0, s.start) + this.placeholder(s.type, text.slice(s.start, s.end)) + out.slice(s.end);
    }
    return out;
  }

  restore(text: string): string {
    if (!this.reverse.size) return text;
    return text.replace(PLACEHOLDER, (whole, type: string, n: string) => this.reverse.get(`${type}_${n}`) ?? whole);
  }

  maskDeep<T>(value: T): T {
    if (typeof value === "string") return this.mask(value) as T;
    if (Array.isArray(value)) return value.map((v) => this.maskDeep(v)) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.maskDeep(v)])) as T;
    }
    return value;
  }

  restoreDeep<T>(value: T): T {
    if (typeof value === "string") return this.restore(value) as T;
    if (Array.isArray(value)) return value.map((v) => this.restoreDeep(v)) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.restoreDeep(v)])) as T;
    }
    return value;
  }

}

export function maskerFor(opts: { name?: string; addresses?: string[]; caseNumber?: string; extra?: string[] } = {}): Masker {
  return new Masker({
    names: opts.name ? [opts.name] : [],
    addresses: opts.addresses ?? [],
    literals: [...(opts.caseNumber ? [opts.caseNumber] : []), ...(opts.extra ?? [])],
  });
}
