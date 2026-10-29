import { webSpeech } from "@/lib/speech/webspeech";
import { Icon } from "../../Icon";
import type { Flag } from "./useConversation";

const KIND: Record<Flag["kind"], string> = {
  date: "A date that could be read two ways",
  amount: "An amount to double-check",
  document: "Which document exactly?",
  yes_no: "Was that a yes or a no?",
  missed_question: "A question was not answered",
  other: "Worth checking",
};

/** The interpreter speaks up: a likely misunderstanding, with a ready clarifying question in both languages. */
export function WatchCard({ flag, onAsk, onDismiss }: { flag: Flag; onAsk(): void; onDismiss(): void }) {
  const ask = () => {
    void webSpeech.speak(flag.clarifyLocal, "pl-PL");
    onAsk();
  };
  return (
    <article className="watch-card" role="alert" aria-label="Possible misunderstanding">
      <span className="tab-label watch-label">Speaking up · {KIND[flag.kind]}</span>
      <p className="watch-quote" lang="pl">„{flag.quote}”</p>
      <p className="watch-expl">{flag.explanation}</p>
      <div className="watch-q">
        <p lang="pl" className="watch-q-pl">{flag.clarifyLocal}</p>
        <p className="small muted" style={{ margin: 0 }}>{flag.clarifyUser}</p>
      </div>
      <div className="row">
        <button className="btn btn-primary btn-small" onClick={ask}><Icon name="speak" size={18} /> Ask this</button>
        <button className="btn btn-ghost btn-small" onClick={onDismiss}>It was clear</button>
      </div>
    </article>
  );
}
