import Image from "next/image";
import { providers, type Tool } from "./providers";

export function ToolsStep({ selected, expanded, expand, select }: {
  selected: Tool[]; expanded: Tool | null; expand(tool: Tool | null): void; select(tool: Tool): void;
}) {
  function group(title: string) {
    return <div className="op-tool-group">{providers.filter((tool) => tool.group === title).map((tool) => <section className="op-tool" key={tool.id} aria-labelledby={`tool-${tool.id}`}>
      <div className="op-tool-heading">
        <Image className="op-tool-logo" src={`/onboarding-preview/providers/${tool.logo}`} alt="" width={36} height={36} unoptimized />
        <div><h3 id={`tool-${tool.id}`}>{tool.title}</h3><p className="op-help">{tool.purpose}</p></div>
      </div>
      {selected.includes(tool.id) ? <div className="op-tool-selection">
        <span className="op-selected" role="status">Selected for setup</span>
        <button id={`remove-tool-${tool.id}`} type="button" className="op-text-button" onClick={() => select(tool.id)} aria-label={`Remove ${tool.title} selection`}>Remove</button>
      </div> : <button id={`preview-tool-${tool.id}`} type="button" className="op-text-button" aria-expanded={expanded === tool.id} aria-controls={`permissions-${tool.id}`} onClick={() => expand(expanded === tool.id ? null : tool.id)}>Preview {tool.title} setup <span aria-hidden="true">{expanded === tool.id ? "−" : "+"}</span></button>}
      {expanded === tool.id && !selected.includes(tool.id) && <div className="op-permissions" id={`permissions-${tool.id}`}>
        <h4>Permission preview</h4><p>{tool.permission}</p><p className="op-help">{tool.boundary}</p>
        <a className="op-help" href={tool.reference} target="_blank" rel="noreferrer">Provider reference ↗</a>
        <button type="button" className="btn" onClick={() => select(tool.id)}>Select {tool.title} for setup</button>
      </div>}
    </section>)}</div>;
  }
  return <div className="op-tools">
    <p className="op-helper-note">Connection previews only. Choose up to one mail provider and one calendar. No service connects or accesses your data.</p>
    {["Mail", "Calendar"].map((title) => <section className="op-provider-category" key={title}><h2>{title} <span className="op-help">Optional · choose one</span></h2>{group(title)}</section>)}
    <p className="op-help">Documents can come from in-app uploads or mail attachments in the planned product. No file access is requested here.</p>
  </div>;
}
