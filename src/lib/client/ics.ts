/** Builds an all-day .ics calendar file and triggers a download on the device. Nothing is uploaded. */
export type IcsEvent = { date: string; title: string; description?: string; uid: string };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
const ymd = (iso: string) => iso.replaceAll("-", "");

function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function buildIcs(events: IcsEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const body = events
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}@dossierly.pages.dev`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.date))}`,
      `SUMMARY:${esc(e.title)}`,
      e.description ? `DESCRIPTION:${esc(e.description)}` : "",
      "BEGIN:VALARM", "TRIGGER:-P2D", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "END:VALARM",
      "END:VEVENT",
    ].filter(Boolean).join("\r\n"));
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
