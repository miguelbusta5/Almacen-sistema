import type { CSSProperties, ReactNode } from "react";
import { PageShell, type PageShellProps } from "./pageShell";

// CediPage se mantiene como alias delgado de PageShell para no romper
// las páginas que ya lo usan (transporte).
// Acepta además moduleKey/moduleColor/kicker vía PageShell.
export function CediPage(props: PageShellProps) {
  return <PageShell {...props} />;
}

export function CediPanel({
  title,
  description,
  children,
  actions,
  style,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section className="cedi-panel" style={style}>
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
  color,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="cedi-stat" style={{ "--stat-color": color } as CSSProperties}>
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
