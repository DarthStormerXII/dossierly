"use client";
import { ConnectionsStep } from "./ConnectionsStep";
import { useState } from "react";
import { connectionsApi, type MailImport as Imported, type MailMessage } from "@/lib/client/onboarding-connections";
import { operationError, requireResult } from "@/lib/client/onboarding-api";
import { fileToPages } from "@/lib/client/pages";

export function MailImport({ accept, beforeConnect }: { accept(pages: string[], name: string): Promise<void>; beforeConnect(): Promise<void> }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState("");
  const [messages, setMessages] = useState<MailMessage[] | null>(null);
  const [selected, setSelected] = useState<Extract<Imported, { kind: "message" }> | null>(null);
  const [file, setFile] = useState<(Extract<Imported, { kind: "attachment" }> & { pages: string[] }) | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function reviewAttachment(messageId: string, attachmentId: string) {
    const result = requireResult(await connectionsApi.importMail(messageId, attachmentId));
    if (result.kind !== "attachment") throw new Error("The attachment was not returned.");
    const data = result.file;
    if (!/^data:(application\/pdf|image\/(png|jpeg|webp));base64,/.test(data.dataUrl)) throw new Error("Unsupported attachment data.");
    const raw = atob(data.dataUrl.split(",")[1]); if (raw.length > 4 * 1024 * 1024) throw new Error("Attachment is too large.");
    const local = new File([Uint8Array.from(raw, (char) => char.charCodeAt(0))], data.name, { type: data.mime });
    const pages = await fileToPages(local); if (pages.truncated) throw new Error("This attachment has more than four pages. Download and choose the relevant pages yourself.");
    setFile({ ...result, pages: pages.pages });
  }
  async function run(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn(); } catch (e) { setError(operationError(e)); } finally { setBusy(false); } }
  return <section className="ob-mail-import"><button type="button" className="op-text-button" aria-expanded={open} onClick={() => setOpen(!open)}>Review mail from a connected account</button>{open && <div className="op-fields"><p className="op-help">Connect Gmail or Outlook below, or upload a downloaded attachment directly. Opening a message does not add it to your case.</p><details><summary>Set up or change a mail connection</summary><ConnectionsStep beforeLeave={beforeConnect} /></details><label className="field"><span>Search connected mail</span><input className="input" value={q} maxLength={200} onChange={(e) => setQ(e.target.value)} /></label><button type="button" className="btn" disabled={busy} onClick={() => void run(async () => { setMessages(requireResult(await connectionsApi.mail(q)).messages); setSelected(null); setFile(null); })}>Search mail</button>
    {error && <p className="op-error" role="alert">{error}</p>}{messages && !messages.length && <p>No messages matched. Try another search or upload your own copy.</p>}
    {messages?.map((message) => <button type="button" className="ob-message" key={message.id} disabled={busy} onClick={() => void run(async () => { const result = requireResult(await connectionsApi.importMail(message.id)); if (result.kind !== "message") throw new Error("Could not open that message."); setSelected(result); setFile(null); })}><strong>{message.subject || "Untitled message"}</strong><span>{message.from} · {message.date}</span><small>{message.snippet}</small></button>)}
    {selected && <section className="ob-mail-review"><h3>{selected.subject}</h3><p className="op-help">{selected.from}</p><pre>{selected.text}</pre><p className="op-help">Untrusted message content. Review it yourself; links are not opened automatically.</p>{!selected.attachments.length && <p>No supported attachment was found in this message.</p>}{selected.attachments.map((attachment) => <button type="button" className="btn" key={attachment.id} disabled={busy} onClick={() => void run(() => reviewAttachment(selected.messageId, attachment.id))}>Review attachment: {attachment.name}</button>)}</section>}
    {file && <section className="op-helper-note"><h3>Accept this attachment for reading?</h3><p>{file.file.name} · {file.file.mime}</p><div className="ob-pages">{file.pages.map((page, i) => <div className="ob-page-scroll" key={i}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={page} alt={`Attachment page ${i + 1} for your review`} style={{ width: "100%", minWidth: 680, height: "auto", display: "block" }} />
    </div>)}</div><p>The attachment will be converted on this device and sent to the letter reader only after you accept it. It will not become an own case until your final confirmation.</p><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => accept(file.pages, file.file.name))}>Accept attachment and read</button><button type="button" className="op-text-button" onClick={() => setFile(null)}>Cancel attachment</button></section>}
  </div>}</section>;
}
