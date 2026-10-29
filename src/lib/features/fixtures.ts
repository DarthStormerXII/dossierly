/* Replay builders: pure functions that return the same shapes the models produce. */
import type { Language, LettersLinkRequest, LettersReadRequest, TurnInput } from "../schemas";
import {
  CLARIFY_14_NOV,
  DRAFT_LOCAL,
  LETTER,
  LINK,
  OFFICIAL_LINES,
  USER_LINES,
  WRAP,
} from "./fixture-text";
import type { Issue, LinkModelOut, Wrap } from "./outputs";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const NO_FIXTURE = "[replay: no recorded translation]";

export function introFixture(name: string) {
  return {
    local: `Dzień dobry. Nazywam się ${name} i nie mówię jeszcze dobrze po polsku. Pomaga mi tłumacz AI w telefonie: tłumaczy to, co Pan lub Pani mówi, i to, co ja mówię. Proszę mówić krótkimi zdaniami. Dźwięk nie jest nagrywany.`,
    english: `Hello, my name is ${name}. I do not speak much Polish yet. An AI interpreter on my phone is helping us understand each other. Please speak in short sentences. No audio is recorded.`,
  };
}

export function interpretFixture(speaker: "user" | "official", text: string, language: Language): { translation: string; advice: boolean } {
  const t = norm(text);
  if (speaker === "official") {
    const hit = OFFICIAL_LINES.find((l) => norm(l.pl) === t);
    return { translation: hit ? hit.tr[language] : `${NO_FIXTURE} ${text}`, advice: false };
  }
  const hit = USER_LINES.find((l) => l.keys.some((k) => norm(k) === t));
  return { translation: hit ? hit.pl : `${NO_FIXTURE} ${text}`, advice: hit?.advice ?? false };
}

export function watchFixture(turns: TurnInput[], language: Language): { issues: Issue[] } {
  const last = turns[turns.length - 1];
  if (last?.speaker === "official" && last.original.includes("14 listopada")) {
    return {
      issues: [
        {
          kind: CLARIFY_14_NOV.kind,
          quote: CLARIFY_14_NOV.quote,
          explanation: CLARIFY_14_NOV.explanation[language],
          clarifyLocal: CLARIFY_14_NOV.clarifyLocal,
          clarifyUser: CLARIFY_14_NOV.clarifyUser[language],
        },
      ],
    };
  }
  return { issues: [] };
}

export function wrapFixture(language: Language): Wrap {
  const w = WRAP[language];
  return {
    headline: w.headline,
    agreed: w.agreed,
    bring: w.bring,
    nextDates: [{ date: "2026-11-14", what: w.what }],
    openQuestions: w.open,
  };
}

export function letterFixture(_req: LettersReadRequest, language: Language) {
  const l = LETTER[language];
  return {
    readable: true,
    transcript:
      "Wezwanie do uzupełnienia braków formalnych wniosku. Na podstawie art. 64 § 2 Kodeksu postępowania administracyjnego wzywam Pana do uzupełnienia braków formalnych w terminie 14 dni od dnia doręczenia niniejszego wezwania.",
    title: l.title,
    kind: "wezwanie_braki_formalne" as const,
    office: "Mazowiecki Urząd Wojewódzki w Warszawie",
    caseNumber: "WSC-II-P.6151.48213.2026",
    dateOnLetter: "2026-10-22",
    asks: l.asks,
    asksLocal: [
      "przedłożenie aktualnej umowy najmu lub innego dokumentu potwierdzającego adres zamieszkania",
      "przedłożenie potwierdzenia ubezpieczenia zdrowotnego na cały okres pobytu",
      "przedłożenie pełnej kopii paszportu",
    ],
    deadlineRule: {
      days: 14,
      from: "delivery" as const,
      quote: "w terminie 14 dni od dnia doręczenia niniejszego wezwania",
    },
    fields: l.labels.map(([label, meaning, howToFill]) => ({ label, meaning, howToFill })),
    lowConfidence: [] as string[],
  };
}

export function linkFixture(req: LettersLinkRequest): LinkModelOut {
  const l = LINK[req.language];
  const related = req.case.events.filter((e) => e.kind === "appointment" || e.date <= req.deliveryDate).slice(-2).map((e) => e.id);
  return {
    relatedEventIds: related,
    explanation: l.explanation,
    stillOpen: l.open,
    draftLocal: DRAFT_LOCAL,
    draftUser: l.draftUser,
  };
}

export function prepareFixture() {
  const cite = (url: string, title: string, quote: string) => ({ url, title, quote });
  return {
    checklist: [
      {
        item: "Passport",
        status: "have" as const,
        citation: cite("https://migrant.wsc.mazowieckie.pl/komunikaty", "Komunikaty - Mazowiecki Urząd Wojewódzki", "SAMPLE replay: no live citation."),
      },
      {
        item: "Proof of payment of the fee",
        status: "check" as const,
        citation: cite("https://migrant.wsc.mazowieckie.pl/wskazowki/oplaty", "Opłaty - Mazowiecki Urząd Wojewódzki", "SAMPLE replay: no live citation."),
      },
    ],
    phrases: [{ local: "Czy może Pan mówić wolniej?", user: "Could you speak more slowly?" }],
  };
}
