import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/hub/pipeline", () => ({ buildHubContext: async () => ({ passages: [], changes: [], topics: [], retrieval: { origin: "none", sources: [] } }) }));
import * as environment from "@/lib/server/env";
import { freshLocalEnv } from "@/lib/server/local";
import { createAccountUser, sessionCookie } from "@/lib/server/session";
import { POST as prepare } from "@/app/api/prepare/route";
import { POST as ask } from "@/app/api/agent/ask/route";
import { POST as file } from "@/app/api/agent/file/route";
import { GET as task } from "@/app/api/agent/tasks/[id]/route";
import { GET as events } from "@/app/api/agent/tasks/[id]/events/route";
import { sampleCase } from "@/lib/client/sample";

let env = freshLocalEnv(); const cookies: Record<string, string> = {};
beforeEach(async () => {
  env = freshLocalEnv(); vi.spyOn(environment, "getEnv").mockReturnValue(env);
  for (const id of ["u_ananya", "u_olena"]) {
    await createAccountUser(env, id, "device");
    await env.DB.prepare("UPDATE users SET active_case='sample' WHERE id=?").bind(id).run();
    cookies[id] = (await sessionCookie(id, env)).split(";")[0];
  }
});
afterEach(() => vi.restoreAllMocks());
const request = (id: string, path: string, body?: unknown) => new Request("http://localhost:3000" + path, { method: body ? "POST" : "GET", headers: { cookie: cookies[id], origin: "http://localhost:3000", "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });

describe("legacy sample sessions never authorize another person's real case tasks", () => {
  it.each(["prepare", "ask", "file"] as const)("keeps %s account-owned and masks personal input even when both sessions selected sample", async (kind) => {
    const c = { ...sampleCase(), id: "case-own-ananya", profile: { name: "Ananya Rao", language: "en" as const } };
    const body = kind === "prepare" ? { case: c, language: "en", appointment: { date: "2026-11-18", office: c.office, purpose: "Review requested documents" } }
      : kind === "ask" ? { case: c, language: "en", question: "What does Ananya Rao need to check in this letter?" }
      : { case: c, event: { id: "letter-owned", date: "2026-11-02", kind: "letter", title: "Ananya Rao reviewed letter", summary: "Check the original" } };
    const handler = { prepare, ask, file }[kind];
    const response = await handler(request("u_ananya", "/api/" + kind, body)); expect(response.status).toBe(200);
    const { taskId } = await response.json();
    const row = await env.DB.prepare("SELECT user_id,input FROM tasks WHERE id=?").bind(taskId).first<{ user_id: string; input: string }>();
    expect(row?.user_id).toBe("u_ananya"); expect(row?.input).not.toContain("Ananya Rao");
    const context = { params: Promise.resolve({ id: taskId }) };
    expect((await task(request("u_olena", "/api/agent/tasks/" + taskId), context)).status).toBe(404);
    expect((await events(request("u_olena", "/api/agent/tasks/" + taskId + "/events"), context)).status).toBe(404);
    expect((await task(request("u_ananya", "/api/agent/tasks/" + taskId), context)).status).toBe(200);
  });
});
