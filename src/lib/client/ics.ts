/** Builds an all-day .ics calendar file and triggers a download on the device. Nothing is uploaded. */
export type IcsEvent = { date: string; title: string; description?: string; uid: string };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const ymd = (iso: string) => iso.replaceAll("-", "");
const validDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(Date.parse(`${iso}T00:00:00Z`)) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso;

/** RFC5545 content lines are limited to 75 UTF-8 octets, with continuation lines beginning with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder(); let current = ""; let bytes = 0; const lines: string[] = [];
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { lines.push(current); current = " "; bytes = 1; }
    current += char; bytes += size;
  }
  lines.push(current); return lines.join("\r\n");
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function buildIcs(events: IcsEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const body = events
    .filter((e) => validDate(e.date) && e.title.trim() && e.uid.trim())
    .map((e) => [
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(e.uid)}@dossierly.pages.dev`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.date))}`,
      `SUMMARY:${esc(e.title)}`,
      e.description ? `DESCRIPTION:${esc(e.description)}` : "",
      "BEGIN:VALARM", "TRIGGER:-P2D", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "END:VALARM",
      "END:VEVENT",
    ].filter(Boolean).map(fold).join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dossierly//Case//EN", "CALSCALE:GREGORIAN", ...body, "END:VCALENDAR"].join("\r\n");
}

export function downloadIcs(events: IcsEvent[], filename: string): void {
  const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
