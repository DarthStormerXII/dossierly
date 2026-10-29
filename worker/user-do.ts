import { DurableObject } from "cloudflare:workers";
import { handleUserRequest, UserState } from "../src/lib/server/userstate";

/** One per user: rate limits, entitlement cache, deadline alarms ({date, label} only). */
export class UserDO extends DurableObject<Record<string, unknown>> {
  private state: UserState;

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    this.state = new UserState({
      get: <T>(k: string) => ctx.storage.get<T>(k),
      put: (k, v) => ctx.storage.put(k, v),
      setAlarm: (at) => ctx.storage.setAlarm(at),
    });
  }

  fetch(request: Request): Promise<Response> {
    return handleUserRequest(this.state, request);
  }

  alarm(): Promise<void> {
    return this.state.onAlarm();
  }
}
