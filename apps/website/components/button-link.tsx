import type { ReactNode } from "react";

interface ButtonLinkProps {
  readonly children: ReactNode;
  readonly href: string;
  readonly variant?: "primary" | "secondary" | "quiet";
}

export function ButtonLink({ children, href, variant = "primary" }: ButtonLinkProps) {
  const external = href.startsWith("https://");

  return (
    <a
      className={`button button--${variant}`}
      href={href}
      rel={external ? "noreferrer" : undefined}
    >
      {children}
      <span aria-hidden="true">{external ? " ↗" : " →"}</span>
    </a>
  );
}
