"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadDoc, saveDoc } from "@/lib/vault";
import { freshDraft, restoreDraft, type OnboardingDraft } from "./onboarding-state";

export function useOnboardingDraft(accountId: string | undefined, unlocked: boolean) {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [storageError, setStorageError] = useState("");
  const current = useRef<OnboardingDraft | null>(null);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    if (!accountId || !unlocked) return;
    let live = true;
    void loadDoc<unknown>("onboarding", accountId).then((saved) => {
      if (!live) return;
      const next = restoreDraft(saved) ?? freshDraft();
      current.current = next; setDraft(next);
    }).catch(() => { if (live) setStorageError("Your saved setup could not be opened. Your existing case has not been changed."); });
    return () => { live = false; current.current = null; setDraft(null); };
  }, [accountId, unlocked]);
  const change = useCallback((fn: (draft: OnboardingDraft) => OnboardingDraft) => {
    if (!current.current || !accountId) return;
    const next = fn(current.current); current.current = next; setDraft(next);
    queue.current = queue.current.catch(() => undefined).then(() => saveDoc("onboarding", next, accountId));
    void queue.current.then(() => setStorageError(""), () => setStorageError("Changes could not be saved on this device. Keep this tab open and retry saving before leaving."));
  }, [accountId]);
  const flush = useCallback(() => queue.current, []);
  return { draft, change, flush, storageError, retrySave: () => change((d) => ({ ...d })) };
}
