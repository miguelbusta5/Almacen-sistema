"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Lee/escribe el tema activo (atributo `data-theme` en <html> + `localStorage`).
 * El valor inicial lo fija el script anti-parpadeo de `layout.tsx`; este hook se
 * sincroniza tras montar y permite alternarlo. No toca backend.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(currentTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* almacenamiento no disponible — solo se aplica en esta sesión */
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(currentTheme() === "light" ? "dark" : "light");
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
