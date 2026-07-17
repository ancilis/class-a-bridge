import { siteNavigation } from "../content/site-content";

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="site-header__inner shell">
        <a className="brand" href="/" aria-label="Class A Bridge home">
          <BrandMark />
          <span>
            <strong>Class A Bridge</strong>
            <small>by Ancilis</small>
          </span>
        </a>

        <nav aria-label="Primary navigation" className="desktop-nav">
          <ul>
            {siteNavigation.map((item) => (
              <li key={item.href}>
                <a className={item.emphasis ? "nav-cta" : undefined} href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <details className="mobile-nav">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            <ul>
              {siteNavigation.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}
