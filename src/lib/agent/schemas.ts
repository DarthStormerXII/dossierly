/**
 * Agent task contracts. Self-contained on purpose (imports only zod, no local imports, erasable
 * TypeScript only): the M2 bridge imports this very file with Node's type stripping, so the Worker
 * and the bridge validate against one definition.
 */
import { z } from "zod";

export const SAMPLE_USER_ID = "sample-arjun";
export const TASK_KINDS = ["prepare", "ask", "file"] as const;
export const TaskKindSchema = z.enum(TASK_KINDS);
export type TaskKind = z.infer<typeof TaskKindSchema>;

const str = (max: number) => z.string().trim().min(1).max(max);
const LanguageSchema = z.enum(["en", "uk", "hi", "ta"]);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The client-owned case, as sent per request (see docs/BUILD.md). Extra fields pass through. */
export const CaseContextSchema = z
  .object({
    id: str(80),
    office: str(160),
    caseNumber: z.string().max(80).optional(),
    profile: z.object({ name: str(120), language: LanguageSchema }).passthrough(),
    events: z
      .array(
        z.object({
          id: str(80),
          date: IsoDate,
          kind: z.enum(["appointment", "letter", "wrap", "note"]),
          title: str(200),
          summary: z.string().max(1500).default(""),
          refs: z.array(str(120)).max(10).optional(),
        }),
      )
      .max(60)
      .default([]),
    documents: z.array(z.object({ name: str(160), have: z.boolean() })).max(40).default([]),
    deadlines: z
      .array(z.object({ id: str(80), date: str(40), what: str(300), sourceEventId: str(80) }))
      .max(30)
      .default([]),
  })
  .passthrough();
export type CaseContext = z.infer<typeof CaseContextSchema>;

/** A retrieved hub passage the agent may cite. Builder C's hub retrieval fills these. */
export const PassageSchema = z.object({
  url: z.string().url().max(500),
  title: str(300),
  text: z.string().min(1).max(6000),
});
export type Passage = z.infer<typeof PassageSchema>;

const Extras = {
  passages: z.array(PassageSchema).max(12).default([]),
  /** Optional SKILL.md playbook text for the office/letter type (hub/skills/**). */
  skill: z.string().max(20000).optional(),
};

export const PrepareInputSchema = z.object({
  appointment: z.object({ office: str(160), purpose: str(200), date: IsoDate }),
  case: CaseContextSchema,
  language: LanguageSchema,
  changes: z
    .array(z.object({ title: str(300), summary: z.string().max(1000), url: z.string().url().max(500), detectedAt: str(40) }))
    .max(10)
    .default([]),
  ...Extras,
});
export const AskInputSchema = z.object({
  question: str(1500),
  case: CaseContextSchema,
  language: LanguageSchema,
  ...Extras,
});
export const FileInputSchema = z.object({
  event: z.object({
    id: str(80),
    date: IsoDate,
    kind: z.enum(["appointment", "letter", "wrap", "note"]),
    title: str(200),
    summary: z.string().max(4000).default(""),
    refs: z.array(str(120)).max(10).optional(),
  }),
  case: CaseContextSchema,
  language: LanguageSchema.default("en"),
});
export const InputSchemas = { prepare: PrepareInputSchema, ask: AskInputSchema, file: FileInputSchema } as const;
export type PrepareInput = z.infer<typeof PrepareInputSchema>;
export type AskInput = z.infer<typeof AskInputSchema>;
export type FileInput = z.infer<typeof FileInputSchema>;
export type TaskInput = PrepareInput | AskInput | FileInput;

// ---- results ----------------------------------------------------------------

