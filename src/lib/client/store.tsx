"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ensureSession, startSession } from "./api";
import { emptyCase, sampleCase } from "./sample";
import type { Case, Language, Me, Run, Status } from "./types";
import { destroyVault, loadDoc, openVault, saveDoc, unlock, type VaultKind } from "@/lib/vault";

export type RunLog = Run & { feature: string; ts: number };
export type SavedLetter = {
  id: string;
  title: string;
  deliveryDate: string;
  deadline: string | null;
  linkedTo: string[];
  explanation: string;
  draftLocal: string;
  draftUser: string;
};
export type Appointment = { date: string; purpose: string; office: string };
export type Dossier = {
  case: Case;
  sample: boolean;
  letters: SavedLetter[];
  nextAppointment?: Appointment;
  lastPreparedAt?: string;
  runs: RunLog[];
};

type Phase = "loading" | "locked" | "empty" | "ready" | "unavailable";
type Ctx = {
  phase: Phase;
  vaultKind: VaultKind | null;
  dossier: Dossier | null;
  me: Me | null;
  status: Status | null;
  startSample(): Promise<void>;
  startOwn(name: string, language: Language, office: string): Promise<void>;
  update(fn: (d: Dossier) => Dossier): Promise<void>;
  logRuns(feature: string, runs: (Run | undefined)[]): void;
  unlockVault(): Promise<void>;
  refreshMe(): Promise<void>;
  wipe(): Promise<void>;
  setVaultKind(k: VaultKind): void;
};

const CaseContext = createContext<Ctx | null>(null);
const DOC = "dossier";

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [vaultKind, setVaultKind] = useState<VaultKind | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const ref = useRef<Dossier | null>(null);

  const load = useCallback(async () => {
    const v = await openVault();
    if (v.status === "unavailable") return setPhase("unavailable");
    setVaultKind(v.kind);
    if (v.status === "locked") return setPhase("locked");
    const d = await loadDoc<Dossier>(DOC);
    ref.current = d;
    setDossier(d);
    setPhase(d ? "ready" : "empty");
  }, []);

  useEffect(() => {
    // Async initial load from the encrypted vault; state is set after the awaits resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void ensureSession().then((r) => r.ok && setMe(r.data));
    void api.status().then((r) => r.ok && setStatus(r.data));
    const t = setInterval(() => void api.status().then((r) => r.ok && setStatus(r.data)), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const persist = useCallback(async (d: Dossier) => {
    ref.current = d;
    setDossier(d);
    setPhase("ready");
    await saveDoc(DOC, d);
  }, []);

  const value = useMemo<Ctx>(() => ({
    phase, vaultKind, dossier, me, status, setVaultKind,
    startSample: async () => {
      const r = await startSession(true);
      if (r.ok) setMe(r.data);
      await persist({ case: sampleCase(), sample: true, letters: [], runs: [] });
    },
    startOwn: async (name, language, office) => {
      const r = await startSession(false);
      if (r.ok) setMe(r.data);
      await persist({ case: emptyCase(name, language, office), sample: false, letters: [], runs: [] });
    },
    update: async (fn) => {
      if (ref.current) await persist(fn(ref.current));
    },
    logRuns: (feature, runs) => {
      const cur = ref.current;
      if (!cur) return;
      const ts = Date.now();
      const add = runs.filter((r): r is Run => !!r).map((r) => ({ ...r, feature, ts }));
      if (add.length) void persist({ ...cur, runs: [...add, ...cur.runs].slice(0, 120) });
    },
    unlockVault: async () => {
      await unlock();
      await load();
    },
    refreshMe: async () => {
      const r = await api.me();
      if (r.ok) setMe(r.data);
    },
    wipe: async () => {
      await destroyVault();
      ref.current = null;
      setDossier(null);
      await load();
    },
  }), [phase, vaultKind, dossier, me, status, persist, load]);

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase(): Ctx {
  const c = useContext(CaseContext);
  if (!c) throw new Error("useCase outside CaseProvider");
  return c;
}

/** The dossier for screens that render only once a case exists (AppShell guarantees it). */
export function useDossier(): Dossier & { update: Ctx["update"]; logRuns: Ctx["logRuns"] } {
  const c = useCase();
  if (!c.dossier) throw new Error("No case loaded");
  return { ...c.dossier, update: c.update, logRuns: c.logRuns };
}

export const newId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;
