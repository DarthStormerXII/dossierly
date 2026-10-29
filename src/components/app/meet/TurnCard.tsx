import { friendlyError } from "@/lib/client/api";
import { Attribution } from "../../Attribution";
import type { Turn } from "./useConversation";

/**
 * A turn seen from one reader's side. The other person's words: original small, translation large.
 * Your own words: shown smaller, confirming what was passed on. Never chat bubbles.
 */
export function TurnCard({ turn, reader, userLang, onRetry }: { turn: Turn; reader: "user" | "official"; userLang: string; onRetry?(): void }) {
  const own = turn.speaker === reader;
  const who = turn.speaker === "official" ? "official" : "user";
  const origLang = turn.speaker === "official" ? "pl" : userLang;
  const transLang = turn.speaker === "official" ? userLang : "pl";
  const label = reader === "official"
    ? (own ? "Pan/Pani powiedział(a)" : "Klient mówi")
    : (own ? "You said" : "The official said");

  return (
    <article className={`turn turn-${who}${own ? " turn-own" : ""}`} aria-label={label}>
      <header className="turn-head">
        <span>{label}{turn.clarify ? (reader === "official" ? " · pytanie" : " · clarifying question") : ""}</span>
        {turn.run && !own && <Attribution run={turn.run} />}
      </header>
      {own ? (
        <p className="turn-own-text" lang={origLang}>{turn.original}</p>
      ) : (
        <>
          <p className="turn-orig" lang={origLang}>{turn.original}</p>
          {turn.pending ? (
            <p className="turn-trans muted" aria-live="polite">{reader === "official" ? "Tłumaczę…" : "Interpreting…"}</p>
          ) : turn.failed ? (
            <div className="turn-fail">
              <span className="small">{friendlyError(turn.failed)}</span>
              {onRetry && <button className="btn btn-small" onClick={onRetry}>Try again</button>}
            </div>
          ) : (
            <p className="turn-trans" lang={transLang}>{turn.translation}</p>
          )}
        </>
      )}
      {own && turn.pending && <span className="tiny muted">{reader === "official" ? "Tłumaczę…" : "Interpreting…"}</span>}
    </article>
  );
}
