import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import type { Env } from "./env";
import { ApiError } from "./http";
import { createAccountUser, sessionCookie } from "./session";
import { b64url, fromBase64, randomId } from "./util";

const CHALLENGE_TTL = 300;
const RP_NAME = "Dossierly";

/** RP ID is the hostname of APP_URL; locally (or when APP_URL is unset) it follows the request origin. */
export function relyingParty(env: Env, req: Request): { rpID: string; origin: string } {
  const base = env.APP_ENV === "local" || !env.APP_URL ? new URL(req.url).origin : env.APP_URL;
  const u = new URL(base);
  return { rpID: u.hostname, origin: u.origin };
}

type Pending = { challenge: string; userId?: string };

async function saveChallenge(env: Env, kind: "reg" | "login", id: string, value: Pending) {
  await env.CACHE.put(`wa:${kind}:${id}`, JSON.stringify(value), { expirationTtl: CHALLENGE_TTL });
}

/** Single-use: the challenge is deleted as soon as it is read. */
async function takeChallenge(env: Env, kind: "reg" | "login", id: string): Promise<Pending> {
  const raw = await env.CACHE.get(`wa:${kind}:${id}`);
  if (!raw) throw new ApiError(400, "That sign-in attempt expired. Try again.", "challenge_expired");
  await env.CACHE.delete(`wa:${kind}:${id}`);
  return JSON.parse(raw) as Pending;
}

export async function registerOptions(env: Env, req: Request, label?: string) {
  const { rpID } = relyingParty(env, req);
  const pendingId = randomId("u", 15);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: label?.trim() || `Dossierly account ${pendingId.slice(2, 8)}`,
    userID: new TextEncoder().encode(pendingId) as Uint8Array<ArrayBuffer>,
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await saveChallenge(env, "reg", pendingId, { challenge: options.challenge, userId: pendingId });
  return { pendingId, options };
}

export async function registerVerify(env: Env, req: Request, pendingId: string, response: RegistrationResponseJSON) {
  const pending = await takeChallenge(env, "reg", pendingId);
  const { rpID, origin } = relyingParty(env, req);
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response, expectedChallenge: pending.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false,
    });
  } catch {
    throw new ApiError(400, "We could not verify that passkey", "passkey_invalid");
  }
  if (!verified.verified) throw new ApiError(400, "We could not verify that passkey", "passkey_invalid");
  const cred = verified.registrationInfo.credential;
  const taken = await env.DB.prepare("SELECT 1 AS x FROM webauthn_credentials WHERE id = ?").bind(cred.id).first();
  if (taken) throw new ApiError(409, "That passkey is already registered. Sign in instead.", "passkey_exists");
  const userId = pendingId;
  await createAccountUser(env, userId, "passkey");
  await env.DB.prepare(
    "INSERT INTO webauthn_credentials (id, user_id, public_key, counter, transports, created_at) VALUES (?,?,?,?,?,?)",
  ).bind(cred.id, userId, b64url(cred.publicKey), cred.counter, JSON.stringify(cred.transports ?? []), Date.now()).run();
  return { userId, cookie: await sessionCookie(userId, env) };
}

export async function loginOptions(env: Env, req: Request) {
  const { rpID } = relyingParty(env, req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
  const challengeId = randomId("c", 12);
  await saveChallenge(env, "login", challengeId, { challenge: options.challenge });
  return { challengeId, options };
}

type CredRow = { id: string; user_id: string; public_key: string; counter: number; transports: string | null };

export async function loginVerify(env: Env, req: Request, challengeId: string, response: AuthenticationResponseJSON) {
  const pending = await takeChallenge(env, "login", challengeId);
  const row = await env.DB.prepare(
    "SELECT id, user_id, public_key, counter, transports FROM webauthn_credentials WHERE id = ?",
  ).bind(response.id).first<CredRow>();
  if (!row) throw new ApiError(401, "No account uses this passkey. Create an account first.", "passkey_unknown");
  const { rpID, origin } = relyingParty(env, req);
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: row.id,
        publicKey: fromBase64(row.public_key) as Uint8Array<ArrayBuffer>,
        counter: row.counter,
        transports: row.transports ? (JSON.parse(row.transports) as []) : undefined,
      },
    });
  } catch {
    throw new ApiError(401, "We could not verify that passkey", "passkey_invalid");
  }
  if (!verified.verified) throw new ApiError(401, "We could not verify that passkey", "passkey_invalid");
  await env.DB.prepare("UPDATE webauthn_credentials SET counter = ? WHERE id = ?").bind(verified.authenticationInfo.newCounter, row.id).run();
  return { userId: row.user_id, cookie: await sessionCookie(row.user_id, env) };
}
