"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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

  const baseInp: React.CSSProperties = {
    width: "100%", height: 42,
    padding: "0 14px",
    background: "var(--surface2)",
    border: "1px solid transparent",
    borderRadius: 10,
    fontSize: 15,
    fontFamily: "var(--sans)",
    color: "var(--text)",
    outline: "none",
    transition: "border-color .15s, box-shadow .15s, background .15s",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div
        className="animate-scale-in"
        style={{
          width: "100%", maxWidth: 400,
          background: "var(--surface)",
          borderRadius: 20,
          padding: "40px",
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <Logo variant="auto" height={20} />
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>
            Iniciar sesión
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted)", letterSpacing: "-0.01em" }}>
            Ingresa a tu espacio de trabajo
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--muted2)", letterSpacing: "-0.01em" }}>
              Correo electrónico
            </label>
            <input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com" required
              autoComplete="email"
              style={baseInp}
              onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "var(--ring)"; e.target.style.background = "var(--surface)"; }}
              onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }}
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
                autoComplete="current-password"
                style={{ ...baseInp, paddingRight: 44 }}
                onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "var(--ring)"; e.target.style.background = "var(--surface)"; }}
                onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }}
              />
              <button
                type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: "var(--error-tint)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--error)",
              lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="ds-btn ds-btn-primary ds-btn-lg"
            style={{
              width: "100%", marginTop: 4,
              background: loading ? "var(--muted)" : "var(--brand)",
              boxShadow: loading ? "none" : "0 2px 12px rgba(37,99,235,0.28), 0 4px 20px rgba(37,99,235,0.16)",
            }}
          >
            {loading ? <><Loader2 size={15} className="animate-spin" />Verificando…</> : "Continuar →"}
          </button>
        </form>

        {/* Footer */}
        <p style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: "var(--faint)", fontFamily: "var(--mono)" }}>
          ¿Sin acceso? Contacta al administrador.
        </p>
      </div>
    </div>
  );
}
