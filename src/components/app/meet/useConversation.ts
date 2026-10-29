"use client";

import { useCallback, useRef, useState } from "react";
import { api, type ApiFailure } from "@/lib/client/api";
import { useDossier } from "@/lib/client/store";
import type { Issue, Run, TurnInput } from "@/lib/client/types";

export type Turn = {
  id: string;
  speaker: "user" | "official";
  original: string;
  translation: string;
  pending?: boolean;
  adviceNotice?: string | null;
  run?: Run;
  failed?: ApiFailure;
  clarify?: boolean;
};
export type Flag = Issue & { id: string; turnId: string };

const done = (t: Turn): t is Turn & { translation: string } => !t.pending && !t.failed && !!t.translation;
const toInput = (t: Turn): TurnInput => ({ speaker: t.speaker, original: t.original, translation: t.translation });

/** Holds the live conversation in memory only. Text turns, never audio. */
export function useConversation() {
  const d = useDossier();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [watching, setWatching] = useState(false);
  const ref = useRef<Turn[]>([]);

  const set = useCallback((next: Turn[]) => {
    ref.current = next;
    setTurns(next);
  }, []);
  const patch = useCallback((id: string, p: Partial<Turn>) => set(ref.current.map((t) => (t.id === id ? { ...t, ...p } : t))), [set]);

  const watch = useCallback(async (turnId: string) => {
    setWatching(true);
    const r = await api.watch(d.case, ref.current.filter(done).map(toInput));
    setWatching(false);
    if (!r.ok) return;
    d.logRuns("watch", [r.data.run]);
    if (r.data.issues.length) setFlags((f) => [...r.data.issues.map((i, n) => ({ ...i, id: `${turnId}-${n}`, turnId })), ...f].slice(0, 4));
  }, [d]);

  const say = useCallback(async (speaker: Turn["speaker"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const id = crypto.randomUUID();
    const recent = ref.current.filter(done).map(toInput);
    set([...ref.current, { id, speaker, original: clean, translation: "", pending: true }]);
    const r = await api.interpret(d.case, speaker, clean, recent);
    if (!r.ok) return patch(id, { pending: false, failed: r });
    patch(id, { pending: false, translation: r.data.translation, adviceNotice: r.data.adviceNotice, run: r.data.run });
    d.logRuns("interpret", [r.data.run]);
    if (speaker === "official") void watch(id);
  }, [d, patch, set, watch]);

  /** The clarifying question is already in both languages, so it joins the conversation without a model call. */
  const askClarify = useCallback((f: Flag) => {
    set([...ref.current, { id: crypto.randomUUID(), speaker: "user", original: f.clarifyUser, translation: f.clarifyLocal, clarify: true }]);
    setFlags((all) => all.filter((x) => x.id !== f.id));
  }, [set]);

  const dismiss = useCallback((id: string) => setFlags((all) => all.filter((x) => x.id !== id)), []);
  const retry = useCallback((t: Turn) => {
    set(ref.current.filter((x) => x.id !== t.id));
    void say(t.speaker, t.original);
  }, [say, set]);

  return { turns, flags, watching, say, askClarify, dismiss, retry, finished: () => ref.current.filter(done).map(toInput) };
}
