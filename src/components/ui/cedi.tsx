import type { ReactNode } from "react";

export function CediPage({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="cedi-page animate-fade-in">
      <section className="cedi-hero">
        <div>
          <div className="cedi-kicker">Control Logístico CEDI</div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="cedi-actions">{actions}</div>}
      </section>
      {children}
    </div>
  );
}

export function CediPanel({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="cedi-panel">
      {(title || actions) && (
        <div className="cedi-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function CediStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="cedi-stat">
      <div className="cedi-stat-label">{label}</div>
      <div className="cedi-stat-value">{value}</div>
      {hint && <div className="cedi-stat-hint">{hint}</div>}
    </div>
  );
}

export function CediBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "warning" | "danger";
}) {
  return <span className={`cedi-badge cedi-badge-${tone}`}>{children}</span>;
}

export function CediEmpty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="cedi-empty">
      <div className="cedi-empty-mark" />
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  );
}
