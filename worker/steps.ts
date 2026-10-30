/**
 * Step logic for the Workflows. The nightly official-pages watch runs for real; prepare and letter runs are
 * served directly by their API routes, so those two Workflows are unused and return { skipped: true }.
 */
import type { Env } from "../src/lib/server/env";
import { runNightlyWatch } from "../src/lib/hub/watch";

export type StepResult = { skipped: true } | Record<string, unknown>;
type Handler = (params: unknown, env: unknown) => Promise<StepResult>;

export const stepHandlers: Record<"prepareFallback" | "letterPipeline" | "nightlyWatch", Handler> = {
  prepareFallback: async () => ({ skipped: true }),
  letterPipeline: async () => ({ skipped: true }),
  nightlyWatch: async (_params, env) => {
    const report = await runNightlyWatch(env as Env);
    return JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
  },
};
