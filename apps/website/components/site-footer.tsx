import { footerGroups } from "../content/site-content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__grid">
        <div className="site-footer__intro">
          <a className="brand brand--footer" href="/">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <span>
              <strong>Class A Bridge</strong>
              <small>by Ancilis</small>
            </span>
          </a>
          <p>
            Open-source, local-first FedRAMP 20x Class A preparation for teams starting with SOC 2
            Type II.
          </p>
          <p className="site-footer__boundary">
            Not affiliated with, endorsed by, or certified by GSA or FedRAMP.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="site-footer__nav">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="shell site-footer__bottom">
        <p>© 2026 Ancilis. Source code licensed under Apache-2.0.</p>
        <p>Preparation support, not certification or legal advice.</p>
      </div>
    </footer>
  );
}
