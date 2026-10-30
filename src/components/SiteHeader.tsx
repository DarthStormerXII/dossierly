import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-bar">
        <Link href="/" aria-label="Dossierly home" className="logo-link"><Logo /></Link>
        <nav aria-label="Main" className="site-nav">
          <Link href="/#how">How it works</Link>
          <Link href="/#privacy">Privacy</Link>
          <Link href="/countries">Countries</Link>
          <Link href="/pricing" className="nav-pricing">Pricing</Link>
        </nav>
        <div className="site-actions">
          <Link href="/pricing" className="nav-pricing-sm">Pricing</Link>
          <Link href="/signin" className="btn btn-ghost btn-small nav-signin">Sign in</Link>
          <Link href="/signup" className="btn btn-primary btn-small">Get started</Link>
        </div>
      </div>
    </header>
  );
}
