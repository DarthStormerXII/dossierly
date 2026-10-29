"use client";

import { useState } from "react";
import { Icon } from "./Icon";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      setDone(false);
    }
  };
  return (
    <button type="button" className="btn btn-small" onClick={() => void copy()} aria-live="polite">
      <Icon name={done ? "check" : "copy"} size={18} />
      {done ? "Copied" : label}
    </button>
  );
}
