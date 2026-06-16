"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import Logo from "@/components/common/Logo";
import { PRODUCT } from "@/config/product";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  const baseInp: React.CSSProperties = {
    width: "100%",
    height: 44,
    padding: "0 14px",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 15,
    fontFamily: "var(--sans)",
    color: "var(--text)",
    outline: "none",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #07111E 0%, #0A1628 52%, #EEF3F8 52%, #EEF3F8 100%)",
      display: "grid",
      placeItems: "center",
      padding: "clamp(16px, 4vw, 32px)",
    }}>
      <main style={{ width: "min(980px, 100%)", display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(340px, .75fr)", borderRadius: 18, overflow: "hidden", boxShadow: "var(--shadow-xl)", border: "1px solid rgba(255,255,255,0.12)" }}>
        <section style={{
          minHeight: 520,
          padding: "clamp(28px, 5vw, 44px)",
          background: "linear-gradient(135deg, rgba(7,17,30,0.98), rgba(13,31,55,0.94))",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          <Logo variant="dark" height={22} tagline />

          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: "6px 10px", color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: 800, marginBottom: 18 }}>
              <Activity size={14} /> {PRODUCT.statusLabel}
            </div>
            <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1, fontWeight: 900, color: "#fff", margin: 0 }}>
              {PRODUCT.displayName}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.66)", fontSize: 15, lineHeight: 1.65, maxWidth: 560, marginTop: 16 }}>
              Consola interna para controlar inventario, facturas contado, transporte, conteo, preoperacional y exportaciones con trazabilidad por rol.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {["Inventario", "Transporte", "CEDI"].map((label) => (
              <div key={label} style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.055)", borderRadius: 12, padding: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.46)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.10em", fontWeight: 800 }}>Módulo</div>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 800, marginTop: 5 }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: "var(--surface)", padding: "clamp(24px, 5vw, 40px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ marginBottom: 26 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)", marginBottom: 16 }}>
              <ShieldCheck size={22} />
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 850, color: "var(--text)", margin: 0 }}>
              Iniciar sesión
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>
              Ingresa con tu cuenta corporativa para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--muted2)" }}>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                style={baseInp}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--muted2)" }}>
              Contraseña
              <span style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ ...baseInp, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            {error && (
              <div style={{ background: "var(--error-tint)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "var(--error)", fontWeight: 700 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="ds-btn ds-btn-primary ds-btn-lg" style={{ width: "100%", marginTop: 4 }}>
              {loading ? <><Loader2 size={15} className="animate-spin" />Verificando...</> : <>Continuar <ArrowRight size={16} /></>}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: "var(--faint)", fontFamily: "var(--mono)" }}>
            ¿Sin acceso? Contacta al administrador.
          </p>
        </section>
      </main>

      <style jsx>{`
        @media (max-width: 820px) {
          main {
            grid-template-columns: 1fr !important;
          }
          main > section:first-child {
            min-height: 360px !important;
          }
        }
      `}</style>
    </div>
  );
}
