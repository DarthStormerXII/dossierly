/** Dossierly mark: a case folder with a sheet inside and a round office stamp. Themed through CSS tokens. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M5 5h7.2l3 3H27a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="var(--brand)" />
      <path d="M8 14h11M8 18.5h7" stroke="var(--brand-ink)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="23.2" cy="21.6" r="3.6" fill="none" stroke="var(--logo-stamp, #a58cff)" strokeWidth="1.8" />
      <circle cx="23.2" cy="21.6" r="1.2" fill="var(--logo-stamp, #a58cff)" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">Dossierly</span>
    </span>
  );
}
