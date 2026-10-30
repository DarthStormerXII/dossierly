import { expect, test } from "@playwright/test";
import { makeSamplePdf, newPage, note, shot } from "./helpers";

test.describe.configure({ mode: "serial" });

test("2c letters: PDF as the SAMPLE user reads successfully (PDF rendering in the browser)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: "https://dossierly.pages.dev" });
  const page = await newPage(context, "sample-pdf");
  await page.goto("/app?start=sample");
  await expect(page.getByRole("heading", { name: "Arjun's case", level: 1 })).toBeVisible({ timeout: 60_000 });
  await page.goto("/app/letters");
  const resp = page.waitForResponse((r) => r.url().endsWith("/api/letters/read"), { timeout: 60_000 });
  await page.locator('input[aria-label="Letter PDF or image"]').setInputFiles(makeSamplePdf());
  const r = await resp;
  const body = await r.json();
  note("sample-pdf-read", { status: r.status(), readable: body.letter?.readable, title: body.letter?.title, pagesBytes: r.request().postDataBuffer()?.length, run: body.run });
  expect(r.status()).toBe(200);
  await expect(page.getByLabel("Polish text, exactly as printed")).toBeVisible({ timeout: 120_000 });
  expect((await page.locator(".transcript-text").innerText()).length).toBeGreaterThan(40);
  await expect(page.locator(".page-thumbs img").first()).toBeVisible();
  await shot(page, "14-sample-pdf-read");
  await context.close();
});

test("6 speech: Meet degrades gracefully without SpeechRecognition; typing works; pl-PL voice check", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: "https://dossierly.pages.dev" });
  const natural = await context.newPage();
  await natural.goto("/");
  const env = await natural.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const voices = await new Promise<SpeechSynthesisVoice[]>((res) => {
      const get = () => speechSynthesis.getVoices();
      if (get().length) return res(get());
      speechSynthesis.onvoiceschanged = () => res(get());
      setTimeout(() => res(get()), 3000);
    });
    return { SpeechRecognition: typeof w.SpeechRecognition, webkitSpeechRecognition: typeof w.webkitSpeechRecognition, synth: "speechSynthesis" in window, voiceCount: voices.length, pl: voices.filter((v) => v.lang.toLowerCase().startsWith("pl")).map((v) => `${v.name} ${v.lang}`), sample: voices.slice(0, 5).map((v) => `${v.name} ${v.lang}`) };
  });
  note("speech-env", env);
  await natural.close();

  const page = await newPage(context, "speech");
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
  await page.goto("/app?start=sample");
  await expect(page.getByRole("heading", { name: "Arjun's case", level: 1 })).toBeVisible({ timeout: 60_000 });
  await page.goto("/app/meet");
  await expect(page.locator(".intro-pl")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("typing always works", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Start interpreting" }).click();
  const mic = page.locator(".half-official .talk");
  await expect(mic).toBeDisabled();
  await expect(mic).toContainText("Mikrofon niedostępny");
  await expect(page.locator(".half-user .talk")).toContainText("No speech input here");
  await expect(page.locator(".half-user .talk")).toBeDisabled();
  const user = page.locator(".half-user");
  await user.getByRole("button", { name: "Type" }).click();
  await user.getByPlaceholder("Type what you want to say").fill("Hello, I am here for my appointment.");
  await user.getByRole("button", { name: "Interpret" }).click();
  await expect(page.locator(".half-official .turn-trans").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".half-official .turn-trans").first()).not.toContainText("Tłumaczę");
  await shot(page, "15-speech-unavailable");
  await context.close();
});
