"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ListenHandle } from "@/lib/speech/types";
import { webSpeech } from "@/lib/speech/webspeech";

export type ListenState = "idle" | "listening" | "error";

/** Tap-to-talk speech recognition. Audio is handled by the browser and never stored or uploaded by Dossierly. */
export function useListen(lang: string, onText: (text: string) => void) {
  const [state, setState] = useState<ListenState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const handle = useRef<ListenHandle | null>(null);

  useEffect(() => {
    // Feature detection needs window; it is not available during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(webSpeech.canListen());
    return () => handle.current?.stop();
  }, []);

  const start = useCallback(() => {
    setError("");
    setInterim("");
    webSpeech.cancel();
    handle.current = webSpeech.listen(lang, {
      onInterim: setInterim,
      onFinal: (t) => {
        setState("idle");
        setInterim("");
        handle.current = null;
        if (t) onText(t);
      },
      onError: (code) => {
        setState("error");
        handle.current = null;
        setError(code === "not-allowed" ? "Microphone blocked. Allow it in the browser, or type instead." : code === "no-speech" ? "Nothing heard. Try again, or type." : "Speech recognition stopped. Try again, or type.");
      },
    });
    if (handle.current) setState("listening");
  }, [lang, onText]);

  const stop = useCallback(() => handle.current?.stop(), []);
  const toggle = useCallback(() => (state === "listening" ? stop() : start()), [state, start, stop]);
  return { state, interim, error, supported, toggle };
}
