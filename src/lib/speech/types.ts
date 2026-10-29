export interface ListenHandlers {
  onInterim(text: string): void;
  /** Called once after stop() with the full transcript (may be empty). */
  onFinal(text: string): void;
  onError(code: "not-allowed" | "no-speech" | "network" | "unsupported" | "other"): void;
}

export interface ListenHandle {
  stop(): void;
}

/**
 * Swap point for speech. The default is the browser Web Speech API; a
 * Parakeet/Canary endpoint on Nebius Serverless can implement this later.
 */
export interface SpeechProvider {
  readonly id: string;
  canListen(): boolean;
  canSpeak(): boolean;
  listen(lang: string, handlers: ListenHandlers): ListenHandle | null;
  speak(text: string, lang: string): Promise<void>;
  cancel(): void;
}
