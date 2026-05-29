"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Package, Eye, EyeOff, Loader2 } from "lucide-react";

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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--text)" }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 24,
          padding: "2.5rem 2rem",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 24px 64px #00000040",
        }}
        className="animate-fade-in"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#0ea5e915",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <Package size={26} color="var(--blue)" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>
            Almacén <span style={{ color: "var(--blue)" }}>/ Inventarios</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: "0.3rem" }}>
            Inicia sesión para continuar
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.65rem 0.9rem",
                fontFamily: "var(--mono)",
                fontSize: 13,
                color: "var(--text)",
                outline: "none",
                width: "100%",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--blue)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              Contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.65rem 2.5rem 0.65rem 0.9rem",
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  color: "var(--text)",
                  outline: "none",
                  width: "100%",
                }}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: "#ef444415", border: "1px solid #ef444430", borderRadius: 8, padding: "0.6rem 0.9rem", fontSize: 12, color: "var(--red)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "var(--muted)" : "var(--blue)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "0.8rem",
              fontFamily: "var(--sans)",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: "0.5rem",
              transition: "opacity .15s",
            }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Verificando...</> : "Iniciar sesión →"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
          ¿No tienes cuenta? Contacta al administrador del sistema.
        </div>
      </div>
    </div>
  );
}
