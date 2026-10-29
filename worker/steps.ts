/**
 * Step logic for the three Workflows. Each handler is wired to a feature lane's module when it lands:
 *   prepareFallback -> src/lib/agent/fallback.ts   (lane B)
 *   letterPipeline  -> src/lib/features/letters.ts (lane C)
 *   nightlyWatch    -> src/lib/hub/watch.ts        (lane C)
 * Until then each returns { skipped: true }.
 */
export type StepResult = { skipped: true } | Record<string, unknown>;
type Handler = (params: unknown, env: unknown) => Promise<StepResult>;

export const stepHandlers: Record<"prepareFallback" | "letterPipeline" | "nightlyWatch", Handler> = {
  prepareFallback: async () => ({ skipped: true }),
  letterPipeline: async () => ({ skipped: true }),
  nightlyWatch: async () => ({ skipped: true }),
};
