/** Dossierly mark: a passport booklet with its spine and a round seal. Themed through CSS tokens. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-57 0 589 588" aria-hidden="true" focusable="false">
      <path
        fill="var(--ink)"
        fillRule="evenodd"
        d="M30 0H45V588H30A30 30 0 0 1 0 558V30A30 30 0 0 1 30 0ZM61 0H330A145 145 0 0 1 475 145V558A30 30 0 0 1 445 588H61ZM182 199a86 86 0 1 0 172 0a86 86 0 1 0-172 0Z"
      />
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">Dossierly</span>
    </span>
  );
}
