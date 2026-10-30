import { expect, test } from "@playwright/test";
import { newPage, note, shot } from "./helpers";

// Fresh own-case user (no model calls): device key -> passkey (virtual authenticator with PRF) -> reload/unlock -> delete everything.
test("3 passkey vault: virtual authenticator PRF upgrade, reload+unlock, delete everything", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: "https://dossierly.pages.dev" });
  const page = await newPage(context, "passkey");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Open a case file" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Your name").fill("Maya Kowalczyk-Test");
  await page.getByRole("button", { name: "Create my case" }).click();
  await expect(page.getByRole("heading", { name: "Maya's case" })).toBeVisible({ timeout: 30_000 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  let prf = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (cdp as any).send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true } });
  } catch (e) {
    prf = false;
    note("passkey-prf-option-rejected", { msg: String(e) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (cdp as any).send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  }
  await page.goto("/app/privacy");
  await expect(page.getByRole("heading", { name: "Your case on this device" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("random device key")).toBeVisible();
  await page.getByRole("button", { name: "Protect with a passkey" }).click();
  const outcome = await Promise.race([
    page.getByText("Encrypted with a key derived from your passkey").waitFor({ timeout: 30_000 }).then(() => "passkey"),
    page.getByText("cannot derive encryption keys").waitFor({ timeout: 30_000 }).then(() => "prf_unsupported"),
    page.getByText("Passkey setup was cancelled").waitFor({ timeout: 30_000 }).then(() => "cancelled"),
  ]);
  note("passkey-outcome", { outcome, prfOptionAccepted: prf });
  await shot(page, "11-passkey-upgraded");
  expect(outcome).toBe("passkey");
  const rec = await page.evaluate(() => new Promise<unknown>((resolve) => {
    const open = indexedDB.open("dossierly-vault");
    open.onsuccess = () => {
      const g = open.result.transaction("kv").objectStore("kv").get("key");
      g.onsuccess = () => resolve(g.result && { kind: g.result.kind, hasKeyObject: "key" in g.result });
    };
  }));
  note("passkey-record", rec);
  expect(rec).toEqual({ kind: "passkey", hasKeyObject: false });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Unlock your case" })).toBeVisible({ timeout: 30_000 });
  await shot(page, "12-locked");
  await page.getByRole("button", { name: "Unlock with passkey" }).click();
  // The reload happened on /app/privacy, so unlocking returns there; then open the case via client navigation.
  await expect(page.getByText("Encrypted with a key derived from your passkey")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Case", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Maya's case" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No deadline is running.")).toBeVisible();
  await page.getByRole("link", { name: "Privacy" }).first().click();

  await page.getByRole("button", { name: "Delete my case from this device" }).click();
  await page.getByRole("button", { name: "Yes, delete my case" }).click();
  await expect(page.getByRole("heading", { name: "Open a case file" })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Open a case file" })).toBeVisible({ timeout: 30_000 });
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  note("after-delete", { dbs });
  await shot(page, "13-after-delete");
  await context.close();
});
