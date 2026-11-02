import type { Tool } from "./content";

const tools = [
  { id: "gmail" as const, title: "Gmail", purpose: "Bring relevant office messages into view.", detail: "A future connection would need your permission to read the messages you choose to share with Dossierly.", boundary: "The exact access and message-selection controls would be shown before a real connection. This preview cannot read or send email." },
  { id: "calendar" as const, title: "Google Calendar", purpose: "Keep reviewed dates alongside your plans.", detail: "A future connection would ask for calendar access so you could add dates after reviewing them.", boundary: "The exact calendar permissions would be shown before a real connection. This preview cannot read your calendar or create events." },
];

export function ToolsStep({ selected, expanded, expand, select }: {
  selected: Tool[]; expanded: Tool | null; expand(tool: Tool | null): void; select(tool: Tool): void;
}) {
  return <div className="op-tools">
    <p className="op-helper-note">Connection previews only. You decide what to set up later.</p>
    {tools.map((tool) => <section className="op-tool" key={tool.id} aria-labelledby={`tool-${tool.id}`}>
      <div className="op-tool-heading">
        <div className="op-tool-symbol" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {tool.id === "gmail" ? <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></> : <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 10h16m-11 4h2m2 0h2m-6 3h2" /></>}
          </svg>
        </div>
        <div><h2 id={`tool-${tool.id}`}>{tool.title}</h2><p className="op-help">{tool.purpose}</p></div>
      </div>
      {selected.includes(tool.id) ? <div className="op-tool-selection">
        <span className="op-selected" role="status">Selected for setup</span>
        <button id={`remove-tool-${tool.id}`} type="button" className="op-text-button" onClick={() => select(tool.id)} aria-label={`Remove ${tool.title} selection`}>Remove</button>
      </div> : <button id={`preview-tool-${tool.id}`} type="button" className="op-text-button" aria-expanded={expanded === tool.id} aria-controls={`permissions-${tool.id}`}
        onClick={() => expand(expanded === tool.id ? null : tool.id)}>Preview {tool.title} setup <span aria-hidden="true">{expanded === tool.id ? "−" : "+"}</span></button>}
      {expanded === tool.id && !selected.includes(tool.id) && <div className="op-permissions" id={`permissions-${tool.id}`}>
        <h3>Permission preview</h3><p>{tool.detail}</p><p className="op-help">{tool.boundary}</p>
        <button type="button" className="btn" onClick={() => select(tool.id)}>Select {tool.title} for setup</button>
      </div>}
    </section>)}
    <p className="op-help op-center">You can try the starting screen without selecting either tool.</p>
  </div>;
}
