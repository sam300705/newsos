import Link from "next/link";

const primaryLinks = [
  ["Latest", "/latest"],
  ["AI", "/category/ai"],
  ["Startups", "/category/startups"],
  ["Search", "/search"],
  ["About", "/about"],
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" href="/" aria-label="NewsOS home">
          NEWS<span>OS</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {primaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="nav-actions">
          <Link className="following-link" href="/following">Following</Link>
          <Link className="button-link" href="/admin">Newsroom</Link>
          <details className="mobile-menu">
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile navigation">
              {primaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
              <Link href="/following">Following</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
