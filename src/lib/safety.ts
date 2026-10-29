import type { Language } from "./schemas";

// The companion interprets. It never answers medical or legal questions itself.
const ADVICE_PATTERNS: RegExp[] = [
  // English
  /\bshould i (take|stop|sign|accept|refuse|appeal|pay|agree|hire)\b/i,
  /\b(is it|is this) (legal|illegal|allowed|safe|dangerous|normal)\b/i,
  /\b(my|do i have a) (rights?|lawyer|legal)\b/i,
  /\b(can|could) (i|you) sue\b/i,
  /\b(dose|dosage|diagnos\w*|prescri\w*|side effects?|medicine|medication|symptoms?)\b/i,
  /\bwhat (should|do) i do (about|if)\b/i,
  // Hindi
  /(क्या मुझे|मुझे .* करना चाहिए)/,
  /(कानूनी|क़ानूनी|वकील|दवा|दवाई|खुराक|बीमारी|इलाज)/,
  // Ukrainian
  /(чи повинен я|чи потрібно мені|це законно|це легально|юрист|адвокат|ліки|доза|діагноз|симптом)/i,
  // Tamil
  /(சட்டப்படி|வழக்கறிஞர்|மருந்து|நோய்|சிகிச்சை|கையெழுத்திட வேண்டுமா)/,
];

export type SafetyVerdict = { flagged: boolean };

export function guardUserUtterance(text: string, modelFlag = false): SafetyVerdict {
  return { flagged: modelFlag || ADVICE_PATTERNS.some((re) => re.test(text)) };
}

export const SAFETY_NOTICE: Record<Language, string> = {
  uk: "Я лише перекладаю. Я не можу давати медичні чи юридичні поради. Ваше запитання передано дослівно: будь ласка, запитайте посадовця або лікаря.",
  en: "I can only interpret. I cannot give medical or legal advice. Your question was passed on word for word: please ask the official or the doctor.",
  hi: "मैं केवल अनुवाद कर सकता हूँ। मैं चिकित्सा या कानूनी सलाह नहीं दे सकता। आपका प्रश्न शब्दशः आगे बता दिया गया है: कृपया अधिकारी या डॉक्टर से पूछें।",
  ta: "நான் மொழிபெயர்ப்பு மட்டுமே செய்ய முடியும். மருத்துவ அல்லது சட்ட ஆலோசனை தர முடியாது. உங்கள் கேள்வி அப்படியே தெரிவிக்கப்பட்டது: அதிகாரியிடம் அல்லது மருத்துவரிடம் கேளுங்கள்.",
};

export const NO_AUDIO_NOTICE =
  "This app never records or stores audio. Only text is sent to the interpreter. Your browser's own speech recognition may process your voice.";
