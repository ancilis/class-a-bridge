import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from "react";

type Tone = "neutral" | "info" | "positive" | "warning" | "critical";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props} />;
}

export function StatusPill({
  tone = "neutral",
  children,
}: PropsWithChildren<{ readonly tone?: Tone }>) {
  return <span className={`status status--${tone}`}>{children}</span>;
}

export function Card({
  title,
  eyebrow,
  actions,
  children,
  className = "",
}: PropsWithChildren<{
  readonly title?: string;
  readonly eyebrow?: string;
  readonly actions?: ReactNode;
  readonly className?: string;
}>) {
  const id = title ? `card-${title.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}` : undefined;
  return (
    <section className={`card ${className}`.trim()} aria-labelledby={id}>
      {(title ?? eyebrow ?? actions) && (
        <div className="card__header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 id={id}>{title}</h2>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </div>
      )}
      <div className="card__body">{children}</div>
    </section>
  );
}

export function Callout({
  title,
  tone = "info",
  children,
}: PropsWithChildren<{ readonly title: string; readonly tone?: Tone }>) {
  return (
    <div className={`callout callout--${tone}`} role="status">
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}

export function ProgressTrack({
  current,
  total,
  label,
}: {
  readonly current: number;
  readonly total: number;
  readonly label: string;
}) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal);
  return (
    <div className="progress-track">
      <div className="progress-track__label">
        <span>{label}</span>
        <span>
          {safeCurrent} of {safeTotal}
        </span>
      </div>
      <div
        className="progress-track__bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCurrent}
      >
        <span style={{ width: `${(safeCurrent / safeTotal) * 100}%` }} />
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: PropsWithChildren<{ readonly label: string; readonly hint?: string; readonly error?: string }>) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {hint && <span className="field__hint">{hint}</span>}
      {children}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: PropsWithChildren<{ readonly title: string; readonly action?: ReactNode }>) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <div>{children}</div>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function VisuallyHidden({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`visually-hidden ${className}`.trim()} {...props} />;
}
