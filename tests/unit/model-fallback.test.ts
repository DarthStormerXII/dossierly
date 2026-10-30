import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MODEL_IDS } from "@/lib/config";
import { maskerFor } from "@/lib/mask";
import { runModel } from "@/lib/model";
import { ModelError, type ChatClient, type ChatRequest } from "@/lib/model/types";
import { freshLocalEnv } from "@/lib/server/local";

const schema = z.object({ summary: z.string() });

/** A client whose `missing` model answers 404 the way the Token Factory adapter maps it. */
function clientWithout(missing: string) {
  const calls: ChatRequest[] = [];
  const client: ChatClient = {
    async chat(r) {
      calls.push(r);
      if (r.model === missing) throw new ModelError("This model is briefly unavailable", "model_unavailable", 503);
      return { content: '{"summary":"ok"}', usage: { tokensIn: 100, tokensOut: 10, cachedTokens: 0 } };
    },
  };
  return { client, calls };
}

const call = (task: "wrap" | "read", images?: string[]) => ({
  task, system: "RULES", input: "What was agreed?", schema, maxTokens: 200, images,
  masker: maskerFor({ name: "Arjun Raman" }), replay: () => ({ summary: "REPLAY" }),
});

describe("model missing from Token Factory (404)", () => {
  it("moves a text task from Super VL to Ultra and records the model that answered", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test-key" });
    const { client, calls } = clientWithout(MODEL_IDS.superVl);
    const out = await runModel({ env, userId: "u1", client }, call("wrap"));
    expect(out.data.summary).toBe("ok");
    expect(calls.map((c) => c.model)).toEqual([MODEL_IDS.superVl, MODEL_IDS.ultra]);
    expect(out.run.model).toBe(MODEL_IDS.ultra);
  });

  it("does not substitute a text model for vision: letter reading surfaces the 503", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test-key" });
    const { client, calls } = clientWithout(MODEL_IDS.superVl);
    await expect(runModel({ env, userId: "u1", client }, call("read", ["data:image/png;base64,AAAA"]))).rejects.toMatchObject({ code: "model_unavailable", status: 503 });
    expect(calls).toHaveLength(1);
  });
});
