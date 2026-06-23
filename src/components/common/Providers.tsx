"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { CommandPaletteProvider, useCommandPalette } from "@/contexts/CommandPaletteContext";
import { ToastProvider } from "@/contexts/ToastContext";
import CommandPalette from "@/components/ui/CommandPalette";

// Listener de Ctrl+K / Cmd+K — vive dentro del provider para acceder al contexto
function KeyboardShortcut() {
  const { toggle } = useCommandPalette();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <CommandPaletteProvider>
          <KeyboardShortcut />
          <CommandPalette />
          {children}
        </CommandPaletteProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
