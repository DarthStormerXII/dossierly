import { z } from "zod";
import { text } from "../schemas";

/** What the models are asked to produce. Camel-case here matches the API response shapes. */
export const IntroOut = z.object({ local: text(1200), english: text(800) });

export const InterpretOut = z.object({ translation: text(1800) });
export const GuardOut = z.object({
  adviceRequest: z.boolean().catch(false),
  answeredInstead: z.boolean().catch(false),
});

export const ISSUE_KINDS = ["date", "amount", "document", "yes_no", "missed_question", "other"] as const;
export const IssueOut = z.object({
  kind: z.enum(ISSUE_KINDS).catch("other"),
  quote: text(300),
  explanation: text(500),
  clarifyLocal: text(300),
  clarifyUser: text(300),
});
export type Issue = z.infer<typeof IssueOut>;
export const WatchOut = z.object({ issues: z.array(IssueOut).max(3).default([]) });

export const WrapOut = z.object({
  headline: text(300),
  agreed: z.array(text(300)).max(10).default([]),
  bring: z.array(text(200)).max(10).default([]),
  nextDates: z.array(z.object({ date: text(60), what: text(300) })).max(8).default([]),
  openQuestions: z.array(text(300)).max(6).default([]),
});
export type Wrap = z.infer<typeof WrapOut>;

export const LinkOut = z.object({
  relatedEventIds: z.array(text(80)).max(20).default([]),
  explanation: text(1500),
  stillOpen: z.array(text(300)).max(12).default([]),
  draftLocal: text(3000),
  draftUser: text(3000),
});
export type LinkModelOut = z.infer<typeof LinkOut>;

export const HubSummaryOut = z.object({
  changes: z
    .array(
      z.object({
        title: text(160),
        summary: text(500),
        /** Publication date printed on the page, YYYY-MM-DD, or null when none is printed. */
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null).default(null),
      }),
    )
    .max(8)
    .default([]),
});

export const PrepareOut = z.object({
  checklist: z
    .array(
      z.object({
        item: text(300),
        status: z.enum(["have", "missing", "check"]).catch("check"),
        citation: z.object({ url: text(500), title: text(200), quote: z.string().trim().max(400).default("") }),
      }),
    )
    .max(20),
  phrases: z.array(z.object({ local: text(300), user: text(300) })).max(10).default([]),
});
export type PrepareModelOut = z.infer<typeof PrepareOut>;
