import type { CSSProperties, ReactNode } from "react";

export type PhotoTone = "dusk" | "counter" | "table" | "paper" | "home";

/**
 * A rounded photo card. The image is a CSS background layered over a tone gradient,
 * so the card still looks finished while (or if) the photo is missing.
 * Overlays are siblings of the image layer, so they stay readable to assistive tech.
 */
export function PhotoCard({ src, alt, tone, className = "", children }: {
  src: string; alt: string; tone: PhotoTone; className?: string; children?: ReactNode;
}) {
  const style = { "--photo": `url("${src}")` } as CSSProperties;
  return (
    <div className={`lp-pcard lp-tone-${tone} ${className}`}>
      <div className="lp-photo" style={style} role="img" aria-label={alt} />
      <div className="lp-scrim" aria-hidden="true" />
      {children}
    </div>
  );
}
