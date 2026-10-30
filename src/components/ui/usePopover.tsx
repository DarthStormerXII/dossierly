"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type Placement = "below" | "above" | "sheet";

const SHEET_QUERY = "(max-width: 599px)";

/**
 * Shared open/close, click-outside and placement logic for the Select and DatePicker popovers.
 * Below the trigger by default, flipped above when there is no room, a bottom sheet on phones.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>("below");
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  const show = useCallback(() => {
    setPlacement(window.matchMedia(SHEET_QUERY).matches ? "sheet" : "below");
    setOpen(true);
  }, []);

  // Flip above when the popover would run past the bottom of the viewport and there is more room above.
  useLayoutEffect(() => {
    if (!open || placement === "sheet" || !trigger.current || !pop.current) return;
    const r = trigger.current.getBoundingClientRect();
    const h = pop.current.offsetHeight;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    if (h > below && above > below) setPlacement("above");
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  // Phones: keep the page behind the sheet still.
  useEffect(() => {
    if (!open || placement !== "sheet") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, placement]);

  /** Close when keyboard focus leaves the control (Tab away); clicks are handled above. */
  const onBlur = useCallback(
    (e: React.FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (open && next && wrap.current && !wrap.current.contains(next)) close(false);
    },
    [open, close],
  );

  return { open, show, close, placement, wrap, trigger, pop, onBlur };
}

export function Chevron() {
  return (
    <svg className="ui-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
