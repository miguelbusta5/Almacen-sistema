import type { CSSProperties, ReactNode } from "react";
import { getModuleColor, type ModuleThemeKey } from "@/lib/moduleTheme";

// ═══════════════════════════════════════════════════════════
// PAGE SHELL — encabezado de página module-aware (Vercel/Linear)
// Aplica el acento de color del módulo vía --mod-color, que cascada
// a tablas/cards hijas (hover tintado). Reutiliza .cedi-hero del DS.
// ═══════════════════════════════════════════════════════════
export interface PageShellProps {
  title: string;
  description?: string;
  kicker?: string;
  /** Clave de módulo para resolver el color de acento automáticamente. */
  moduleKey?: ModuleThemeKey | string;
  /** Color de acento explícito (gana sobre moduleKey). */
  moduleColor?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  title,
  description,
  kicker = "Control Logístico CEDI",
  moduleKey,
  moduleColor,
  actions,
  children,
}: PageShellProps) {
  const color = moduleColor ?? (moduleKey ? getModuleColor(moduleKey) : undefined);
  return (
    <div
      className="cedi-page animate-fade-in"
      style={color ? ({ "--mod-color": color } as CSSProperties) : undefined}
    >
      <section className="cedi-hero">
        <div>
          <div className="cedi-kicker">{kicker}</div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="cedi-actions">{actions}</div>}
      </section>
      {children}
    </div>
  );
}
