import { clearedCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearedCookie(), "cache-control": "no-store" } });
}
