import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderCaseMemory } from "../../src/lib/agent/case-memory.ts";
import { fillPrompt } from "../../src/lib/agent/prompt.ts";
import { ResultSchemas } from "../../src/lib/agent/schemas.ts";
import { addTimelineLine, extractJson } from "./json.mjs";
import { memoryHash, readMemory, runDcode, stageFiles } from "./sandbox.mjs";
import { nemo } from "./shell.mjs";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const est = (s) => Math.ceil(String(s).length / 4);

/** Reads /sandbox/task/answer.json written by the agent; null when absent or empty. */
async function readAnswerFile(sandbox) {
  const r = await nemo([sandbox, "exec", "--no-tty", "--timeout", "20", "--", "cat", "/sandbox/task/answer.json"], { timeoutMs: 40_000 });
  const out = String(r.stdout ?? "");
  const at = out.indexOf("{");
  return r.code === 0 && at >= 0 ? out.slice(at).trim() : null;
}

function promptFor(cfg, kind, language, retryNote) {
  const base = fillPrompt(readFileSync(join(cfg.appDir, "agent/prompts", `${kind}.md`), "utf8"), language);
  return retryNote ? `${base}\n\nYour previous answer was rejected: ${retryNote}. Answer again with only the corrected JSON object.` : base;
}

/** Runs one task inside the user's own sandbox and returns the /api/bridge/result payload. */
export async function runTask(task, { cfg, pool, mask }, log) {
  const trace = [];
  const mark = (step, t0, tool) => trace.push({ step, ...(tool ? { tool } : {}), ms: Date.now() - t0 });
  const started = Date.now();
  let lease;
  try {
    let t = Date.now();
    lease = await pool.acquire(task.userId);
    mark(`${lease.fresh ? "assigned" : "found"} your private sandbox${lease.started ? " (started it)" : ""}`, t, "nemoclaw");
    const { sandbox } = lease;
    const { passages = [], skill, ...input } = task.input;
    const masked = mask ? await mask(input) : { input, count: undefined };
    t = Date.now();
    const files = { "input.json": JSON.stringify(masked.input), "passages.json": JSON.stringify(passages) };
    if (skill) files["skill.md"] = skill;
    await stageFiles(sandbox, files, renderCaseMemory(masked.input.case ?? task.input.case));
    mark("uploaded your case and the official sources", t, "nemo-deepagents upload");

    const language = task.input.language ?? "en";
    const before = task.kind === "file" ? await memoryHash(sandbox) : "";
    let retryNote;
    let result;
    let durationMs = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      t = Date.now();
      const prompt = promptFor(cfg, task.kind, language, retryNote);
      const r = await runDcode(sandbox, prompt, cfg.dcodeTimeoutS);
      mark(attempt ? "agent retried" : "agent worked on your case", t, "dcode");
      if (!r.ok) { retryNote = r.error; continue; }
      durationMs += r.durationMs || Date.now() - t;
      tokensIn += est(prompt) + est(JSON.stringify(files));
      tokensOut += est(r.response);
      try {
        // Deep Agents is a coding agent: it writes its answer to a file and often ends with prose, so prefer the file.
        const answer = await readAnswerFile(sandbox);
        if (!answer && !String(r.response).includes("{")) {
          log?.(`attempt ${attempt + 1}: reply ${String(r.response).length} chars, no JSON, no answer file`);
          // An empty reply is a runtime hiccup, not a model answer: pause briefly before the next attempt.
          if (!String(r.response).trim()) await new Promise((res) => setTimeout(res, 3000));
        }
        const parsed = ResultSchemas[task.kind].safeParse(extractJson(answer ?? r.response));
        if (parsed.success) result = parsed.data;
        else retryNote = `${parsed.error.issues[0].path.join(".") || "answer"}: ${parsed.error.issues[0].message}`;
      } catch (e) {
        retryNote = e instanceof Error ? e.message : "not JSON";
      }
    }
    if (!result) throw new Error(`the agent did not return a valid answer (${retryNote})`);

    if (task.kind === "file") {
      t = Date.now();
      if ((await memoryHash(sandbox)) === before) {
        // The agent said it filed the event but did not touch the file: write the line deterministically.
        const ev = task.input.event;
        const [, m, d] = ev.date.split("-").map(Number);
        const next = addTimelineLine(await readMemory(sandbox), `- ${d} ${SHORT[m - 1]}: ${ev.title}${ev.summary ? ` - ${ev.summary.slice(0, 200)}` : ""}`);
        const dir = mkdtempSync(join(tmpdir(), "settla-mem-"));
        try {
          writeFileSync(join(dir, "case.md"), next, { mode: 0o600 });
          await nemo([sandbox, "upload", join(dir, "case.md"), "/sandbox/case.md"], { timeoutMs: 60_000 });
        } finally { rmSync(dir, { recursive: true, force: true }); }
        mark("memory file updated by the bridge (agent had not saved it)", t);
      } else {
        mark("verified: your agent's memory file changed", t, "sha256sum");
      }
      result = { ...result, memoryUpdated: true, filed: true };
    }
    return {
      payload: { taskId: task.id, ok: true, sandbox, result, trace, durationMs: durationMs || Date.now() - started, masked: masked.count, tokensIn, tokensOut },
      sandbox,
      release: lease.release,
    };
  } catch (err) {
    log("task failed", task.id, err instanceof Error ? err.message : String(err));
    return {
      payload: {
        taskId: task.id, ok: false, sandbox: lease?.sandbox ?? "none", error: (err instanceof Error ? err.message : "task failed").slice(0, 300),
        trace, durationMs: Date.now() - started, tokensIn: 0, tokensOut: 0,
      },
      sandbox: lease?.sandbox,
      release: lease?.release,
    };
  }
}
