import { readLetter } from "@/lib/features/letters";
import { handle } from "@/lib/features/route";
import { LettersReadRequestSchema } from "@/lib/schemas";
import { spendLetter } from "@/lib/server/entitlements";
import { ApiError } from "@/lib/server/http";
import { loadUserState } from "@/lib/server/session";

export const maxDuration = 60;

/**
 * The first letter is free (the SAMPLE case is exempt); after that a Case Pass, judge plan or one credit pays.
 * Nothing is spent on an unreadable photo.
 */
export async function POST(request: Request) {
  return handle(request, LettersReadRequestSchema, async (ctx, input, userId) => {
    // The shared SAMPLE case is a demo for every visitor; the daily model budget caps its cost.
    const isSample = userId === "sample-arjun";
    const state = isSample ? null : await loadUserState(ctx.env, userId);
    if (!isSample && state && state.freeLetterUsed && state.plan.kind === "free" && state.plan.creditsLeft < 1) {
      throw new ApiError(402, "Your free letter is used. Get a Case Pass or credits to read more letters.", "payment_required");
    }
    const result = await readLetter(ctx, input);
    if (isSample || !result.letter.readable) return result;
    const paid = await spendLetter(ctx.env, userId, state?.plan.kind ?? "free");
    if (!paid) throw new ApiError(402, "Your free letter is used. Get a Case Pass or credits to read more letters.", "payment_required");
    return result;
  });
}