export const CitationSchema = z.object({ url: z.string().url().max(500), title: str(300), quote: str(600) });
/** Keeps the well-formed entries of a model-written list and drops the rest, so one bad item cannot sink the answer. */
function lenient<T extends z.ZodType>(item: T, max: number) {
  return z
    .array(z.unknown())
    .default([])
    .transform((list) => list.flatMap((v) => { const r = item.safeParse(v); return r.success ? [r.data as z.infer<T>] : []; }).slice(0, max));
}
const ChecklistItemSchema = z.object({ item: str(300), status: z.enum(["have", "missing", "check"]), citation: CitationSchema });
const PhraseSchema = z.object({ local: str(300), user: str(400) });
const ChangeSchema = z.object({ title: str(300), summary: z.string().max(1000), url: z.string().url().max(500), detectedAt: str(40) });
export const PrepareResultSchema = z.object({
  checklist: lenient(ChecklistItemSchema, 25).refine((l) => l.length > 0, "the checklist has no well-formed items"),
  phrases: lenient(PhraseSchema, 12),
  changes: lenient(ChangeSchema, 10),
});
export const AskResultSchema = z.object({
  answer: str(3000),
  citations: z.array(CitationSchema).max(6).default([]),
  notice: z.string().max(300).optional(),
});
export const FileResultSchema = z.object({
  filed: z.boolean(),
  summary: str(600),
  memoryUpdated: z.boolean().default(true),
});
export const ResultSchemas = { prepare: PrepareResultSchema, ask: AskResultSchema, file: FileResultSchema } as const;
export type PrepareResult = z.infer<typeof PrepareResultSchema>;
export type AskResult = z.infer<typeof AskResultSchema>;
export type FileResult = z.infer<typeof FileResultSchema>;
export type TaskResult = PrepareResult | AskResult | FileResult;

// ---- wire formats -----------------------------------------------------------

export const TraceStepSchema = z.object({ step: str(200), tool: z.string().max(80).optional(), ms: z.number().min(0).max(3_600_000) });
export type TraceStep = z.infer<typeof TraceStepSchema>;

export const BridgeResultSchema = z.object({
  taskId: str(80),
  ok: z.boolean(),
  sandbox: str(80),
  result: z.unknown().optional(),
  error: z.string().max(500).optional(),
  trace: z.array(TraceStepSchema).max(40).default([]),
  durationMs: z.number().min(0).max(3_600_000).default(0),
  /** GLiNER-PII before/after counts when the bridge masked the input (stretch). */
  masked: z.number().int().min(0).max(10_000).optional(),
  /** Approximate token use (characters / 4); the sandbox does not report exact usage. */
  tokensIn: z.number().int().min(0).default(0),
  tokensOut: z.number().int().min(0).default(0),
});
export type BridgeResult = z.infer<typeof BridgeResultSchema>;

export const EgressRowSchema = z.object({
  ts: z.number().int().positive(),
  domain: str(253),
  port: z.number().int().min(0).max(65535).optional(),
  action: z.enum(["Allowed", "Denied"]),
  method: z.string().max(12).optional(),
  process: z.string().max(200).optional(),
  reason: z.string().max(300).optional(),
});
export type EgressRow = z.infer<typeof EgressRowSchema>;
export const BridgeEgressSchema = z.object({
  sandbox: str(80),
  userId: z.string().max(80).nullable().default(null),
  policySha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  rows: z.array(EgressRowSchema).max(300),
});
export type BridgeEgress = z.infer<typeof BridgeEgressSchema>;

export const AskRequestSchema = z.object({ question: str(1500), case: CaseContextSchema, language: LanguageSchema });
export const FileRequestSchema = z.object({ event: FileInputSchema.shape.event, case: CaseContextSchema });

// ---- Nebius Serverless Job results (guardrails audit) ------------------------

const Rate = z.number().min(0).max(1);
export const JobResultSchema = z.object({
  job: z.string().regex(/^settla-[a-z0-9-]{1,60}$/),
  ranAt: z.string().max(40),
  region: z.string().max(40),
  platform: z.string().max(60),
  tool: z.literal("nemoguardrails"),
  toolVersion: z.string().max(20),
  model: z.string().max(80),
  total: z.number().int().min(1).max(5000),
  categories: z.record(z.string().max(40), z.object({ n: z.number().int().min(0), correct: z.number().int().min(0) })),
  harmfulBlockRate: Rate,
  benignAllowRate: Rate,
  p50Ms: z.number().min(0),
  p95Ms: z.number().min(0),
  failures: z.array(z.object({ category: z.string().max(40), id: z.string().max(40) })).max(100).default([]),
});
export type JobResult = z.infer<typeof JobResultSchema>;
