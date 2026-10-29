import { z } from "zod";

export const LANGUAGES = ["en", "uk", "hi", "ta"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LanguageSchema = z.enum(LANGUAGES);

export const SpeakerSchema = z.enum(["user", "official"]);
export type Speaker = z.infer<typeof SpeakerSchema>;

export const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).optional();

export const TurnSchema = z.object({
  speaker: SpeakerSchema,
  original: text(1500),
  translation: text(1500),
});
export type TurnInput = z.infer<typeof TurnSchema>;

/** Optional personal terms (the user's own name and addresses) the client wants masked before any model call. */
export const MaskProfileSchema = z
  .object({
    name: optText(120),
    addresses: z.array(text(200)).max(5).default([]),
  })
  .optional();
export type MaskProfile = z.infer<typeof MaskProfileSchema>;

// ---- case model (client-owned, sent as context) -----------------------------

export const CaseEventSchema = z.object({
  id: text(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["appointment", "letter", "wrap", "note"]),
  title: text(200),
  summary: z.string().trim().max(1500).default(""),
  refs: z.array(text(120)).max(10).optional(),
});
export const CaseSchema = z.object({
  id: text(80),
  country: z.literal("pl").default("pl"),
  type: z.string().default("temporary_residence_work"),
  office: text(160),
  caseNumber: optText(80),
  profile: z.object({ name: text(120), language: LanguageSchema, addresses: z.array(text(200)).max(5).optional() }),
  events: z.array(CaseEventSchema).max(60).default([]),
  documents: z.array(z.object({ name: text(160), have: z.boolean() })).max(40).default([]),
  deadlines: z
    .array(z.object({ id: text(80), date: z.string(), what: text(300), sourceEventId: text(80) }))
    .max(30)
    .default([]),
});
export type Case = z.infer<typeof CaseSchema>;

// ---- requests ---------------------------------------------------------------

export const IntroRequestSchema = z.object({
  name: text(80),
  language: LanguageSchema,
  office: text(160),
});
export type IntroRequest = z.infer<typeof IntroRequestSchema>;

export const InterpretRequestSchema = z.object({
  speaker: SpeakerSchema,
  text: text(1500),
  language: LanguageSchema,
  recent: z.array(TurnSchema).max(8).default([]),
  profile: MaskProfileSchema,
});
export type InterpretRequest = z.infer<typeof InterpretRequestSchema>;

export const WatchRequestSchema = z.object({
  turns: z.array(TurnSchema).min(1).max(12),
  language: LanguageSchema,
  office: optText(160),
  profile: MaskProfileSchema,
});
export type WatchRequest = z.infer<typeof WatchRequestSchema>;

export const WrapRequestSchema = z.object({
  turns: z.array(TurnSchema).min(1).max(80),
  language: LanguageSchema,
  office: text(160),
  profile: MaskProfileSchema,
});
export type WrapRequest = z.infer<typeof WrapRequestSchema>;

export const DataUrlSchema = z
  .string()
  .max(6_000_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Unsupported image");

export const LettersReadRequestSchema = z.object({
  pages: z.array(DataUrlSchema).min(1).max(4),
  language: LanguageSchema,
});
export type LettersReadRequest = z.infer<typeof LettersReadRequestSchema>;

export const DeadlineRuleSchema = z.object({
  days: z.number().int().min(0).max(365).nullable(),
  from: z.enum(["delivery", "letter_date"]).nullable(),
  quote: z.string().trim().max(400).default(""),
});
export type DeadlineRule = z.infer<typeof DeadlineRuleSchema>;

export const LETTER_KINDS = [
  "wezwanie_braki_formalne",
  "decision",
  "card_collection",
  "fingerprint_appointment",
  "proceedings_extension",
  "other",
] as const;

export const LetterSchema = z.object({
  readable: z.boolean(),
  /** Verbatim Polish text of the page, transcribed before anything is explained. */
  transcript: z.string().trim().max(8000).default(""),
  title: z.string().trim().max(240).default(""),
  kind: z.enum(LETTER_KINDS).catch("other"),
  office: z.string().trim().max(200).nullable().default(null),
  caseNumber: z.string().trim().max(80).nullable().default(null),
  dateOnLetter: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null)
    .default(null),
  asks: z.array(z.string().trim().max(400)).max(14).default([]),
  /** The same asks in the letter's own Polish words, in the same order, so the reader can check the translation. */
  asksLocal: z.array(z.string().trim().max(400)).max(14).default([]),
  deadlineRule: DeadlineRuleSchema.default({ days: null, from: null, quote: "" }),
  fields: z
    .array(
      z.object({
        label: text(160),
        meaning: z.string().trim().max(400).default(""),
        howToFill: z.string().trim().max(400).default(""),
      }),
    )
    .max(24)
    .default([]),
  lowConfidence: z.array(z.string().max(80)).max(30).default([]),
});
export type Letter = z.infer<typeof LetterSchema>;

export const LettersLinkRequestSchema = z.object({
  letter: LetterSchema,
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  case: CaseSchema,
  language: LanguageSchema,
});
export type LettersLinkRequest = z.infer<typeof LettersLinkRequestSchema>;

export const PrepareRequestSchema = z.object({
  appointment: z.object({
    office: text(160),
    purpose: text(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  case: CaseSchema,
  language: LanguageSchema,
});
export type PrepareRequest = z.infer<typeof PrepareRequestSchema>;

export const ApiErrorSchema = z.object({ error: z.string(), code: z.string().optional() });
