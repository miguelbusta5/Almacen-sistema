"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Boxes, Truck, Route } from "lucide-react";
import Logo from "@/components/common/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(), password, redirect: false,
    });
    if (result?.error) { setError("Email o contraseña incorrectos."); setLoading(false); }
    else router.push("/dashboard");
  }

  const inputBase: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "0.72rem 0.95rem",
    fontSize: 15,
    color: "var(--text)",
    outline: "none",
    width: "100%",
    fontFamily: "var(--sans)",
    transition: "border-color .15s, box-shadow .15s, background .15s",
    WebkitAppearance: "none",
  };

  const features = [
    { icon: <Boxes size={15} />, text: "Novedades de inventario" },
    { icon: <Truck size={15} />, text: "Guardados y despachos" },
    { icon: <Route size={15} />, text: "Logística y rutas en tiempo real" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
        background: "var(--bg)",
      }}
    >
      <div
        className="animate-scale-in"
        style={{
          width: "100%", maxWidth: 860,
          display: "grid", gridTemplateColumns: "1fr 1fr",
          background: "var(--surface)",
          borderRadius: 22,
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        {/* ── Panel izquierdo — marca ── */}
        <div
          style={{
            padding: "2.75rem 2.5rem",
            background: "linear-gradient(155deg, #0c1a3a 0%, #0a1020 100%)",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Decoración de fondo */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(37,99,235,0.25) 0%, transparent 60%)",
          }} />
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 60% 40% at 100% 100%, rgba(99,102,241,0.15) 0%, transparent 60%)",
          }} />

          <div style={{ position: "relative" }}>
            <Logo variant="dark" height={20} tagline />
          </div>

          <div style={{ position: "relative", marginTop: "2.5rem" }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.03em", marginBottom: "1.5rem" }}>
              Control total de tu almacén.
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              {features.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(200,215,255,0.75)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "rgba(147,185,255,0.9)" }}>
                    {f.icon}
                  </span>
                  {f.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Panel derecho — formulario ── */}
        <div style={{ padding: "2.75rem 2.5rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: 6 }}>
              Iniciar sesión
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              Ingresa tus credenciales para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--muted2)", letterSpacing: "-0.01em" }}>
                Correo electrónico
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com" required
                style={inputBase}
                onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "var(--ring)"; e.target.style.background = "var(--surface)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--muted2)", letterSpacing: "-0.01em" }}>
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ ...inputBase, paddingRight: "2.75rem" }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "var(--ring)"; e.target.style.background = "var(--surface)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }}
                />
                <button
                  type="button" onClick={() => setShowPass(!showPass)}
                  aria-label="Mostrar/ocultar contraseña"
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10, padding: "0.6rem 0.9rem", fontSize: 13, color: "var(--red)", letterSpacing: "-0.01em" }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                marginTop: "0.25rem",
                background: loading ? "var(--muted)" : "var(--brand-grad)",
                color: "#fff", border: "none", borderRadius: 12,
                padding: "0.9rem",
                fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: loading ? "none" : "0 4px 18px rgba(29,78,216,0.35)",
                transition: "opacity .15s, box-shadow .15s, transform .15s",
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 22px rgba(29,78,216,0.45)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = loading ? "none" : "0 4px 18px rgba(29,78,216,0.35)"; }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Verificando…</> : "Iniciar sesión"}
            </button>
          </form>

          <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
            ¿Sin cuenta? Contacta al administrador.
          </p>
        </div>
      </div>

      {/* Responsive: apilar en mobile */}
      <style>{`
        @media (max-width: 640px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-brand { display: none !important; }
        }
      `}</style>
    </div>
  );
}
