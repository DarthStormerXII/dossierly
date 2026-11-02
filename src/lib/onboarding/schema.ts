import { z } from "zod";
import { LanguageSchema } from "../schemas";

export const NeedSchema = z.enum(["letters", "documents", "deadlines", "appointments", "communicate", "updates"]);
export type Need = z.infer<typeof NeedSchema>;
const uniqueNeeds = z.array(NeedSchema).max(6).refine((v) => new Set(v).size === v.length);
const caseId = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/).refine((id) => !/sample/i.test(id), "Use your own case");
const revision = z.number().int().nonnegative();
const choices = { language: LanguageSchema, needs: uniqueNeeds, reviewedNeeds: uniqueNeeds };
export const OnboardingRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("progress"), expectedRevision: revision, step: z.number().int().min(1).max(6), ...choices }).strict(),
  z.object({ action: z.literal("complete"), expectedRevision: revision, caseId, confirmed: z.literal(true), ...choices }).strict(),
  z.object({ action: z.literal("adopt_existing"), expectedRevision: revision, caseId, confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal("restart"), expectedRevision: revision, confirmed: z.literal(true) }).strict(),
]);
export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;
export type OnboardingState = {
  status: "new" | "in_progress" | "completed";
  step: number;
  language: z.infer<typeof LanguageSchema>;
  needs: Need[];
  reviewedNeeds: Need[];
  revision: number;
  caseId: string | null;
  completedAt: string | null;
  deviceOnly: true;
};
