"use client";

import { useEffect } from "react";

/**
 * Turns on scroll reveals for [data-reveal] elements inside .lp, and keeps the journey
 * chips in step with the section in view. Nothing is hidden until this runs, and nothing
 * moves for people who ask for reduced motion.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root || typeof IntersectionObserver === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    let reveal: IntersectionObserver | undefined;
    if (!reduce) {
      root.dataset.motion = "on";
      reveal = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.add("is-in");
            reveal?.unobserve(e.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
      );
      targets.forEach((t) => reveal?.observe(t));
    }

    const chips = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-step-link]"));
    const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-step]"));
    const setActive = (id: string) => {
      for (const c of chips) {
        const on = c.dataset.stepLink === id;
        c.classList.toggle("is-active", on);
        if (on) c.setAttribute("aria-current", "step");
        else c.removeAttribute("aria-current");
      }
    };
    // The active step is the last one whose top has passed 55% of the viewport; the first step by default.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.55;
      let current = steps[0]?.dataset.step ?? "";
      for (const s of steps) if (s.getBoundingClientRect().top < line) current = s.dataset.step ?? current;
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      reveal?.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      delete root.dataset.motion;
    };
  }, []);
  return null;
}
