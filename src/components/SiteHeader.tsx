import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap row between">
        <Link href="/" aria-label="Dossierly home" className="logo-link"><Logo /></Link>
        <nav aria-label="Main" className="site-nav">
          <Link href="/#how">How it works</Link>
          <Link href="/#privacy">Privacy</Link>
          <Link href="/countries">Countries</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <Link href="/app" className="btn btn-primary btn-small">Open my case</Link>
      </div>
    </header>
  );
}
