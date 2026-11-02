"use client";
import { useEffect, useRef, useState } from "react";
import { api, pollTask } from "./api";
import { requireResult, operationError } from "./onboarding-api";
import { clearDocument, draftCase, type OnboardingDraft } from "./onboarding-state";
import { fileToPages, urlToPages } from "./pages";
import { LetterSchema, LanguageSchema } from "@/lib/schemas";
import type { AgentTask, PrepareResult } from "./types";

type Change = (fn: (draft: OnboardingDraft) => OnboardingDraft) => void;
export function useOnboardingWork(draft: OnboardingDraft | null, change: Change) {
  const [busy, setBusy] = useState("");
  const [taskState, setTaskState] = useState("");
  const controller = useRef<AbortController | null>(null);
  const resumed = useRef("");
  useEffect(() => () => controller.current?.abort(), []);
  async function operation(name: string, run: () => Promise<void>) {
    setBusy(name); change((d) => ({ ...d, pending: name, error: "" }));
    try { await run(); change((d) => ({ ...d, pending: null })); }
    catch (error) { change((d) => ({ ...d, pending: null, error: operationError(error) })); }
    finally { setBusy(""); }
  }
  async function observe(id: string) {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const result = requireResult(await pollTask<PrepareResult>(id, (task: AgentTask<PrepareResult>) => setTaskState(task.status), abort.signal));
    if (abort.signal.aborted) return;
    if (result.status !== "done" || !result.result) throw new Error(result.error || "Preparation did not finish. Retry when you are ready.");
    change((d) => ({ ...d, prepared: result.result!, prepareTask: null, pending: null, error: "" }));
  }
  useEffect(() => {
    if (!draft?.prepareTask || resumed.current === draft.prepareTask) return;
    const id = draft.prepareTask; resumed.current = id;
    void operation("prepare", () => observe(id));
    // Resume the durable task once; a new task is started only by an explicit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.prepareTask]);
  const read = (pages: string[], filename: string, source: NonNullable<OnboardingDraft["source"]>) => operation("read", async () => {
    if (!draft) return;
    change((d) => ({ ...clearDocument(d), source, filename, pages, delivery: source === "sample" ? "2026-10-27" : "" }));
    const result = requireResult(await api.readLetter(pages, LanguageSchema.parse(draft.answers.language)));
    const facts = LetterSchema.parse(result.letter);
    const example = /SAMPLE\s+document|fikcyjn|PRZYKŁAD|WZÓR/i.test(facts.transcript);
    change((d) => ({ ...d, read: { ...result, letter: facts }, facts, source: example ? "sample" : d.source, error: example && source !== "sample" ? "This page appears to be a sample or template. It is kept as a fictional example and will not become your own case." : "" }));
  });
  return {
    busy, taskState,
    clearError: () => change((d) => ({ ...d, error: "" })),
    read,
    sample: () => operation("pages", async () => { await read(await urlToPages("/sample/wezwanie-sample.png"), "Arjun’s SAMPLE letter", "sample"); }),
    upload: (file: File) => operation("pages", async () => {
      const result = await fileToPages(file);
      if (result.truncated) throw new Error("This PDF has more than four pages. Choose a PDF containing only the pages you want reviewed; no pages have been sent.");
      await read(result.pages, file.name, "own");
    }),
    link: () => operation("link", async () => {
      if (!draft?.factsConfirmed || !draft.facts || !draft.delivery) throw new Error("Confirm the extracted facts and delivery date first.");
      const result = requireResult(await api.linkLetter(draftCase(draft), draft.facts, draft.delivery));
      change((d) => ({ ...d, link: result }));
    }),
    prepare: () => operation("prepare", async () => {
      if (!draft) return;
      const appointment = { ...draft.appointment, office: draft.appointment.office.trim() || draftCase(draft).office };
      if (!appointment.date || !appointment.purpose.trim()) throw new Error("Add a date and purpose for the checklist. This does not book an appointment.");
      const result = requireResult(await api.prepare(draftCase(draft), appointment));
      resumed.current = result.taskId;
      change((d) => ({ ...d, prepareTask: result.taskId, capture: result.retrieval ?? null }));
      await observe(result.taskId);
    }),
    interpret: () => operation("interpret", async () => {
      if (!draft?.phrase.trim()) throw new Error("Enter the phrase you want translated.");
      const result = requireResult(await api.interpret(draftCase(draft), "user", draft.phrase, []));
      change((d) => ({ ...d, interpretation: result }));
    }),
    updates: () => operation("updates", async () => {
      const result = requireResult(await api.hubChanges());
      change((d) => ({ ...d, changes: result.changes, updatesCheckedAt: result.checkedAt ?? null }));
    }),
  };
}
