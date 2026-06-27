"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { THEME_TOGGLE_ENABLED } from "@/config/featureFlags";

/**
 * Botón para alternar tema claro/oscuro. Gateado por `THEME_TOGGLE_ENABLED`:
 * mientras esté en `false` no se renderiza (el oscuro queda como único tema
 * visible). Persistencia por dispositivo (localStorage) vía `useTheme`.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  if (!THEME_TOGGLE_ENABLED) return null;

  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      className="g-btn g-btn-ghost g-btn-icon g-btn-sm"
      aria-label={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={isLight ? "Modo oscuro" : "Modo claro"}
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
