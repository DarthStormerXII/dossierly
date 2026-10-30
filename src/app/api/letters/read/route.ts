import { readLetter } from "@/lib/features/letters";
import { handle } from "@/lib/features/route";
import { LettersReadRequestSchema } from "@/lib/schemas";
import { spendLetter } from "@/lib/server/entitlements";
import { ApiError } from "@/lib/server/http";
import { FREE_LETTERS, loadUserState, SAMPLE_USER_ID } from "@/lib/server/session";

export const maxDuration = 60;

const LIMIT_MESSAGE = `You have used your ${FREE_LETTERS} free letters. Upgrade to Dossierly Plus to read more.`;

/**
 * Free accounts read FREE_LETTERS letters; Plus and judge plans are unlimited; the SAMPLE case is exempt.
 * Nothing is spent on an unreadable photo.
 */
export async function POST(request: Request) {
  return handle(request, LettersReadRequestSchema, async (ctx, input, userId) => {
    // The shared SAMPLE case is a demo for every visitor; the daily model budget caps its cost.
    const isSample = userId === SAMPLE_USER_ID;
    const state = isSample ? null : await loadUserState(ctx.env, userId);
    if (state && state.plan.kind === "free" && state.lettersUsed >= FREE_LETTERS && state.plan.creditsLeft < 1) {
      throw new ApiError(402, LIMIT_MESSAGE, "payment_required");
    }
    const result = await readLetter(ctx, input);
    if (isSample || !result.letter.readable) return result;
    const paid = await spendLetter(ctx.env, userId, state?.plan.kind ?? "free");
    if (!paid) throw new ApiError(402, LIMIT_MESSAGE, "payment_required");
    return result;
  });
}
