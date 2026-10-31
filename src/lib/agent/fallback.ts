import { MODEL_IDS } from "../config";
import { costUsd, makeRun } from "../model/cost";
import { extractJson } from "../model/json";
import { assertModelsEnabled, meterClient } from "../model/meter";
import { createTokenFactoryClient } from "../model/tokenfactory";
import type { ChatClient } from "../model/types";
import type { Env } from "../server/env";
import { recordLedger } from "../server/ledger";
import { recordRun, type Run } from "../server/runs";
import { applyCaseStatus, enforceAskCitations, enforcePrepareCitations } from "./citations";
import { renderCaseMemory } from "./case-memory";
import { DIRECT_ANSWER_NOTE, fillPrompt } from "./prompt";
import { PROMPT_TEXT } from "./prompt-text";
import { finishTask, parseTrace, type TaskRow } from "./queue";
import {
  AskResultSchema, FileInputSchema, InputSchemas, PrepareResultSchema, ResultSchemas,
  type AskInput, type PrepareInput, type TraceStep,
} from "./schemas";

/** Same files the sandbox agent reads, rendered inline for a plain model call. */
export function buildCloudMessages(row: Pick<TaskRow, "kind" | "input">) {
  const input = InputSchemas[row.kind].parse(JSON.parse(row.input ?? "{}"));
  const { passages = [], skill, ...rest } = input as typeof input & { passages?: unknown[]; skill?: string };
  const memory = renderCaseMemory(input.case);
  const files = [
    `=== /sandbox/case.md ===\n${memory}`,
    `=== /sandbox/task/input.json ===\n${JSON.stringify(rest)}`,
    `=== /sandbox/task/passages.json ===\n${JSON.stringify(passages)}`,
    `=== /sandbox/task/skill.md ===\n${skill ?? "(none)"}`,
  ].join("\n\n");
  const language = "language" in input ? input.language : "en";
  return {
    messages: [
      { role: "system" as const, content: `${fillPrompt(PROMPT_TEXT[row.kind], language)}\n\n${DIRECT_ANSWER_NOTE}` },
      { role: "user" as const, content: files },
    ],
    input,
  };
}

export function finalise(kind: TaskRow["kind"], raw: unknown, input: unknown): { data: unknown; note?: string } {
  const parsed = ResultSchemas[kind].parse(raw);
  if (kind === "prepare") {
    const prep = input as PrepareInput;
    const { result: cited, report } = enforcePrepareCitations(PrepareResultSchema.parse(parsed), prep.passages);
    if (cited.checklist.length === 0) throw new Error("no checklist item could be tied to an official passage");
    const result = applyCaseStatus(cited, prep.case.documents);
    return { data: result, note: report.dropped || report.repaired ? `citations: ${report.dropped} dropped, ${report.repaired} repaired` : undefined };
  }
  if (kind === "ask") {
    const { result, report } = enforceAskCitations(AskResultSchema.parse(parsed), (input as AskInput).passages);
    return { data: result, note: report.dropped ? `citations: ${report.dropped} dropped` : undefined };
  }
  return { data: parsed };
}

/** Runs one claimed task in the cloud with Super VL. The caller must have won claimForCloud. */
export async function runCloudTask(
  env: Env,
  row: TaskRow,
  opts: { client?: ChatClient; reason?: string } = {},
): Promise<void> {
  const trace: TraceStep[] = [...parseTrace(row.trace), { step: opts.reason ?? "no bridge claimed the task in time, running in the cloud", ms: 0 }];
  const started = Date.now();
  const fail = (error: string) => finishTask(env, row.id, { status: "failed", ranOn: "cloud", trace, error });
  try {
    if (row.kind === "file") {
      // Memory lives in the user's sandbox; with no sandbox online there is nothing to update.
      const ev = FileInputSchema.parse(JSON.parse(row.input ?? "{}")).event;
      trace.push({ step: "agent offline: memory update deferred", ms: Date.now() - started });
      await finishTask(env, row.id, {
        status: "done", ranOn: "cloud", trace,
        result: { data: { filed: false, memoryUpdated: false, summary: `Saved on your device: ${ev.title}. Your agent will take it into memory when it is back online.` } },
      });
      return;
    }
    const { messages, input } = buildCloudMessages(row);
    // Metered per call: over the daily cap (or with models switched off) the task fails with that message; it never spends.
    assertModelsEnabled(env);
    const client = meterClient(env, opts.client ?? createTokenFactoryClient(env.NEBIUS_API_KEY));
    let usage = { tokensIn: 0, tokensOut: 0, cachedTokens: 0 };
    let lastError = "";
    let lastRaw = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const msgs = attempt === 0 ? messages : [
        ...messages,
        { role: "assistant" as const, content: lastRaw.slice(0, 2000) || "(empty)" },
        { role: "user" as const, content: `That was not valid: ${lastError}. Reply again with only the corrected JSON object.` },
      ];
      const res = await client.chat({ model: MODEL_IDS.superVl, messages: msgs, maxTokens: 2500, thinking: false, json: "json_object", temperature: 0.2 });
      usage = {
        tokensIn: usage.tokensIn + res.usage.tokensIn, tokensOut: usage.tokensOut + res.usage.tokensOut,
        cachedTokens: usage.cachedTokens + res.usage.cachedTokens,
      };
      lastRaw = res.content;
      try {
        const { data, note } = finalise(row.kind, extractJson(res.content), input);
        const ms = Date.now() - started;
        trace.push({ step: "Nemotron 3.5 Super VL answered", tool: "tokenfactory", ms });
        if (note) trace.push({ step: note, ms: 0 });
        const run: Run = makeRun(MODEL_IDS.superVl, ms, usage, "cloud");
        await finishTask(env, row.id, { status: "done", ranOn: "cloud", trace, result: { data, run } });
        await recordRun(env, row.user_id, run, `agent:${row.kind}`);
        await recordLedger(env, {
          userId: row.user_id, kind: "model", what: `Nemotron 3.5 Super VL, ${row.kind} (cloud fallback)`,
          action: "allowed", detail: { ranOn: "cloud", costUsd: costUsd(MODEL_IDS.superVl, usage), attempts: attempt + 1 },
        });
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message.slice(0, 200) : "unparseable";
      }
    }
    await fail(`The model answer failed validation (${lastError})`);
  } catch (err) {
    await fail(err instanceof Error && err.name === "ModelError" ? err.message : "The cloud fallback could not finish this task");
  }
}
