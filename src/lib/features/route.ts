import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ModelError } from "../model";
import { requireUser } from "../server/session";
import { getEnv } from "../server/env";
import { errorResponse as platformError, jsonError } from "../server/http";
import type { Ctx } from "../model";

/** Parse + validate the body with zod, require a session, run the handler, map any failure to `{ error, code? }`. */
export async function handle<I, O>(request: Request, schema: ZodType<I>, run: (ctx: Ctx, input: I, userId: string) => Promise<O>) {
  try {
    const { userId } = await requireUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Request body must be JSON", "invalid_json");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(400, `Invalid request: ${issue.path.join(".") || "body"} ${issue.message}`, "invalid_request");
    }
    const result = await run({ env: getEnv(), userId }, parsed.data, userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ModelError) return jsonError(err.status, err.message, err.code);
    return platformError(err);
  }
}
