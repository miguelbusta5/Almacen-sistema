import Link from "next/link";
import { Package, Truck, BarChart3, Bell, RefreshCw, Globe } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)", fontFamily: "var(--sans)" }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header style={{ background: "var(--text)" }} className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#38bdf820" }}>
            <Package size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ color: "#ffffff", fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>
              Almacén <span style={{ color: "#38bdf8" }}>/ Inventarios</span>
            </div>
            <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Sistema de gestión
            </div>
          </div>
        </div>
        <Link
          href="/login"
          style={{
            background: "#38bdf8",
            color: "#0f172a",
            padding: "0.5rem 1.25rem",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
            transition: "opacity 0.15s",
          }}
          className="hover:opacity-90"
        >
          Iniciar sesión →
        </Link>
      </header>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-6 py-16 md:py-24" style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          style={{
            background: "#0ea5e915",
            color: "var(--blue)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            padding: "0.35rem 1rem",
            borderRadius: 20,
            marginBottom: "1.5rem",
            display: "inline-block",
          }}
        >
          Plataforma empresarial · v2.0
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text)",
            lineHeight: 1.1,
            maxWidth: 640,
            marginBottom: "1.25rem",
          }}
        >
          Control total de tu{" "}
          <span style={{ color: "var(--blue)" }}>inventario</span>{" "}
          en tiempo real
        </h1>
        <p style={{ fontSize: 16, color: "var(--muted2)", maxWidth: 520, lineHeight: 1.6, marginBottom: "2.5rem" }}>
          Gestiona novedades de muebles y pedidos de transporte desde un solo lugar,
          con sincronización multi-dispositivo y alertas inteligentes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            style={{
              background: "var(--blue)",
              color: "#fff",
              padding: "0.75rem 2rem",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            className="hover:opacity-90 transition-opacity"
          >
            <Package size={16} /> Módulo Muebles
          </Link>
          <Link
            href="/login"
            style={{
              background: "var(--orange)",
              color: "#fff",
              padding: "0.75rem 2rem",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            className="hover:opacity-90 transition-opacity"
          >
            <Truck size={16} /> Módulo Transporte
          </Link>
        </div>
      </section>

      {/* ── MÓDULOS ────────────────────────────────────────── */}
      <section className="px-6 py-14 flex flex-col items-center">
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "2rem" }}>
          Módulos disponibles
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full" style={{ maxWidth: 820 }}>

          {/* Card Muebles */}
          <Link href="/login" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                borderRadius: 20,
                padding: "2rem 1.75rem",
                boxShadow: "var(--shadow)",
                position: "relative",
                overflow: "hidden",
                transition: "transform .2s, box-shadow .2s, border-color .2s",
                cursor: "pointer",
              }}
              className="hover:-translate-y-1 hover:shadow-lg group"
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--blue)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#0ea5e9,#6366f1)", borderRadius: "20px 20px 0 0" }} />
              <div style={{ fontSize: 38, marginBottom: "1rem", lineHeight: 1 }}>📦</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--blue)", marginBottom: "0.4rem" }}>Novedades Muebles</div>
              <div style={{ fontSize: 13, color: "var(--muted2)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                Control de incidencias, estados y costos de impacto en la sección de muebles.
              </div>
              <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "0.7rem 1rem", marginBottom: "1.5rem" }}>
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--blue)", display: "inline-block" }} />
                  Registro de PLUs, fabricantes y estados
                </div>
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, marginTop: "0.3rem" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                  Seguimiento de resolución y costos
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.1rem", borderRadius: 10, background: "#0ea5e915", color: "var(--blue)", fontSize: 13, fontWeight: 700 }}>
                <span>Abrir módulo</span>
                <span>→</span>
              </div>
            </div>
          </Link>

          {/* Card Transporte */}
          <Link href="/login" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                borderRadius: 20,
                padding: "2rem 1.75rem",
                boxShadow: "var(--shadow)",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
              }}
              className="hover:-translate-y-1 hover:shadow-lg"
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--orange)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#f97316,#f59e0b)", borderRadius: "20px 20px 0 0" }} />
              <div style={{ fontSize: 38, marginBottom: "1rem", lineHeight: 1 }}>🚛</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--orange)", marginBottom: "0.4rem" }}>Guardados Transporte</div>
              <div style={{ fontSize: 13, color: "var(--muted2)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                Gestión de pedidos guardados, despachos y costos de almacenaje de clientes.
              </div>
              <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "0.7rem 1rem", marginBottom: "1.5rem" }}>
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--orange)", display: "inline-block" }} />
                  Alertas de entregas próximas (5 días)
                </div>
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, marginTop: "0.3rem" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--amber)", display: "inline-block" }} />
                  Cálculo automático de almacenaje ($150k/mes)
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.1rem", borderRadius: 10, background: "#f9731615", color: "var(--orange)", fontSize: 13, fontWeight: 700 }}>
                <span>Abrir módulo</span>
                <span>→</span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <section style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }} className="px-6 py-14">
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center", marginBottom: "0.75rem" }}>
          Por qué usar este sistema
        </p>
        <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", color: "var(--text)", marginBottom: "2.5rem" }}>
          Diseñado para operaciones reales
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ maxWidth: 1000, margin: "0 auto" }}>
          {[
            { icon: <RefreshCw size={22} />, title: "Sincronización multi-dispositivo", desc: "Los datos se actualizan en tiempo real en celular, tablet y computadora.", color: "var(--blue)" },
            { icon: <Bell size={22} />, title: "Alertas inteligentes", desc: "Notificaciones de entregas próximas a vencer y novedades sin resolver.", color: "var(--red)" },
            { icon: <BarChart3 size={22} />, title: "Análisis visual", desc: "Gráficos y KPIs para tomar decisiones basadas en datos reales.", color: "var(--purple)" },
            { icon: <Globe size={22} />, title: "Acceso desde cualquier lugar", desc: "Solo necesitas un navegador web. Sin instalaciones requeridas.", color: "var(--green)" },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "1.5rem",
                transition: "transform .15s, box-shadow .15s",
              }}
              className="hover:-translate-y-1 hover:shadow-md"
            >
              <div style={{ color: f.color, marginBottom: "0.75rem" }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {f.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted2)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
          Almacén / Inventarios v2.0 — Sistema de Gestión Empresarial
        </span>
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
          {new Date().getFullYear()} · Built with Next.js + PostgreSQL
        </span>
      </footer>
    </div>
  );
}
