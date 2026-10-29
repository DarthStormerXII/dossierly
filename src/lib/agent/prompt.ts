/** Shared by the Worker fallback and the M2 bridge; no imports so Node can strip types and run it. */
export const LANGUAGE_NAMES = { en: "English", uk: "Ukrainian", hi: "Hindi", ta: "Tamil" } as const;

export function fillPrompt(template: string, language: keyof typeof LANGUAGE_NAMES): string {
  return template.replaceAll("{{LANGUAGE}}", LANGUAGE_NAMES[language] ?? "English");
}

/** The JSON-only tail appended whenever a model (not a tool-using agent) answers directly. */
export const DIRECT_ANSWER_NOTE =
  "The files named above are given inline below under their sandbox paths. You cannot edit files here: skip any instruction to edit or re-read a file and only produce the final JSON answer.";
