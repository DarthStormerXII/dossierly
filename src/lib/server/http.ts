import { ZodError } from "zod";
import type { Env } from "./env";
import { timingSafeEqual } from "./util";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function jsonError(status: number, error: string, code?: string, headers?: HeadersInit): Response {
  return Response.json(code ? { error, code } : { error }, { status, headers });
}

/** Maps any thrown value to `{ error, code? }`; never leaks stacks or database text. */
export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) return jsonError(e.status, e.message, e.code);
  if (e instanceof ZodError) return jsonError(400, "Invalid request", "invalid_request");
  return jsonError(500, "Something went wrong on our side", "internal");
}

export async function readJson<T>(req: Request, schema: { parse(v: unknown): T }): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be JSON", "invalid_json");
  }
  return schema.parse(body);
}

/** Bridge auth for /api/bridge/*: `Authorization: Bearer <BRIDGE_SECRET>`. */
export function requireBridge(req: Request, env: Env): void {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.BRIDGE_SECRET || !token || !timingSafeEqual(token, env.BRIDGE_SECRET)) {
    throw new ApiError(401, "Bridge not authorised", "bridge_unauthorised");
  }
}
