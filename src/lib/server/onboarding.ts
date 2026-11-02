import { LanguageSchema } from "../schemas";
import { NeedSchema, type Need, type OnboardingRequest, type OnboardingState } from "../onboarding/schema";
import type { Env } from "./env";
import { ApiError } from "./http";

type Row = { step: number; language: string; needs: string; reviewed_needs: string; revision: number; case_id: string | null; completed_at: number | null };
const empty = (): OnboardingState => ({ status: "new", step: 1, language: "en", needs: [], reviewedNeeds: [], revision: 0, caseId: null, completedAt: null, deviceOnly: true });
function needs(raw: string): Need[] {
  try { const values: unknown = JSON.parse(raw); return Array.isArray(values) ? values.flatMap((v) => { const p = NeedSchema.safeParse(v); return p.success ? [p.data] : []; }) : []; }
  catch { return []; }
}
export async function getOnboarding(env: Env, accountId: string): Promise<OnboardingState> {
  const row = await env.DB.prepare("SELECT step,language,needs,reviewed_needs,revision,case_id,completed_at FROM onboarding_progress WHERE account_id = ?").bind(accountId).first<Row>();
  if (!row) return empty();
  return { status: row.completed_at !== null ? "completed" : "in_progress", step: row.step, language: LanguageSchema.catch("en").parse(row.language), needs: needs(row.needs), reviewedNeeds: needs(row.reviewed_needs), revision: row.revision, caseId: row.case_id, completedAt: row.completed_at === null ? null : new Date(row.completed_at).toISOString(), deviceOnly: true };
}

/** No name, address, letter, model result or other private case content is written here. */
export async function updateOnboarding(env: Env, accountId: string, request: OnboardingRequest): Promise<OnboardingState> {
  const old = await getOnboarding(env, accountId);
  if (old.revision !== request.expectedRevision) throw new ApiError(409, "Progress changed in another tab. Reload progress before retrying.", "revision_conflict");
  if (old.status === "completed" && request.action !== "restart") throw new ApiError(409, "Your setup is already complete", "already_completed");
  let next = { ...old, status: "in_progress" as OnboardingState["status"] };
  if (request.action === "restart") next = { ...empty(), revision: old.revision };
  if (request.action === "progress" || request.action === "complete") {
    if (request.reviewedNeeds.some((need) => !request.needs.includes(need))) throw new ApiError(400, "Review only selected priorities", "invalid_request");
    next = { ...next, language: request.language, needs: request.needs, reviewedNeeds: request.reviewedNeeds };
  }
  if (request.action === "progress") next.step = request.step;
  if (request.action === "complete") {
    if (old.step < 4 || !request.needs.length || request.needs.some((n) => !request.reviewedNeeds.includes(n))) {
      throw new ApiError(400, "Review or explicitly skip every selected priority before finishing", "incomplete_setup");
    }
    next = { ...next, step: 6, caseId: request.caseId, completedAt: new Date().toISOString(), status: "completed" };
  }
  if (request.action === "adopt_existing") next = { ...next, step: 6, caseId: request.caseId, completedAt: new Date().toISOString(), status: "completed" };
  const now = Date.now();
  await env.DB.prepare("INSERT OR IGNORE INTO onboarding_progress (account_id,updated_at) VALUES (?,?)").bind(accountId, now).run();
  const result = await env.DB.prepare("UPDATE onboarding_progress SET step=?,language=?,needs=?,reviewed_needs=?,revision=revision+1,case_id=?,completed_at=?,updated_at=? WHERE account_id=? AND revision=?")
    .bind(next.step, next.language, JSON.stringify(next.needs), JSON.stringify(next.reviewedNeeds), next.caseId, next.completedAt ? Date.parse(next.completedAt) : null, now, accountId, request.expectedRevision).run();
  if (!result.meta?.changes) throw new ApiError(409, "Progress changed in another tab. Reload progress before retrying.", "revision_conflict");
  return getOnboarding(env, accountId);
}
