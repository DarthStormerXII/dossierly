const PATHS = {
  case: "M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z",
  prepare: "M9 5h10M9 12h10M9 19h10M4 4.5l1 1 2-2M4 11.5l1 1 2-2M4.5 19h1",
  meet: "M3 10h18M6 10v8M18 10v8M8 6.5a2 2 0 1 0 0-.01M16 6.5a2 2 0 1 0 0-.01",
  letter: "M3.5 6h17v12h-17zM3.5 6.5l8.5 6.5 8.5-6.5",
  shield: "M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6zM9 12l2.2 2.2L15.5 10",
  mic: "M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21",
  speak: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  copy: "M8.5 8.5h11v11h-11zM5 15.5H4.5v-11h11V5",
  calendar: "M4 6.5h16v13.5H4zM4 10.5h16M8.5 4v4M15.5 4v4",
  camera: "M3.5 8h4l1.5-2.5h6L16.5 8h4v11h-17zM12 16.5a3.2 3.2 0 1 0 0-.01",
  file: "M6 3.5h8.5L19 8v12.5H6zM14 3.5V8.5h5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  lock: "M6 10.5h12v10H6zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  keyboard: "M3 7h18v10H3zM6.5 10.5h.01M10 10.5h.01M13.5 10.5h.01M17 10.5h.01M7 14h10",
  flip: "M4 8h13l-3-3M20 16H7l3 3",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
