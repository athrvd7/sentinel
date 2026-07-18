import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/">
        sentinel<span>.</span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/#safeguards">Safeguards</Link>
        <Link href="/case">Check case</Link>
        <Link href="/investigator">Investigator access</Link>
      </nav>
      <Link className="nav-action" href="/submit">Submit evidence</Link>
    </header>
  );
}
