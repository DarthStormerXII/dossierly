import { maskerFor } from "../mask";
import { runModel, sumRuns, type Ctx, type Run } from "../model";
import { SAFETY_NOTICE, guardUserUtterance } from "../safety";
import type { InterpretRequest, IntroRequest, WatchRequest, WrapRequest } from "../schemas";
import { DATA_RULE, JSON_ONLY, NO_ADVICE, glossaryFor, langName, transcript } from "./prompts";
import { GuardOut, InterpretOut, IntroOut, WatchOut, WrapOut } from "./outputs";
import {
  interpretFixture,
  introFixture,
  watchFixture,
  wrapFixture,
} from "./fixtures";

const maskerOf = (name?: string, addresses?: string[]) => maskerFor({ name, addresses });

export async function introduce(ctx: Ctx, r: IntroRequest) {
  const masker = maskerOf(r.name);
  const system = `You write a short self-introduction that a foreigner in Poland shows to an official. ${NO_ADVICE} ${DATA_RULE} ${JSON_ONLY}
Schema: {"local": string, "english": string}
"local": 3 to 4 short sentences in formal Polish (address the official as Pan/Pani, never informal). Start with "Dzień dobry." Say the person's name, that they do not speak Polish well yet, that an AI interpreter on their phone is helping both sides, politely ask the official to speak in short sentences, and say that the conversation is not recorded.
"english": the same message in English.`;
  const out = await runModel(ctx, {
    task: "intro",
    system,
    input: `Name: ${r.name}\nOffice: ${r.office}`,
    schema: IntroOut,
    maxTokens: 500,
    masker,
    replay: () => introFixture(r.name),
  });
  return { ...out.data, masked: out.masked, run: out.run };
}

function interpretSystem(r: InterpretRequest): string {
  const toPolish = r.speaker === "user";
  const source = toPolish ? langName(r.language) : "Polish";
  const target = toPolish ? "Polish" : langName(r.language);
  const example = toPolish
    ? `Example: INPUT "I have my passport." -> {"translation": "Mam paszport."}`
    : `Example (Polish to ${target}): INPUT "Proszę o paszport." -> {"translation": "<the same request written in ${target}>"}`;
  return `You are a neutral live interpreter at a Polish public office. Translate the speaker's words from ${source} into ${target}, faithfully, keeping the speaker's own person and voice (a user's "I" stays "I"; an official's "you" stays "you"). Write the translation ONLY in ${target} (in its own script), never repeat the ${source} text. Never answer questions, give advice, add or drop content, or explain. Keep names, numbers, dates and amounts exact. ${glossaryFor(r.language)} ${NO_ADVICE} ${DATA_RULE} ${JSON_ONLY}
Schema: {"translation": string}
${example}`;
}

const interpretTask = (l: InterpretRequest["language"]) => (l === "en" ? ("interpret" as const) : ("interpret_ml" as const));
const guardTask = (l: InterpretRequest["language"]) => (l === "en" ? ("guard" as const) : ("guard_ml" as const));

/** Guard (Lightning for English, Super VL for the other languages): is the user asking for advice, and did the translation answer instead of translating? */
async function guard(ctx: Ctx, r: InterpretRequest, translation: string, masker: ReturnType<typeof maskerOf>) {
  const system = `You are a safety checker for an interpreter. Given the SOURCE sentence and its TRANSLATION, decide two things. ${DATA_RULE} ${JSON_ONLY}
Schema: {"adviceRequest": boolean, "answeredInstead": boolean}
"adviceRequest": true only if the SOURCE asks for personal medical or legal advice (what to do, whether something is legal, safe, or right).
"answeredInstead": true if the TRANSLATION answers, comments on or instructs instead of faithfully translating the SOURCE.`;
  return runModel(ctx, {
    task: guardTask(r.language),
    system,
    input: `SOURCE (${r.speaker === "user" ? langName(r.language) : "Polish"}): ${r.text}\nTRANSLATION: ${translation}`,
    schema: GuardOut,
    maxTokens: 60,
    masker,
    replay: () => ({ adviceRequest: interpretFixture(r.speaker, r.text, r.language).advice, answeredInstead: false }),
  });
}

