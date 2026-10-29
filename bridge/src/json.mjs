/** Drops reasoning blocks and code fences, then takes the outermost JSON object. */
export function extractJson(raw) {
  let s = String(raw).replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "");
  s = s.replace(/```(?:json)?/gi, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in the answer");
  return JSON.parse(s.slice(start, end + 1));
}

/** Adds "- <date>: <title>" at the end of the Timeline list; appends a section if there is none. */
export function addTimelineLine(md, line) {
  const lines = md.split("\n");
  const i = lines.findIndex((l) => /^\*\*Timeline/i.test(l.trim()));
  if (i === -1) return `${md.trimEnd()}\n\n**Timeline:**\n${line}\n`;
  let j = i + 1;
  while (j < lines.length && lines[j].startsWith("- ")) j++;
  lines.splice(j, 0, line);
  return lines.join("\n");
}
