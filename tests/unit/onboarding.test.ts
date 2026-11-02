import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingRequestSchema } from "@/lib/onboarding/schema";
import { getOnboarding, updateOnboarding } from "@/lib/server/onboarding";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { freshLocalEnv } from "@/lib/server/local";
import { createAccountUser, sessionCookie } from "@/lib/server/session";
import * as environment from "@/lib/server/env";
import { GET, POST } from "@/app/api/onboarding/route";

let env = freshLocalEnv();
beforeEach(async () => {
  env = freshLocalEnv(); vi.spyOn(environment, "getEnv").mockReturnValue(env);
  await createAccountUser(env, "u_ananya", "device"); await createAccountUser(env, "u_olena", "device");
});
afterEach(() => vi.restoreAllMocks());
const progress = (expectedRevision = 0) => OnboardingRequestSchema.options[0].parse({ action: "progress", expectedRevision, step: 4, language: "vi", needs: ["letters", "documents", "deadlines"], reviewedNeeds: [] });
const complete = (expectedRevision = 1) => OnboardingRequestSchema.options[1].parse({ action: "complete", expectedRevision, confirmed: true, caseId: "case-4a68e2", language: "vi", needs: ["letters", "documents", "deadlines"], reviewedNeeds: ["letters", "documents", "deadlines"] });
const req = async (user: string, body?: unknown) => new Request("http://localhost:3000/api/onboarding", {
  method: body ? "POST" : "GET", headers: { cookie: (await sessionCookie(user, env)).split(";")[0], origin: "http://localhost:3000", "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
});

describe("owned onboarding lifecycle", () => {
  it("does not create or complete progress merely by visiting; never guesses from old account age", async () => {
    await env.DB.prepare("UPDATE users SET created_at=1,letters_used=2,active_case='own' WHERE id='u_ananya'").run();
    const response = await GET(await req("u_ananya"));
    expect(await response.json()).toMatchObject({ status: "new", step: 1, revision: 0, deviceOnly: true });
    expect(await env.DB.prepare("SELECT * FROM onboarding_progress").first()).toBeNull();
  });
  it("resumes metadata for the right account and persists no profile or letter data", async () => {
    const response = await POST(await req("u_ananya", progress()));
    expect(response.status).toBe(200);
    expect(await getOnboarding(env, "u_ananya")).toMatchObject({ status: "in_progress", revision: 1, language: "vi", step: 4 });
    expect(await getOnboarding(env, "u_olena")).toMatchObject({ status: "new", revision: 0 });
    const row = await env.DB.prepare("SELECT * FROM onboarding_progress WHERE account_id='u_ananya'").first();
    expect(Object.keys(row!)).not.toEqual(expect.arrayContaining(["name", "letter", "transcript", "case", "address"]));
    expect(OnboardingRequestSchema.safeParse({ ...progress(), name: "Ananya Rao" }).success).toBe(false);
  });
  it("requires explicit confirmation and all selected priorities before completing an own case", async () => {
    await expect(updateOnboarding(env, "u_ananya", complete(0))).rejects.toMatchObject({ code: "incomplete_setup" });
    await updateOnboarding(env, "u_ananya", progress());
    await expect(updateOnboarding(env, "u_ananya", { ...complete(), reviewedNeeds: ["letters"] })).rejects.toMatchObject({ code: "incomplete_setup" });
    expect(OnboardingRequestSchema.safeParse({ ...complete(), caseId: "case-sample-arjun" }).success).toBe(false);
    expect(OnboardingRequestSchema.safeParse({ ...complete(), confirmed: false }).success).toBe(false);
    const state = await updateOnboarding(env, "u_ananya", complete());
    expect(state).toMatchObject({ status: "completed", caseId: "case-4a68e2", revision: 2 });
    expect(state.completedAt).toBeTruthy();
    await expect(updateOnboarding(env, "u_ananya", progress(2))).rejects.toMatchObject({ code: "already_completed" });
  });
  it("rejects stale/concurrent changes and unselected reviews", async () => {
    const results = await Promise.allSettled([updateOnboarding(env, "u_ananya", progress()), updateOnboarding(env, "u_ananya", progress())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(updateOnboarding(env, "u_ananya", progress())).rejects.toMatchObject({ code: "revision_conflict" });
    await expect(updateOnboarding(env, "u_ananya", { ...progress(1), reviewedNeeds: ["updates"] })).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("adopts a confirmed existing own case and restarts only explicitly without deleting any cases or account data", async () => {
    const adopted = await updateOnboarding(env, "u_ananya", OnboardingRequestSchema.parse({ action: "adopt_existing", expectedRevision: 0, caseId: "case-older-01", confirmed: true }));
    expect(adopted.status).toBe("completed");
    const restarted = await updateOnboarding(env, "u_ananya", { action: "restart", expectedRevision: 1, confirmed: true });
    expect(restarted).toMatchObject({ status: "in_progress", caseId: null, completedAt: null, revision: 2 });
    expect(await env.DB.prepare("SELECT id FROM users WHERE id='u_ananya'").first()).toBeTruthy();
  });
  it("refuses anonymous and cross-origin mutations with sanitized errors", async () => {
    const anonymous = await GET(new Request("http://localhost:3000/api/onboarding"));
    expect(anonymous.status).toBe(401);
    const evil = new Request(await req("u_ananya", progress()), { headers: { origin: "https://attacker.example", "content-type": "application/json" } });
    const response = await POST(evil); expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "invalid_origin" });
  });
});

describe("JSON and origin boundaries", () => {
  it("requires an explicit same-origin browser request in production", () => {
    const production = { ...env, APP_ENV: "production" as const, APP_URL: "https://dossierly.pages.dev" };
    expect(() => sameOrigin(new Request(production.APP_URL), production)).toThrow();
    expect(() => sameOrigin(new Request(production.APP_URL, { headers: { origin: production.APP_URL } }), production)).not.toThrow();
  });
  it("bounds bytes even when content length is absent and rejects malformed JSON and extra fields", async () => {
    await expect(boundedJson(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: " ".repeat(200) }), OnboardingRequestSchema, 100)).rejects.toMatchObject({ code: "too_large" });
    await expect(boundedJson(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }), OnboardingRequestSchema)).rejects.toMatchObject({ code: "invalid_json" });
  });
});
