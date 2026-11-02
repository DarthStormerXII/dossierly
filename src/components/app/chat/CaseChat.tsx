"use client";
import Link from "next/link";
import { useRef } from "react";
import { Select } from "@/components/ui/Select";
import { useCaseChat } from "./useCaseChat";
import "./case-chat.css";

export function CaseChat() {
  const { chat, loaded, error, active, sources, update, send, stop } = useCaseChat();
  const composer = useRef<HTMLTextAreaElement>(null);
  const source = sources.find((item) => item.id === chat.sourceId);
  const edit = () => { update((old) => ({ ...old, reviewing: false })); requestAnimationFrame(() => composer.current?.focus()); };
  return <section className="cc-chat" aria-labelledby="case-chat-title">
    <header className="cc-intro"><span className="tab-label">Ask about your case</span><h2 id="case-chat-title">What would you like to understand?</h2><p>Your reviewed case information provides context. Dossierly offers guidance; it does not fill, sign or submit applications.</p></header>
    {!loaded && <p role="status">Opening your encrypted conversation…</p>}
    {error && <p role="alert" className="cc-error">{error}</p>}
    <div className="cc-messages" aria-label="Case conversation">
      {chat.messages.map((message) => <article className="cc-exchange" key={message.id}>
        <div className="cc-question"><span className="cc-label">You</span><p>{message.question}</p>{message.sourceId && <small>Reviewed letter attached</small>}</div>
        <div className="cc-answer"><span className="cc-label">Dossierly</span>
          {(message.state === "sending" || message.state === "queued" || message.state === "running") && <div role="status"><p>{message.state === "sending" ? "Sending your question…" : message.state === "queued" ? "Your request is queued." : "Your request is being processed."}</p>{message.taskId && <button type="button" className="btn btn-small" onClick={() => void stop()}>Stop request</button>}</div>}
          {message.state === "done" && message.answer && <><p className="cc-answer-text">{message.answer.answer}</p>{message.answer.notice && <p className="cc-notice">{message.answer.notice}</p>}{message.answer.citations.length > 0 && <details className="cc-sources"><summary>Sources ({message.answer.citations.length})</summary><ol>{message.answer.citations.map((citation, i) => <li key={i}><a href={/^https:\/\//.test(citation.url) ? citation.url : undefined} target="_blank" rel="noreferrer">{citation.title} ↗</a><blockquote>{citation.quote}</blockquote></li>)}</ol></details>}</>}
          {(message.state === "failed" || message.state === "stopped") && <><p role="status">{message.error || "This request did not finish."}</p><button type="button" className="btn btn-small" disabled={!!active} onClick={() => void send(message.question, message.sourceId)}>Retry as a new request</button></>}
        </div>
      </article>)}
    </div>
    <form className="cc-composer" onSubmit={(event) => { event.preventDefault(); update((old) => ({ ...old, reviewing: true })); }}>
      <label htmlFor="case-question">Your question</label>
      <textarea ref={composer} id="case-question" className="input" rows={4} maxLength={1500} value={chat.draft} disabled={!loaded || !!active} onPaste={() => update((old) => ({ ...old, pasted: true }))} onChange={(event) => update((old) => ({ ...old, draft: event.target.value, reviewing: false }))} placeholder="For example, which documents should I check against this letter?" />
      <div className="cc-context"><span id="chat-source-label">Attach reviewed context</span><Select labelledBy="chat-source-label" value={chat.sourceId || "none"} onChange={(value) => update((old) => ({ ...old, sourceId: value === "none" ? null : value, reviewing: false }))} options={[{ value: "none", label: "Case information only" }, ...sources.map((item) => ({ value: item.id, label: item.title }))]} disabled={!!active || !loaded} /></div>
      <div className="cc-compose-actions"><button type="button" className="cc-link" disabled={!!active || !loaded} onClick={() => { update((old) => ({ ...old, pasted: true })); composer.current?.focus(); }}>Bring a question from another chat</button><button type="submit" className="btn btn-primary" disabled={!loaded || !!active || !chat.draft.trim()}>Review question</button></div>
      {chat.pasted && <p className="cc-note">Paste the text you want to use. Review it below before sending. Shared-chat links are treated as text and are never opened or imported.</p>}
      {!sources.length && <p className="cc-note">No reviewed letters are attached to this case yet. <Link href="/app/letters">Add a letter</Link> when you have one.</p>}
    </form>
    {chat.reviewing && <section className="cc-review" aria-labelledby="question-review-title"><h3 id="question-review-title">Review before sending</h3><p className="cc-answer-text">{chat.draft}</p><p className="cc-note">Context: your case profile, recorded events and {source ? `“${source.title}”.` : "document checklist."}</p>{source?.extracted && <details><summary>Review the attached letter excerpt</summary><p>{source.extracted.asks.join("\n")}</p></details>}<p className="cc-note">Other-chat text is unverified context. Check names, dates and assumptions. Only this question and your selected case context are sent for an answer.</p><div className="cc-compose-actions"><button type="button" className="btn" onClick={edit}>Edit question</button><button type="button" className="btn btn-primary" disabled={!!active} onClick={() => void send()}>Send question</button></div></section>}
  </section>;
}
