import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { stepHandlers } from "./steps";

/** Each class is a thin durable shell; the logic lives in the feature lanes (see worker/steps.ts). */
async function run(step: WorkflowStep, name: keyof typeof stepHandlers, params: unknown, env: unknown) {
  return step.do(name, { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () =>
    JSON.parse(JSON.stringify(await stepHandlers[name](params, env))),
  );
}

export class PrepareFallback extends WorkflowEntrypoint<unknown, unknown> {
  async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    return run(step, "prepareFallback", event.payload, this.env);
  }
}

export class LetterPipeline extends WorkflowEntrypoint<unknown, unknown> {
  async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    return run(step, "letterPipeline", event.payload, this.env);
  }
}

export class NightlyWatch extends WorkflowEntrypoint<unknown, unknown> {
  async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    return run(step, "nightlyWatch", event.payload, this.env);
  }
}
