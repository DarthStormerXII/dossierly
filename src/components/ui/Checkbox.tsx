"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "className"> & {
  checked: boolean;
  onChange(checked: boolean): void;
  children: ReactNode;
  className?: string;
};

/** A drawn checkbox over a visually hidden native input, so forms, focus and screen readers behave as usual. */
export function Checkbox({ checked, onChange, children, className, ...input }: Props) {
  return (
    <label className={`ui-check${className ? ` ${className}` : ""}`}>
      <input {...input} type="checkbox" className="ui-check-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-check-box" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="ui-check-label">{children}</span>
    </label>
  );
}
