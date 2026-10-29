import type { ListenHandle, ListenHandlers, SpeechProvider } from "./types";

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split("-")[0].toLowerCase();
  return voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base));
}

export const webSpeech: SpeechProvider = {
  id: "web-speech",
  canListen: () => recognitionCtor() !== null,
  canSpeak: () => typeof window !== "undefined" && "speechSynthesis" in window,

  listen(lang: string, handlers: ListenHandlers): ListenHandle | null {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      handlers.onError("unsupported");
      return null;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "";
    let failed = false;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += `${piece} `;
        else interim += piece;
      }
      handlers.onInterim(`${finalText}${interim}`.trim());
    };
    rec.onerror = (e) => {
      failed = true;
      const map = { "not-allowed": "not-allowed", "service-not-allowed": "not-allowed", "no-speech": "no-speech", network: "network" } as const;
      handlers.onError(map[e.error as keyof typeof map] ?? "other");
    };
    rec.onend = () => {
      if (!failed) handlers.onFinal(finalText.trim());
    };
    try {
      rec.start();
    } catch {
      handlers.onError("other");
      return null;
    }
    return { stop: () => rec.stop() };
  },

  speak(text: string, lang: string): Promise<void> {
    if (!this.canSpeak()) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const voice = pickVoice(lang);
      if (voice) u.voice = voice;
      u.rate = 0.92;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  },

  cancel() {
    if (this.canSpeak()) window.speechSynthesis.cancel();
  },
};
