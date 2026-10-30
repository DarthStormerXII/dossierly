import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nemo } from "./shell.mjs";

/** Stages the task files on the host, then uploads them: /sandbox/task/* (and /sandbox/case.md when absent). */
export async function stageFiles(name, files, memoryIfMissing) {
  const dir = mkdtempSync(join(tmpdir(), "settla-task-"));
  try {
    mkdirSync(join(dir, "task"));
    for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, "task", file), text, { mode: 0o600 });
    const wipe = await nemo([name, "exec", "--no-tty", "--timeout", "30", "--", "sh", "-c", "rm -rf /sandbox/task"], { timeoutMs: 45_000 });
    if (wipe.code !== 0) throw new Error("could not reset the task folder");
    const up = await nemo([name, "upload", join(dir, "task"), "/sandbox/"], { timeoutMs: 60_000 });
    if (up.code !== 0) throw new Error("upload to the sandbox failed");
    if (memoryIfMissing) {
      const has = await nemo([name, "exec", "--no-tty", "--timeout", "20", "--", "test", "-s", "/sandbox/case.md"], { timeoutMs: 30_000 });
      if (has.code !== 0) {
        writeFileSync(join(dir, "case.md"), memoryIfMissing, { mode: 0o600 });
        const m = await nemo([name, "upload", join(dir, "case.md"), "/sandbox/case.md"], { timeoutMs: 60_000 });
        if (m.code !== 0) throw new Error("could not write the first memory file");
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function memoryHash(name) {
  const r = await nemo([name, "exec", "--no-tty", "--timeout", "20", "--", "sh", "-c", "sha256sum /sandbox/case.md 2>/dev/null | cut -d' ' -f1"], { timeoutMs: 30_000 });
  return r.stdout.trim().split("\n").pop() || "";
}

export async function readMemory(name) {
  const r = await nemo([name, "exec", "--no-tty", "--timeout", "20", "--", "cat", "/sandbox/case.md"], { timeoutMs: 30_000 });
  return r.code === 0 ? r.stdout : "";
}

/**
 * Headless dcode run. Returns { ok, response, durationMs, threadId, error }. The prompt carries no personal data: it
 * points at files. With `resumeId` the message continues that thread, keeping everything the agent already read.
 */
export async function runDcode(name, prompt, timeoutS, resumeId) {
  const resume = resumeId ? ["-r", resumeId] : [];
  const r = await nemo([name, "exec", "--no-tty", "--timeout", String(timeoutS), "--", "dcode", ...resume, "-n", prompt, "--json"], { timeoutMs: (timeoutS + 20) * 1000 });
  const line = r.stdout.split("\n").reverse().find((l) => l.trim().startsWith("{") && l.includes('"data"'));
  if (!line) return { ok: false, error: r.timedOut ? "dcode timed out" : `dcode produced no result (exit ${r.code})` };
  try {
    const j = JSON.parse(line);
    if (j.data?.status !== "success") return { ok: false, error: `dcode status ${j.data?.status ?? "unknown"}` };
    return { ok: true, response: String(j.data.response ?? ""), durationMs: j.data.completion?.duration_ms ?? 0, threadId: j.data.completion?.thread_id };
  } catch {
    return { ok: false, error: "dcode output was not JSON" };
  }
}
