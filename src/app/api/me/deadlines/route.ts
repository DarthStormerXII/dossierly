import { z } from "zod";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label: z.string().trim().min(1).max(120) });

function stub(userId: string) {
  const env = getEnv();
  return env.USER_DO.get(env.USER_DO.idFromName(userId));
}

/** The server keeps only {date, label}: no case content. */
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser(req);
    return stub(userId).fetch("https://user.do/deadlines");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser(req);
    const d = await readJson(req, body);
    return stub(userId).fetch("https://user.do/deadlines", { method: "POST", body: JSON.stringify(d) });
  } catch (e) {
    return errorResponse(e);
  }
}
