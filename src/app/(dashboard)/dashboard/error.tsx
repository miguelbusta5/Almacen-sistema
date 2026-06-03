"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log en consola para debugging (no en producción para usuarios)
    console.error("[Dashboard error]", error.digest ?? error.message);
  }, [error]);

  const isSocketError =
    error.message?.includes("socket") ||
    error.message?.includes("connection") ||
    error.message?.includes("fetch");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 20,
        padding: 32,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "var(--warning-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertTriangle size={24} color="var(--warning)" />
      </div>

      <div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          {isSocketError ? "Error de conexión" : "Algo salió mal"}
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 340, lineHeight: 1.6 }}>
          {isSocketError
            ? "La conexión se interrumpió. Esto puede ocurrir durante momentos de alta demanda. Intenta de nuevo."
            : "Ocurrió un error inesperado. Si persiste, contacta al administrador."}
        </p>
      </div>

      <button
        onClick={reset}
        className="ds-btn ds-btn-secondary"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <RefreshCw size={14} />
        Reintentar
      </button>
    </div>
  );
}
