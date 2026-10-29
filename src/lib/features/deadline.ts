/*
 * Deadline arithmetic, done in code and never by a model.
 * Rule used: the day of delivery (or of the letter) is not counted; day 1 is the next calendar day.
 * That is the rule for deadlines in days in Polish administrative proceedings (KPA art. 57 §1, with "dni"
 * meaning calendar days). When the last day is a Saturday or a statutory holiday the term ends on the next
 * day that is neither (KPA art. 57 §4). Both points are recorded, with quotes, in hub/poland/coverage.json. The sentence in the letter is the only source of "how many days"; we do not
 * guess a number the letter does not state. The result is a calculation, not legal advice.
 */
import type { DeadlineRule, Language } from "../schemas";

export interface Deadline {
  date: string;
  steps: string[];
}

const DAY = 86_400_000;
const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Polish public holidays (days off work) for a year. 24 December is a holiday from 2025. */
export function polishHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const fixed = ["01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-25", "12-26", ...(year >= 2025 ? ["12-24"] : [])];
  const out = new Set(fixed.map((md) => `${year}-${md}`));
  for (const offset of [0, 1, 49, 60]) out.add(iso(addDays(easter, offset)));
  return out;
}

export const isWorkingDay = (d: Date) => {
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6 && !polishHolidays(d.getUTCFullYear()).has(iso(d));
};

const LOCALE: Record<Language, string> = { en: "en-GB", uk: "uk-UA", hi: "hi-IN", ta: "ta-IN" };
const fmt = (d: Date, lang: Language) =>
  new Intl.DateTimeFormat(LOCALE[lang], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);

const T = {
  en: {
    base: (from: string, date: string) => `Starting point: ${from} on ${date}.`,
    rule: (days: number, quote: string) => `The letter says ${days} days${quote ? `: "${quote}"` : ""}.`,
    count: (d1: string, n: number, last: string) => `The starting day is not counted. Day 1 is ${d1}. Counting calendar days, day ${n} is ${last}.`,
    moved: (why: string, final: string) => `That day is ${why}, so the deadline moves to the next working day: ${final}.`,
    same: "That is a working day, so the date stays.",
    why: { sat: "a Saturday", sun: "a Sunday", hol: "a public holiday" },
    from: { delivery: "delivery of the letter", letter_date: "the date on the letter" },
    note: "This is a calculation from the wording of the letter, not legal advice. Confirm the date with the office.",
  },
  uk: {
    base: (from: string, date: string) => `Точка відліку: ${from} — ${date}.`,
    rule: (days: number, quote: string) => `У листі вказано ${days} дн.${quote ? `: «${quote}»` : ""}.`,
    count: (d1: string, n: number, last: string) => `День відліку не рахується. День 1 — ${d1}. За календарними днями день ${n} — ${last}.`,
    moved: (why: string, final: string) => `Цей день — ${why}, тому строк переноситься на наступний робочий день: ${final}.`,
    same: "Це робочий день, тож дата не змінюється.",
    why: { sat: "субота", sun: "неділя", hol: "державне свято" },
    from: { delivery: "вручення листа", letter_date: "дата на листі" },
    note: "Це розрахунок за формулюванням листа, а не юридична порада. Підтвердіть дату у відомстві.",
  },
  hi: {
    base: (from: string, date: string) => `शुरुआत: ${from}, ${date}।`,
    rule: (days: number, quote: string) => `पत्र में ${days} दिन लिखे हैं${quote ? `: "${quote}"` : ""}।`,
    count: (d1: string, n: number, last: string) => `शुरुआती दिन गिना नहीं जाता। दिन 1 है ${d1}। कैलेंडर दिनों के हिसाब से दिन ${n} है ${last}।`,
    moved: (why: string, final: string) => `वह दिन ${why} है, इसलिए समय-सीमा अगले कार्य दिवस पर चली जाती है: ${final}।`,
    same: "वह कार्य दिवस है, इसलिए तारीख़ वही रहती है।",
    why: { sat: "शनिवार", sun: "रविवार", hol: "सार्वजनिक छुट्टी" },
    from: { delivery: "पत्र मिलने की तारीख़", letter_date: "पत्र पर लिखी तारीख़" },
    note: "यह पत्र के शब्दों से की गई गणना है, कानूनी सलाह नहीं। तारीख़ कार्यालय से पक्की कर लें।",
  },
  ta: {
    base: (from: string, date: string) => `தொடக்கம்: ${from}, ${date}.`,
    rule: (days: number, quote: string) => `கடிதத்தில் ${days} நாட்கள் என்று உள்ளது${quote ? `: "${quote}"` : ""}.`,
    count: (d1: string, n: number, last: string) => `தொடக்க நாள் கணக்கில் வராது. நாள் 1 என்பது ${d1}. காலண்டர் நாட்களின்படி நாள் ${n} என்பது ${last}.`,
    moved: (why: string, final: string) => `அந்த நாள் ${why}, எனவே காலக்கெடு அடுத்த வேலை நாளுக்கு மாறுகிறது: ${final}.`,
    same: "அது வேலை நாள், எனவே தேதி மாறாது.",
    why: { sat: "சனிக்கிழமை", sun: "ஞாயிற்றுக்கிழமை", hol: "பொது விடுமுறை" },
    from: { delivery: "கடிதம் கிடைத்த நாள்", letter_date: "கடிதத்தில் உள்ள தேதி" },
    note: "இது கடிதத்தின் வாசகத்திலிருந்து செய்த கணக்கீடு, சட்ட ஆலோசனை அல்ல. தேதியை அலுவலகத்தில் உறுதிசெய்யுங்கள்.",
  },
} as const;

export interface DeadlineInput {
  rule: DeadlineRule;
  deliveryDate: string;
  letterDate: string | null;
  language: Language;
}

/** Returns null when the letter states no day count or the needed start date is unknown. */
export function computeDeadline(i: DeadlineInput): Deadline | null {
  const { rule, language } = i;
  if (rule.days === null || rule.from === null) return null;
  const baseIso = rule.from === "delivery" ? i.deliveryDate : i.letterDate;
  if (!baseIso || !/^\d{4}-\d{2}-\d{2}$/.test(baseIso)) return null;
  const t = T[language];
  const base = parse(baseIso);
  const last = addDays(base, rule.days);
  const steps = [t.base(t.from[rule.from], fmt(base, language)), t.rule(rule.days, rule.quote), t.count(fmt(addDays(base, 1), language), rule.days, fmt(last, language))];
  let final = last;
  if (!isWorkingDay(last)) {
    const why = last.getUTCDay() === 6 ? t.why.sat : last.getUTCDay() === 0 ? t.why.sun : t.why.hol;
    while (!isWorkingDay(final)) final = addDays(final, 1);
    steps.push(t.moved(why, fmt(final, language)));
  } else {
    steps.push(t.same);
  }
  steps.push(t.note);
  return { date: iso(final), steps };
}