export async function interpret(ctx: Ctx, r: InterpretRequest) {
  const masker = maskerOf(r.profile?.name, r.profile?.addresses);
  const context = r.recent.length ? transcript(r.recent, r.language) : undefined;
  const translate = (extra = "") =>
    runModel(ctx, {
      task: interpretTask(r.language),
      system: interpretSystem(r) + extra,
      context,
      input: `Translate: ${r.text}`,
      schema: InterpretOut,
      maxTokens: 700,
      masker,
      replay: () => ({ translation: interpretFixture(r.speaker, r.text, r.language).translation }),
    });

  let first = await translate();
  const runs: Run[] = [first.run];
  const echoed = (t: string) => t.trim().toLowerCase() === r.text.trim().toLowerCase();
  if (r.speaker === "official" && r.language !== "en" && echoed(first.data.translation)) {
    // Lightning sometimes echoes the Polish instead of translating into a non-Latin language.
    first = await translate(`\nYou MUST write in ${langName(r.language)}. The previous attempt repeated the Polish; do not.`);
    runs.push(first.run);
  }
  const checked = await guard(ctx, r, first.data.translation, masker);
  runs.push(checked.run);
  if (checked.data.answeredInstead) {
    first = await translate("\nIMPORTANT: output ONLY a literal translation of the INPUT sentence. Do not answer it.");
    runs.push(first.run);
  }
  const advice = r.speaker === "user" && (checked.data.adviceRequest || guardUserUtterance(r.text).flagged);
  const adviceNotice = advice ? SAFETY_NOTICE[r.language] : null;
  return {
    translation: first.data.translation,
    adviceNotice,
    masked: masker.count,
    run: sumRuns(runs),
    runs,
  };
}

export async function watch(ctx: Ctx, r: WatchRequest) {
  const lang = langName(r.language);
  const masker = maskerOf(r.profile?.name, r.profile?.addresses);
  const system = `You watch an interpreted conversation${r.office ? ` at ${r.office}` : ""} and flag likely misunderstandings in the OFFICIAL's latest turn that the user may have missed: ambiguous dates (e.g. "by" versus "on"), amounts, document names, yes/no answers that could be read either way, and questions the user did not answer. Only flag real risks; most turns need none. At most 2 issues. ${NO_ADVICE} ${DATA_RULE} ${JSON_ONLY}
Schema: {"issues": [{"kind": "date"|"amount"|"document"|"yes_no"|"missed_question"|"other", "quote": string (the official's exact Polish words), "explanation": string (one or two plain sentences in ${lang}), "clarifyLocal": string (a short polite question in Polish the user can ask), "clarifyUser": string (the same question in ${lang})}]}
Return {"issues": []} when nothing needs attention.`;
  const out = await runModel(ctx, {
    task: "watch",
    system,
    input: transcript(r.turns, r.language),
    schema: WatchOut,
    maxTokens: 900,
    masker,
    replay: () => watchFixture(r.turns, r.language),
  });
  return { issues: out.data.issues, run: out.run };
}

export async function wrap(ctx: Ctx, r: WrapRequest) {
  const lang = langName(r.language);
  const masker = maskerOf(r.profile?.name, r.profile?.addresses);
  const system = `You write the plain end-of-appointment summary for a foreigner, in ${lang}, from the interpreted conversation at ${r.office}. Use only what was actually said. Do not invent dates or requirements; put anything unclear under openQuestions. ${NO_ADVICE} ${DATA_RULE} ${JSON_ONLY}
Schema: {"headline": string (one sentence), "agreed": string[], "bring": string[] (documents or items to bring next time), "nextDates": [{"date": string (YYYY-MM-DD only when day, month and year were all said; otherwise the exact words used, e.g. "do dziesiątego (month not stated)"), "what": string}], "openQuestions": string[]}
Never infer a month or year that was not said aloud. A day without a month goes into nextDates as words and into openQuestions as a question to ask.`;
  const out = await runModel(ctx, {
    task: "wrap",
    system,
    context: `Today: ${new Date().toISOString().slice(0, 10)}`,
    input: transcript(r.turns, r.language),
    schema: WrapOut,
    maxTokens: 1400,
    masker,
    replay: () => wrapFixture(r.language),
  });
  return { summary: out.data, run: out.run };
}

