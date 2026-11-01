import { beforeEach, describe, expect, it, vi } from "vitest";

const sw = vi.hoisted(() => ({
  regVerified: true,
  authVerified: true,
  credId: "cred-abc",
  newCounter: 7,
  lastReg: undefined as Record<string, unknown> | undefined,
  lastAuth: undefined as Record<string, unknown> | undefined,
}));
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: async (o: { rpID: string; userID: Uint8Array }) => ({ challenge: "reg-challenge", rp: { id: o.rpID, name: "Dossierly" }, user: { id: "x" } }),
  generateAuthenticationOptions: async (o: { rpID: string }) => ({ challenge: "login-challenge", rpId: o.rpID, allowCredentials: undefined }),
  verifyRegistrationResponse: async (o: Record<string, unknown>) => {
    sw.lastReg = o;
    if (!sw.regVerified) return { verified: false };
    return { verified: true, registrationInfo: { credential: { id: sw.credId, publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] } } };
  },
  verifyAuthenticationResponse: async (o: Record<string, unknown>) => {
    sw.lastAuth = o;
    return { verified: sw.authVerified, authenticationInfo: { newCounter: sw.newCounter } };
  },
}));

import { registerOptions as makeRegOptions, registerVerify as checkReg, loginOptions as makeLoginOptions, loginVerify as checkLogin } from "@/lib/server/passkey";
import { authResponse } from "@/lib/server/authguard";
import { errorResponse } from "@/lib/server/http";
import { GET as meRoute } from "@/app/api/me/route";
import { getEnv } from "@/lib/server/env";

async function regOptions(req: Request) { return Response.json(await makeRegOptions(getEnv(), req)); }
async function loginOptions(req: Request) { return Response.json(await makeLoginOptions(getEnv(), req)); }
async function regVerify(req: Request) {
  try { const b = await req.json(); const r = await checkReg(getEnv(), req, b.pendingId, b.response); return authResponse(getEnv(), r.userId, r.cookie); }
  catch (e) { return errorResponse(e); }
}
async function loginVerify(req: Request) {
  try { const b = await req.json(); const r = await checkLogin(getEnv(), req, b.challengeId, b.response); return authResponse(getEnv(), r.userId, r.cookie); }
  catch (e) { return errorResponse(e); }
}

const post = (path: string, body: unknown, cookie?: string) =>
  new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
const cred = (id: string) => ({ id, rawId: id, type: "public-key", response: {}, clientExtensionResults: {} });

beforeEach(() => { sw.regVerified = true; sw.authVerified = true; sw.newCounter = 7; });

async function register(id: string) {
  sw.credId = id;
  const o = await (await regOptions(post("/api/auth/passkey/register/options", {}))).json();
  return regVerify(post("/api/auth/passkey/register/verify", { pendingId: o.pendingId, response: cred(id) }));
}

describe("passkey registration", () => {
  it("issues options for a pending user id, verifies, stores the credential and signs in", async () => {
    const o = await (await regOptions(post("/api/auth/passkey/register/options", {}))).json();
    expect(o.pendingId).toMatch(/^u_/);
    expect(o.options.rp.id).toBe("localhost");
    sw.credId = "cred-1";
    const res = await regVerify(post("/api/auth/passkey/register/verify", { pendingId: o.pendingId, response: cred("cred-1") }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ accountId: o.pendingId, accountKind: "passkey", planChosen: false });
    expect(sw.lastReg).toMatchObject({ expectedChallenge: "reg-challenge", expectedOrigin: "http://localhost:3000", expectedRPID: "localhost" });
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    expect((await meRoute(new Request("http://x/api/me", { headers: { cookie } }))).status).toBe(200);
    const row = await getEnv().DB.prepare("SELECT user_id, counter, public_key FROM webauthn_credentials WHERE id = ?").bind("cred-1").first<{ user_id: string; public_key: string }>();
    expect(row!.user_id).toBe(o.pendingId);
    expect(row!.public_key).toBe("AQID");
  });

  it("challenges are single use, and an unknown or expired one is rejected", async () => {
    const o = await (await regOptions(post("/api/auth/passkey/register/options", {}))).json();
    sw.credId = "cred-2";
    expect((await regVerify(post("/api/auth/passkey/register/verify", { pendingId: o.pendingId, response: cred("cred-2") }))).status).toBe(200);
    const again = await regVerify(post("/api/auth/passkey/register/verify", { pendingId: o.pendingId, response: cred("cred-2") }));
    expect(again.status).toBe(400);
    expect((await again.json()).code).toBe("challenge_expired");
  });

  it("a failed verification creates no account", async () => {
    const o = await (await regOptions(post("/api/auth/passkey/register/options", {}))).json();
    sw.regVerified = false;
    const res = await regVerify(post("/api/auth/passkey/register/verify", { pendingId: o.pendingId, response: cred("cred-3") }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("passkey_invalid");
    const row = await getEnv().DB.prepare("SELECT id FROM users WHERE id = ?").bind(o.pendingId).first();
    expect(row).toBeNull();
  });


});

describe("passkey login", () => {
  it("signs in the credential's user and bumps the counter", async () => {
    const reg = await register("cred-login");
    const accountId = (await reg.json()).accountId;
    const o = await (await loginOptions(post("/api/auth/passkey/login/options", {}))).json();
    expect(o.options.allowCredentials).toBeUndefined();
    const res = await loginVerify(post("/api/auth/passkey/login/verify", { challengeId: o.challengeId, response: cred("cred-login") }));
    expect(res.status).toBe(200);
    expect((await res.json()).accountId).toBe(accountId);
    expect(res.headers.get("set-cookie")).toMatch(/^settla_uid=/);
    expect((sw.lastAuth as { credential: { counter: number } }).credential.counter).toBe(0);
    const row = await getEnv().DB.prepare("SELECT counter FROM webauthn_credentials WHERE id = ?").bind("cred-login").first<{ counter: number }>();
    expect(row!.counter).toBe(7);
  });

  it("rejects an unknown credential and a failed assertion without setting a cookie", async () => {
    await register("cred-known");
    let o = await (await loginOptions(post("/api/auth/passkey/login/options", {}))).json();
    let res = await loginVerify(post("/api/auth/passkey/login/verify", { challengeId: o.challengeId, response: cred("nobody") }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("passkey_unknown");
    o = await (await loginOptions(post("/api/auth/passkey/login/options", {}))).json();
    sw.authVerified = false;
    res = await loginVerify(post("/api/auth/passkey/login/verify", { challengeId: o.challengeId, response: cred("cred-known") }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
