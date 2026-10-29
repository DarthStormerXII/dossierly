import type { CaseContext } from "./schemas";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : iso;
};

/** First-time memory file for an agent that has never seen this person, rendered from the app's case. */
export function renderCaseMemory(c: CaseContext): string {
  const lines = [`# Case Memory - ${c.profile.name}`, "", `**Case:** ${c.office}${c.caseNumber ? `, ${c.caseNumber}` : ""}`, "", "**Timeline:**"];
  const events = [...c.events].sort((a, b) => a.date.localeCompare(b.date));
  if (events.length === 0) lines.push("- (no events yet)");
  for (const e of events) lines.push(`- ${shortDate(e.date)}: ${e.title}${e.summary ? ` - ${e.summary}` : ""}`);
  lines.push("", "**Deadline:**");
  if (c.deadlines.length === 0) lines.push("- none recorded");
  for (const d of c.deadlines) lines.push(`- ${d.date}: ${d.what}`);
  lines.push("", "**Required:**");
  const missing = c.documents.filter((d) => !d.have);
  if (missing.length === 0) lines.push("- nothing recorded as missing");
  for (const d of missing) lines.push(`- ${d.name}`);
  lines.push("", "*Interpretation only; no legal advice.*", "");
  return lines.join("\n");
}
