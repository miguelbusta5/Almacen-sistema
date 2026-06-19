import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { getModuleCssVars, getModuleTheme, type ModuleThemeKey } from "@/lib/moduleTheme";

type ModuleHeroMetric = {
  label: string;
  value: string | number;
  tone?: "module" | "info" | "success" | "warning" | "danger";
};

const TONE_VAR: Record<NonNullable<ModuleHeroMetric["tone"]>, string> = {
  module: "var(--mod-color)",
  info: "var(--state-info, #38BDF8)",
  success: "var(--state-success, #34D399)",
  warning: "var(--state-warning, #FBBF24)",
  danger: "var(--state-danger, #FB7185)",
};

export interface ModuleHeroProps {
  moduleKey: ModuleThemeKey | string;
  title?: string;
  description?: string;
  kicker?: string;
  actions?: ReactNode;
  metrics?: ModuleHeroMetric[];
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ModuleHero({
  moduleKey,
  title,
  description,
  kicker,
  actions,
  metrics,
  compact = false,
  className,
  style,
}: ModuleHeroProps) {
  const theme = getModuleTheme(moduleKey);
  const vars = getModuleCssVars(moduleKey) as CSSProperties;
  const mergedStyle = { ...vars, ...style } as CSSProperties;

  return (
    <section className={`module-hero${compact ? " module-hero-compact" : ""}${className ? ` ${className}` : ""}`} style={mergedStyle}>
      <div className="module-hero-main">
        <div className="module-hero-copy">
          {kicker && <div className="module-hero-kicker">{kicker}</div>}
          <h1>{title ?? theme.label}</h1>
          {(description ?? theme.description) && <p>{description ?? theme.description}</p>}
        </div>

        {metrics && metrics.length > 0 && (
          <div className="module-hero-metrics">
            {metrics.map((metric) => (
              <div
                className="module-hero-metric"
                key={`${metric.label}-${metric.value}`}
                style={{ "--metric-color": TONE_VAR[metric.tone ?? "module"] } as CSSProperties}
              >
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        )}

        {actions && <div className="module-hero-actions">{actions}</div>}
      </div>

      {!compact && (
        <div className="module-hero-media" aria-hidden="true">
          <Image
            src={theme.heroImage}
            alt=""
            width={420}
            height={240}
            priority
            sizes="(max-width: 760px) 0px, 34vw"
          />
        </div>
      )}
    </section>
  );
}
