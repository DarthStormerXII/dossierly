import { Select } from "@/components/ui/Select";
import { needLabel, samples, type Need } from "./content";
import { paperStories } from "./paper-content";

type Message = { question: string; source: Need | null; response: boolean };
export type ChatState = { draft: string; bringing: boolean; reviewing: boolean; attached: boolean; source: Need; messages: Message[]; error: string };
export const emptyChat = (): ChatState => ({ draft: "", bringing: false, reviewing: false, attached: false, source: "letters", messages: [], error: "" });

export function CaseChatPreview({ state, update, needs }: { state: ChatState; update(state: ChatState): void; needs: Need[] }) {
  const source = needs.includes(state.source) ? state.source : needs[0];
  function patch(value: Partial<ChatState>) { update({ ...state, ...value }); }
  function review() {
    if (!state.draft.trim()) { patch({ error: "Add a question to review first." }); document.getElementById("preview-question")?.focus(); return; }
    patch({ reviewing: true, error: "" });
    requestAnimationFrame(() => document.getElementById("question-review-title")?.focus());
  }
  function add() {
    patch({ messages: [...state.messages, { question: state.draft.trim(), source: state.attached ? source : null, response: false }], draft: "", bringing: false, reviewing: false, attached: false });
    requestAnimationFrame(() => document.getElementById("preview-question")?.focus());
  }
  return <section className="op-chat" aria-labelledby="chat-title">
    <header className="op-chat-header"><div><span className="op-eyebrow">Case conversation · preview</span><h2 id="chat-title">Bring your next question</h2></div><span className="op-badge">Sample workspace</span></header>
    <p className="op-help">Explore how a conversation could work. Questions stay in this tab; no answer is generated. Dossierly offers guidance, not application completion or submission.</p>
    <div className="op-chat-messages" role="log" aria-label="Preview conversation" aria-live="polite">
      {!state.messages.length && <div className="op-chat-welcome"><span className="op-assistant-dot" aria-hidden="true" /><div><h3>A question, with the right context</h3><p>Write a question or paste one you already have. You’ll review the text and any sample source before adding it here.</p></div></div>}
      {state.messages.map((message, index) => <div className="op-chat-turn" key={index}>
        <div className="op-chat-user"><span className="op-eyebrow">You · preview</span><p>{message.question}</p>{message.source && <span className="op-chat-source-chip">▤ {samples[message.source].kind}</span>}</div>
        {message.response ? <div className="op-chat-response"><span className="op-eyebrow">Dossierly · curated sample response</span><h3 id={`chat-response-${index}`} tabIndex={-1}>Here’s how guidance could look</h3><p className="op-help">This is a fixed example of the response format, not a generated answer to your question.</p>
          {message.source ? <><p>{paperStories[message.source].request.explanation}</p><details><summary>Source used in this sample</summary><blockquote lang="pl">{paperStories[message.source].request.text}</blockquote><p className="op-help">Fictional Arjun Mehta case · {needLabel(message.source)}</p></details><p><strong>A possible next step:</strong> {samples[message.source].action}</p></> : <p>A helpful response would first clarify your question and identify a relevant source. No source was attached to this preview message, so no case-specific guidance is shown.</p>}
          <p className="op-help">You decide what to do next. No document is completed and no application is submitted.</p>
        </div> : <div className="op-chat-response"><p className="op-help">Question added to the preview. It hasn’t been sent to a service.</p><button type="button" className="op-text-button" onClick={() => { patch({ messages: state.messages.map((item, i) => i === index ? { ...item, response: true } : item) }); requestAnimationFrame(() => document.getElementById(`chat-response-${index}`)?.focus()); }}>Show a sample response</button></div>}
      </div>)}
    </div>
    {state.reviewing ? <section className="op-question-review" aria-labelledby="question-review-title"><span className="op-eyebrow">Before adding anything</span><h3 id="question-review-title" tabIndex={-1}>Review your question and context</h3><p className="op-question-copy">{state.draft}</p><dl><dt>Selected source context</dt><dd>{state.attached ? `${samples[source].kind} · fictional Arjun Mehta case` : "No source attached"}</dd></dl><p className="op-help">Only the text above and this sample context will appear in the preview. Links are treated as text and never opened or imported.</p><div className="op-chat-actions"><button type="button" className="btn btn-primary" onClick={add}>Add to preview chat</button><button type="button" className="op-text-button" onClick={() => { patch({ reviewing: false }); requestAnimationFrame(() => document.getElementById("preview-question")?.focus()); }}>Edit question</button></div></section>
      : <div className="op-composer-area">
        <div className="op-chat-toolbar"><button type="button" className="op-text-button" aria-expanded={state.bringing} onClick={() => { patch({ bringing: !state.bringing }); requestAnimationFrame(() => document.getElementById("preview-question")?.focus()); }}>Bring a question <span aria-hidden="true">↓</span></button><span className="op-help">Paste text you choose to share</span></div>
        {state.bringing && <p id="paste-help" className="op-helper-note">Paste the question itself from your notes or another conversation. This does not import private chats or read shared links. Review the text before adding it.</p>}
        <div className="op-composer"><label className="sr-only" htmlFor="preview-question">{state.bringing ? "Paste your question" : "Your preview question"}</label><textarea id="preview-question" value={state.draft} onChange={(event) => patch({ draft: event.target.value, error: "" })} rows={3} maxLength={2000} placeholder={state.bringing ? "Paste your question here…" : "What would you like help understanding?"} aria-describedby={state.error ? "question-error" : "composer-help"} aria-invalid={!!state.error} />
          {state.attached && <div className="op-attachment-choice"><span id="chat-source-label" className="op-help">Sample source context</span><Select labelledBy="chat-source-label" value={source} options={needs.map((need) => ({ value: need, label: samples[need].kind }))} onChange={(value) => patch({ source: value as Need })} /></div>}
          <div className="op-composer-controls"><button type="button" className="op-text-button" aria-pressed={state.attached} onClick={() => patch({ attached: !state.attached, source })}><span aria-hidden="true">{state.attached ? "−" : "+"}</span>{state.attached ? "Remove sample source" : "Attach sample source"}</button><button type="button" className="btn btn-primary" onClick={review}>Review question <span aria-hidden="true">↑</span></button></div>
        </div>{state.error && <p id="question-error" className="op-error" role="alert">{state.error}</p>}<p id="composer-help" className="op-help">Text and sample attachments only. No uploads, private-chat imports or live advice in this preview.</p>
      </div>}
  </section>;
}
