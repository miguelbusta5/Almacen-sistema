"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck, Boxes, Truck } from "lucide-react";
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
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales incorrectas. Verifica tu email y contraseña.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
    padding: "0.7rem 0.95rem", fontFamily: "var(--mono)", fontSize: 13,
    color: "var(--text)", outline: "none", width: "100%", transition: "border-color .15s, box-shadow .15s",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div
        className="grid md:grid-cols-2 animate-fade-in"
        style={{ width: "100%", maxWidth: 880, background: "var(--surface)", borderRadius: 24, overflow: "hidden", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}
      >
        {/* ── Panel de marca ── */}
        <div
          style={{
            position: "relative", padding: "2.5rem 2.25rem", color: "#fff",
            background:
              "radial-gradient(120% 90% at 0% 0%, #1e40af 0%, transparent 55%)," +
              "radial-gradient(120% 120% at 100% 100%, #2563eb55 0%, transparent 50%)," +
              "linear-gradient(155deg, #0a1326 0%, #0d1c39 100%)",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            minHeight: 340,
          }}
        >
          <Logo variant="dark" height={22} tagline />

          <div style={{ marginTop: "2rem" }}>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              Control total de tu<br /><span className="brand-text" style={{ filter: "brightness(1.6)" }}>almacén</span> en un solo lugar.
            </div>
            <div style={{ marginTop: "1.75rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {[
                { icon: <Boxes size={16} />, t: "Novedades de inventario con impacto económico" },
                { icon: <Truck size={16} />, t: "Guardados y despachos con cobro de almacenaje" },
                { icon: <ShieldCheck size={16} />, t: "Acceso por roles y auditoría de cambios" },
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13, color: "#c3d0e8" }}>
                  <span style={{ display: "flex", width: 30, height: 30, borderRadius: 9, background: "#ffffff14", color: "#9cc0ff", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{f.icon}</span>
                  {f.t}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Formulario ── */}
        <div style={{ padding: "2.75rem 2.25rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>Iniciar sesión</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, marginBottom: "1.75rem" }}>Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com" required style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "var(--ring)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>Contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required style={{ ...inputStyle, paddingRight: "2.5rem" }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "var(--ring)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} aria-label="Mostrar/ocultar contraseña"
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: "#dc262615", border: "1px solid #dc262635", borderRadius: 10, padding: "0.6rem 0.9rem", fontSize: 12, color: "var(--red)" }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                background: loading ? "var(--muted)" : "var(--brand-grad)", color: "#fff", border: "none", borderRadius: 11,
                padding: "0.85rem", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginTop: "0.5rem", boxShadow: loading ? "none" : "0 8px 20px #1d4ed840", transition: "opacity .15s, box-shadow .15s",
              }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Verificando…</> : "Iniciar sesión →"}
            </button>
          </form>

          <div style={{ marginTop: "1.75rem", textAlign: "center", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
            ¿No tienes cuenta? Contacta al administrador del sistema.
          </div>
        </div>
      </div>
    </div>
  );
}
