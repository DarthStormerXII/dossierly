import type { Env } from "../server/env";
import { ApiError } from "../server/http";
import { timingSafeEqual } from "../server/util";

/** Bridge auth: `x-bridge-secret: <BRIDGE_SECRET>` (a Bearer token is accepted too). */
export function requireBridgeSecret(req: Request, env: Env): void {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const given = req.headers.get("x-bridge-secret") ?? bearer;
  if (!env.BRIDGE_SECRET || !given || !timingSafeEqual(given, env.BRIDGE_SECRET)) {
    throw new ApiError(401, "Bridge not authorised", "bridge_unauthorised");
  }
}
