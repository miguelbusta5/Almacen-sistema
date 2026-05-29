"use client";
import { Truck } from "lucide-react";

// Placeholder — migración completa en Fase 2
export default function TransportePage() {
  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "2rem" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f9731615", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Truck size={20} color="var(--orange)" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Guardados Transporte</h1>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Módulo en migración — disponible en Fase 2</p>
        </div>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3rem 2rem", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: "1rem" }}>🚛</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>Módulo en construcción</div>
        <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 400, margin: "0 auto" }}>
          El módulo de Transporte está siendo migrado al nuevo stack. Mientras tanto, usa la versión anterior.
        </div>
        <a
          href="https://miguelbusta5.github.io/novedades-muebles/transporte.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: "1.5rem", padding: "0.7rem 1.5rem", background: "var(--orange)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          Ir a versión anterior →
        </a>
      </div>
    </div>
  );
}
