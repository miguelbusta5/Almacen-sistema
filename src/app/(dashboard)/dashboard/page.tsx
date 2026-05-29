"use client";

import Link from "next/link";
import { Package, Truck, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Panel de Control
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          Selecciona un módulo para gestionar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ maxWidth: 760 }}>

        {/* Muebles */}
        <Link href="/dashboard/muebles" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              borderRadius: 16,
              padding: "1.75rem",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
              transition: "transform .2s, box-shadow .2s, border-color .2s",
            }}
            className="hover:-translate-y-1 hover:shadow-lg group"
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--blue)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#0ea5e9,#6366f1)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "#0ea5e915", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={20} color="var(--blue)" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--blue)" }}>Novedades Muebles</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Control de incidencias y estados</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1rem", borderRadius: 8, background: "#0ea5e915", color: "var(--blue)", fontSize: 12, fontWeight: 700 }}>
              <span>Abrir módulo</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </Link>

        {/* Transporte */}
        <Link href="/dashboard/transporte" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              borderRadius: 16,
              padding: "1.75rem",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
              transition: "transform .2s, box-shadow .2s, border-color .2s",
            }}
            className="hover:-translate-y-1 hover:shadow-lg"
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--orange)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#f97316,#f59e0b)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "#f9731615", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Truck size={20} color="var(--orange)" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--orange)" }}>Guardados Transporte</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Despachos y costos de almacenaje</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1rem", borderRadius: 8, background: "#f9731615", color: "var(--orange)", fontSize: 12, fontWeight: 700 }}>
              <span>Abrir módulo</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
