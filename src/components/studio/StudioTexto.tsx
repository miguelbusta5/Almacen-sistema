"use client";

import type { ComponentStyle } from "@/types/studio";

interface Props {
  estilo: ComponentStyle;
  contenido?: string;
}

export function StudioTexto({ estilo, contenido }: Props) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "12px 16px",
        background: estilo.colorFondo ?? "transparent",
      }}
    >
      <div
        style={{
          fontSize: estilo.tamanoTexto ?? 16,
          fontWeight: 600,
          color: estilo.color ?? "var(--text)",
          textAlign: estilo.alineacion ?? "left",
          width: "100%",
        }}
      >
        {contenido ?? estilo.titulo ?? "Texto"}
      </div>
    </div>
  );
}
