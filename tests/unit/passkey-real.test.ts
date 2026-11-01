import { describe, expect, it } from "vitest";
import { registerOptions as makeRegOptions, registerVerify as checkReg, loginOptions as makeLoginOptions, loginVerify as checkLogin } from "@/lib/server/passkey";
import { getEnv } from "@/lib/server/env";
import { authResponse } from "@/lib/server/authguard";
import { errorResponse } from "@/lib/server/http";
import { GET as meRoute } from "@/app/api/me/route";
import { b64url, fromBase64 } from "@/lib/server/util";

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

/* A software authenticator (ES256, "none" attestation) so the real @simplewebauthn/server verifies a full ceremony. */
const enc = new TextEncoder();
const cat = (...p: Uint8Array[]) => Uint8Array.from(p.flatMap((x) => [...x]));
const bytes = (n: number[]) => Uint8Array.from(n);
const sha256 = async (d: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", d as BufferSource));
const cborBytes = (b: Uint8Array) => (b.length < 256 ? cat(bytes([0x58, b.length]), b) : cat(bytes([0x59, b.length >> 8, b.length & 255]), b));
const cborText = (s: string) => cat(bytes([0x60 | s.length]), enc.encode(s));
const u32 = (n: number) => bytes([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const derInt = (v: Uint8Array) => {
  let i = 0;
  while (i < v.length - 1 && v[i] === 0) i++;
  const t = v.slice(i);
  const b = t[0] & 0x80 ? cat(bytes([0]), t) : t;
  return cat(bytes([2, b.length]), b);
};

async function authenticator(origin: string, rpID: string) {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const x = fromBase64(jwk.x!), y = fromBase64(jwk.y!);
  const credId = crypto.getRandomValues(new Uint8Array(16));
  const rpHash = await sha256(enc.encode(rpID));
  let counter = 0;
  const clientData = (type: string, challenge: string) => enc.encode(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  return {
    id: b64url(credId),
    async create(challenge: string) {
      const cose = cat(bytes([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21]), cborBytes(x), bytes([0x22]), cborBytes(y));
      const authData = cat(rpHash, bytes([0x45]), u32(0), new Uint8Array(16), bytes([0, credId.length]), credId, cose);
      const att = cat(bytes([0xa3]), cborText("fmt"), cborText("none"), cborText("attStmt"), bytes([0xa0]), cborText("authData"), cborBytes(authData));
      return { id: b64url(credId), rawId: b64url(credId), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64url(clientData("webauthn.create", challenge)), attestationObject: b64url(att), transports: ["internal"] } };
    },
    async get(challenge: string) {
      counter += 1;
      const cd = clientData("webauthn.get", challenge);
      const authData = cat(rpHash, bytes([0x05]), u32(counter));
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, cat(authData, await sha256(cd)) as BufferSource));
      const der = (() => { const body = cat(derInt(raw.slice(0, 32)), derInt(raw.slice(32))); return cat(bytes([0x30, body.length]), body); })();
      return { id: b64url(credId), rawId: b64url(credId), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64url(cd), authenticatorData: b64url(authData), signature: b64url(der), userHandle: b64url(enc.encode("u")) } };
    },
  };
}

const post = (path: string, body: unknown) =>
  new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("real WebAuthn ceremony (software authenticator, no mocks)", () => {
  it("registers, signs in again, and rejects a replayed or forged assertion", async () => {
    const auth = await authenticator("http://localhost:3000", "localhost");
    const o = await (await regOptions(post("/api/auth/passkey/register/options", {}))).json();
    const reg = await regVerify(post("/api/auth/passkey/register/verify", { pendingId: o.pendingId, response: await auth.create(o.options.challenge) }));
    expect(reg.status).toBe(200);
    const accountId = (await reg.json()).accountId;

    const l = await (await loginOptions(post("/api/auth/passkey/login/options", {}))).json();
    expect(l.options.allowCredentials ?? []).toEqual([]);
    const assertion = await auth.get(l.options.challenge);
    const ok = await loginVerify(post("/api/auth/passkey/login/verify", { challengeId: l.challengeId, response: assertion }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).accountId).toBe(accountId);
    const cookie = ok.headers.get("set-cookie")!.split(";")[0];
    expect((await meRoute(new Request("http://x/api/me", { headers: { cookie } }))).status).toBe(200);

    // The same assertion cannot be replayed (challenge is single use; counter must increase).
    const replay = await loginVerify(post("/api/auth/passkey/login/verify", { challengeId: l.challengeId, response: assertion }));
    expect(replay.status).toBe(400);

    // An assertion for a different challenge fails verification and sets no cookie.
    const l2 = await (await loginOptions(post("/api/auth/passkey/login/options", {}))).json();
    const wrong = await loginVerify(post("/api/auth/passkey/login/verify", { challengeId: l2.challengeId, response: await auth.get("AAAAAAAAAAAAAAAAAAAAAA") }));
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });
});
