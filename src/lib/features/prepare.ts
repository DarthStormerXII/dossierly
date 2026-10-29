import { enqueueAgentTask } from "../agent/queue";
import { buildHubContext } from "../hub/pipeline";
import { skillFor } from "../hub/skills.generated";
import { maskerFor } from "../mask";
import type { Ctx } from "../model";
import type { PrepareRequest } from "../schemas";

/**
 * POST /api/prepare: run the hub pipeline (cached sources, chunking, embedding rank), then hand the
 * masked case, ranked passages, recent changes and the matching SKILL.md playbook to the user's agent.
 * The cloud fallback for an unclaimed task lives in builder B's agent code and reads the same input.
 */
export async function prepare(ctx: Ctx, r: PrepareRequest) {
  const userId = ctx.userId ?? "";
  const hub = await buildHubContext(ctx.env, { userId, appointment: r.appointment, language: r.language });
  const masker = maskerFor({ name: r.case.profile.name, addresses: r.case.profile.addresses, caseNumber: r.case.caseNumber });
  const { taskId } = await enqueueAgentTask(ctx.env, {
    userId,
    kind: "prepare",
    input: {
      appointment: r.appointment,
      case: masker.maskDeep(r.case),
      language: r.language,
      changes: hub.changes.map(({ title, summary, url, detectedAt }) => ({ title, summary, url, detectedAt })),
      passages: hub.passages.slice(0, 12).map(({ url, title, text }) => ({ url, title, text: text.slice(0, 5900) })),
      skill: skillFor(hub.topics),
    },
  });
  return { taskId, retrieval: hub.retrieval, masked: masker.count };
}
