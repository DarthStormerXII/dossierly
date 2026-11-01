import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSession, verifyEmailCode } from "../../src/lib/client/api";
import { emailError, requestEmailCode } from "../../src/lib/client/email-auth";

const fetchMock = vi.fn();
const challenge = { challengeId: "email-qa-challenge", expiresIn: 600, resendAfter: 60 };
const account = {
  accountId: "email-qa-account", accountKind: "email", activeCase: "own",
  plan: { kind: "free", creditsLeft: 0 }, planChosen: false, lettersUsed: 0, freeLetters: 3,
};
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("email client boundary", () => {
  it.each(["", "ananya", "ananya@", "ananya@example.com\nBCC:other@example.com"])("rejects invalid email %j before a request", async (email) => {
    expect(await requestEmailCode(email)).toMatchObject({ ok: false, code: "invalid_email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims email and uses the agreed request contract", async () => {
    fetchMock.mockResolvedValue(Response.json(challenge));
    expect(await requestEmailCode(" ananya.rao@example.com ")).toEqual({ ok: true, data: challenge });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/email/request", expect.objectContaining({
      method: "POST", credentials: "same-origin", body: JSON.stringify({ email: "ananya.rao@example.com" }),
    }));
  });

  it.each([null, {}, { ...challenge, challengeId: "" }, { ...challenge, resendAfter: -1 }])("rejects a malformed successful challenge %j", async (response) => {
    fetchMock.mockResolvedValue(Response.json(response));
    expect(await requestEmailCode("ananya.rao@example.com")).toMatchObject({ ok: false, code: "email_unavailable" });
  });

  it.each(["", "12345", "1234567", "12345a"])("rejects invalid code %j before a request", async (code) => {
    expect(await verifyEmailCode(challenge.challengeId, code)).toMatchObject({ ok: false, code: "invalid_code" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies the challenge and primes the account session", async () => {
    fetchMock.mockResolvedValue(Response.json(account));
    expect(await verifyEmailCode(challenge.challengeId, "123456")).toEqual({ ok: true, data: account });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/email/verify", expect.objectContaining({
      method: "POST", credentials: "same-origin", body: JSON.stringify({ challengeId: challenge.challengeId, code: "123456" }),
    }));
    expect(await ensureSession()).toMatchObject({ ok: true, data: { accountId: account.accountId, accountKind: "email", userId: account.accountId } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed account instead of routing to a broken session", async () => {
    fetchMock.mockResolvedValue(Response.json({ accountKind: "email" }));
    expect(await verifyEmailCode(challenge.challengeId, "123456")).toMatchObject({ ok: false, status: 502 });
  });

  it.each(["invalid_code", "expired_code", "too_many_attempts", "rate_limited", "email_unavailable"])("preserves %s and hides provider errors", async (code) => {
    fetchMock.mockResolvedValue(Response.json({ code, error: "provider secret details" }, { status: 400 }));
    const result = await verifyEmailCode(challenge.challengeId, "123456");
    expect(result).toMatchObject({ ok: false, code });
    if (!result.ok) expect(emailError(result)).not.toContain("provider secret details");
  });

  it("maps non-JSON outages and offline failures to friendly messages", async () => {
    fetchMock.mockResolvedValueOnce(new Response("internal error", { status: 503 })).mockRejectedValueOnce(new TypeError("offline"));
    const outage = await requestEmailCode("ananya.rao@example.com");
    expect(outage.ok).toBe(false);
    if (!outage.ok) expect(emailError(outage)).toContain("try again in a few minutes");
    const offline = await requestEmailCode("ananya.rao@example.com");
    expect(offline.ok).toBe(false);
    if (!offline.ok) expect(emailError(offline)).toContain("Check your connection");
  });
});
