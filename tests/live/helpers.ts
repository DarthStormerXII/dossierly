import { appendFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";

export const SCRATCH = process.env.LIVE_DIR ?? "test-results/live";
mkdirSync(SCRATCH, { recursive: true });
export const EVIDENCE = path.join(SCRATCH, "evidence.jsonl");
export const SAMPLE_PNG = path.resolve(__dirname, "../../public/sample/wezwanie-sample.png");
export const SAMPLE_PDF = path.join(SCRATCH, "wezwanie-sample.pdf");

export const note = (kind: string, data: unknown) => appendFileSync(EVIDENCE, `${JSON.stringify({ t: new Date().toISOString(), kind, data })}\n`);

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCRATCH, `${name}.png`), fullPage: true });
}

/** Logs every /api/* response (status, timing, model run info) to the evidence file. */
export function recordApi(page: Page, tag: string) {
  const starts = new Map<string, number>();
  page.on("request", (r) => r.url().includes("/api/") && starts.set(r.url() + r.method(), Date.now()));
  page.on("response", async (res) => {
    const u = new URL(res.url());
    if (!u.pathname.startsWith("/api/")) return;
    const ms = Date.now() - (starts.get(res.url() + res.request().method()) ?? Date.now());
    let runs: unknown;
    let extra: Record<string, unknown> = {};
    try {
      const b = (await res.json()) as Record<string, unknown>;
      runs = b.runs ?? b.run;
      if (!res.ok()) extra = { error: b.error, code: b.code };
      if (u.pathname.startsWith("/api/agent/tasks/") && b.status === "done") extra = { ranOn: b.ranOn, sandbox: b.sandbox, trace: b.trace };
    } catch {
      /* not json */
    }
    note("api", { tag, method: res.request().method(), path: u.pathname, status: res.status(), ms, runs, ...extra });
  });
}

/** JPEG-in-PDF, hand built, so the PDF-rendering path in the browser is exercised with no extra dependency (uses macOS sips for the JPEG). */
export function makeSamplePdf(): string {
  if (existsSync(SAMPLE_PDF)) return SAMPLE_PDF;
  const jpg = path.join(SCRATCH, "wezwanie-sample.jpg");
  const r = spawnSync("sips", ["-s", "format", "jpeg", SAMPLE_PNG, "--out", jpg]);
  if (r.status !== 0) throw new Error("sips failed");
  const img = readFileSync(jpg);
  const W = 892, H = 900;
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Buffer | string) => { const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b; parts.push(buf); len += buf.length; };
  const obj = (n: number, body: Buffer | string) => { offsets[n] = len; push(`${n} 0 obj\n`); push(body); push("\nendobj\n"); };
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = len;
  push("4 0 obj\n");
  push(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`);
  push(img);
  push("\nendstream\nendobj\n");
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  writeFileSync(SAMPLE_PDF, Buffer.concat(parts));
  return SAMPLE_PDF;
}

export async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

export async function newPage(context: BrowserContext, tag: string) {
  const page = await context.newPage();
  recordApi(page, tag);
  page.on("pageerror", (e) => note("pageerror", { tag, msg: e.message }));
  return page;
}
