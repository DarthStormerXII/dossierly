/* Deterministic detectors for personal identifiers. Each returns the spans to replace. */
export type PatternType = "EMAIL" | "IBAN" | "CASE" | "PESEL" | "PHONE" | "PASSPORT" | "DOB";
export interface Span {
  type: PatternType;
  start: number;
  end: number;
}

const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];

/** PESEL checksum (Polish national ID number). */
export function isValidPesel(s: string): boolean {
  if (!/^\d{11}$/.test(s)) return false;
  const sum = PESEL_WEIGHTS.reduce((a, w, i) => a + w * Number(s[i]), 0);
  return (10 - (sum % 10)) % 10 === Number(s[10]);
}

/** ISO 13616 mod-97 check. */
export function isValidIban(raw: string): boolean {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const IBAN = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?(?![A-Za-z0-9])/g;
const NRB = /(?<!\d)\d{2}(?: ?\d{4}){6}(?!\d)/g;
// Polish case signatures such as WSC-II-P.6151.48213.2026
const CASE = /(?<![A-Za-z0-9])[A-Z]{2,6}(?:-[A-Z0-9]{1,6}){0,4}\.\d{1,6}\.\d{1,8}\.\d{4}(?![A-Za-z0-9])/g;
const PESEL = /(?<!\d)\d{11}(?!\d)/g;
const PESEL_LABEL = /pesel\W{0,4}$/i;
const PHONE_INTL = /(?<![\w+])(?:\+|00)\d{1,3}[\s.-]?(?:\d[\s.-]?){7,12}\d(?!\d)/g;
const PHONE_SEP = /(?<![\d])\d{3}[ .-]\d{3}[ .-]\d{3}(?![\d])/g;
const PHONE_PLAIN_PL = /(?<![\d.])[4-8]\d{8}(?![\d])/g;
const PHONE_PLAIN_IN = /(?<![\d.])[6-9]\d{9}(?![\d])/g;
const PASSPORT_LABELLED =
  /(?:passport|paszport|паспорт|पासपोर्ट|கடவுச்சீட்டு)(?:\s*(?:no\.?|number|nr\.?|numer|№|#))?\s*[:\-]?\s*([A-Z]{0,2}\d{6,9})/giu;
const PASSPORT_BARE = /(?<![A-Za-z0-9])[A-Z]{1,2}\d{7}(?![A-Za-z0-9])/g;
const DOB_LABEL =
  "(?:date\\s+of\\s+birth|d\\.?o\\.?b\\.?|born(?:\\s+on)?|data\\s+urodzenia|ur\\.|urodzon[ay]?\\s*(?:dnia)?|дата\\s+народження|народи(?:вся|лася)|जन्म\\s*तिथि|பிறந்த\\s*தேதி)";
const DATE = "(?:\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+\\p{L}+\\s+\\d{4})";
const DOB = new RegExp(`${DOB_LABEL}\\s*[:\\-]?\\s*(${DATE})`, "giu");

function collect(re: RegExp, text: string, type: PatternType, ok?: (m: string, start: number) => boolean): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (!ok || ok(m[0], start)) out.push({ type, start, end: start + m[0].length });
  }
  return out;
}

function collectGroup(re: RegExp, text: string, type: PatternType): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(re)) {
    const g = m[1];
    if (!g) continue;
    const start = (m.index ?? 0) + m[0].lastIndexOf(g);
    out.push({ type, start, end: start + g.length });
  }
  return out;
}

/** All identifier spans in priority order; overlaps are resolved by the caller (first claim wins). */
export function detectIdentifiers(text: string): Span[] {
  return [
    ...collect(EMAIL, text, "EMAIL"),
    ...collect(CASE, text, "CASE"),
    ...collect(IBAN, text, "IBAN", (m) => isValidIban(m)),
    ...collect(NRB, text, "IBAN", (m) => isValidIban(`PL${m}`)),
    ...collect(PESEL, text, "PESEL", (m, i) => isValidPesel(m) || PESEL_LABEL.test(text.slice(Math.max(0, i - 12), i))),
    ...collect(PHONE_INTL, text, "PHONE"),
    ...collect(PHONE_SEP, text, "PHONE"),
    ...collect(PHONE_PLAIN_PL, text, "PHONE"),
    ...collect(PHONE_PLAIN_IN, text, "PHONE"),
    ...collectGroup(PASSPORT_LABELLED, text, "PASSPORT"),
    ...collect(PASSPORT_BARE, text, "PASSPORT"),
    ...collectGroup(DOB, text, "DOB"),
  ];
}
