"use client";

import { useState } from "react";
import { LANGUAGE_NAMES } from "@/lib/client/sample";
import { useDossier } from "@/lib/client/store";
import { Icon } from "../../Icon";
import { SpeakerHalf } from "./SpeakerHalf";
import { TurnCard } from "./TurnCard";
import { WatchCard } from "./WatchCard";
import type { useConversation } from "./useConversation";

type Conv = ReturnType<typeof useConversation>;

/** Phone flat on the desk between both people: the official's half is rotated 180° to face them. */
export function TableMode({ conv, onEnd }: { conv: Conv; onEnd(): void }) {
  const d = useDossier();
  const lang = d.case.profile.language;
  const [flat, setFlat] = useState(true);
  const [log, setLog] = useState(false);
  const busy = conv.turns.some((t) => t.pending);
  const notice = [...conv.turns].reverse().find((t) => t.speaker === "user" && t.adviceNotice)?.adviceNotice;
  const usable = conv.turns.filter((t) => !t.failed && !t.pending).length;

  return (
    <div className={`table-mode${flat ? " is-flat" : ""}`}>
      <div className="half-wrap half-wrap-official">
        <SpeakerHalf side="official" speechLang="pl-PL" userLang={lang} turns={conv.turns} onSay={(t) => void conv.say("official", t)} onRetry={conv.retry} busy={busy} />
      </div>

      <div className="table-strip" role="toolbar" aria-label="Conversation controls">
        <span className="strip-note"><span className="rec-off" aria-hidden="true" />No audio is stored</span>
        {conv.watching && <span className="strip-note">checking…</span>}
        <span className="grow" />
        <button className="btn btn-ghost btn-small" onClick={() => setFlat(!flat)} aria-pressed={flat} title="Rotate the official's half to face across the desk">
          <Icon name="flip" size={18} /><span className="strip-l">{flat ? "Table" : "Upright"}</span>
        </button>
        <button className="btn btn-ghost btn-small" onClick={() => setLog(!log)} aria-expanded={log}>
          <span>Transcript</span>
        </button>
        <button className="btn btn-small btn-primary" onClick={onEnd} disabled={busy || usable === 0}>End</button>
      </div>

      <div className="half-wrap half-wrap-user">
        <SpeakerHalf side="user" speechLang={LANGUAGE_NAMES[lang].speech} userLang={lang} turns={conv.turns} onSay={(t) => void conv.say("user", t)} onRetry={conv.retry} busy={busy} bump={conv.flags.length * 2 + (notice ? 1 : 0)}>
          {notice && (
            <div className="notice notice-calm small" role="note">
              {notice}
            </div>
          )}
          {conv.flags.map((f) => <WatchCard key={f.id} flag={f} onAsk={() => conv.askClarify(f)} onDismiss={() => conv.dismiss(f.id)} />)}
        </SpeakerHalf>
      </div>

      {log && (
        <div className="log-sheet" role="dialog" aria-label="Full conversation">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 className="h-card">Conversation so far</h2>
            <button className="btn btn-small" onClick={() => setLog(false)}>Close</button>
          </div>
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            {conv.turns.length === 0 && <p className="muted small">Nothing said yet.</p>}
            {conv.turns.map((t) => <TurnCard key={t.id} turn={{ ...t }} reader={t.speaker === "official" ? "user" : "official"} userLang={lang} />)}
          </div>
        </div>
      )}
    </div>
  );
}
