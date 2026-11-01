import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));
const qa = config.env.qa;

describe("Cloudflare QA environment isolation", () => {
  it("uses a separate Worker and self-reference", () => {
    expect(qa.name).not.toBe(config.name);
    expect(qa.services).toEqual([{ binding: "WORKER_SELF_REFERENCE", service: qa.name }]);
    expect(qa.workers_dev).toBe(true);
    expect(qa.vars.APP_ENV).toBe("preview");
    expect(qa.vars.MODELS_DISABLED).toBe("1");
    expect(qa.vars.DODO_ENV).toBe("test");
    expect(qa.vars.APP_URL).toBe("https://dossierly-qa.gabrielaxy.workers.dev");
    expect(new URL(qa.vars.APP_URL).hostname.startsWith(`${qa.name}.`)).toBe(true);
  });

  it("keeps all persistent resources away from production", () => {
    for (const [key, id] of [["d1_databases", "database_id"], ["kv_namespaces", "id"], ["r2_buckets", "bucket_name"]]) {
      expect(qa[key]).toHaveLength(config[key].length);
      const production = new Set(config[key].map((entry: Record<string, string>) => entry[id]));
      for (const entry of qa[key]) {
        expect(entry[id]).toBeTruthy();
        expect(production.has(entry[id])).toBe(false);
      }
    }
    expect(qa.r2_buckets[0].jurisdiction).toBe("eu");
  });

  it("owns its Durable Objects and workflows without a scheduled job", () => {
    expect(qa.durable_objects.bindings).toEqual(config.durable_objects.bindings);
    const production = new Set(config.workflows.map((entry: { name: string }) => entry.name));
    expect(qa.workflows).toHaveLength(config.workflows.length);
    for (const workflow of qa.workflows) {
      expect(workflow.name.startsWith(`${qa.name}-`)).toBe(true);
      expect(production.has(workflow.name)).toBe(false);
    }
    expect(qa.triggers.crons).toEqual([]);
  });
});
