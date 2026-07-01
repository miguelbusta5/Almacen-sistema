"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import Logo from "@/components/common/Logo";
import { apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";

const baseInp: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 14px",
  background: "var(--surface2)",
  border: "1px solid var(--border-strong)",
  borderRadius: 10,
  fontSize: 15,
  fontFamily: "var(--sans)",
  color: "var(--text)",
  outline: "none",
};

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--muted2)" }}>
      {label}
      <span style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          style={{ ...baseInp, paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  );
}

export function CambiarPasswordForm({ forzado }: { forzado: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/api/users/me/password", { currentPassword, newPassword });
      await signOut({ callbackUrl: "/login?passwordChanged=1" });
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo cambiar la contraseña"));
      setLoading(false);
    }
  }

  return (
    <div
      className="login-page"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(900px 500px at 18% -10%, rgba(20,219,160,0.10), transparent 60%), linear-gradient(180deg, #0B0E11 0%, #08090B 100%)",
        display: "grid",
        placeItems: "center",
        padding: "clamp(16px, 4vw, 32px)",
      }}
    >
      <main style={{ width: "100%", maxWidth: 440 }}>
        <section
          className="login-form-panel"
          style={{
            background: "var(--surface)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            padding: "clamp(24px, 5vw, 40px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ marginBottom: 22 }}>
            <Logo variant="dark" height={18} />
          </div>

          <div style={{ marginBottom: 26 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: "var(--accent-tint)",
                color: "var(--accent)",
                border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
                marginBottom: 16,
              }}
            >
              <KeyRound size={22} />
            </div>
            <h1 style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
              Cambiar contraseña
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>
              {forzado
                ? "Tu contraseña es temporal. Debes definir una nueva antes de continuar."
                : "Define una nueva contraseña para tu cuenta."}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PasswordField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            <PasswordField label="Contraseña nueva" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            <PasswordField label="Confirmar contraseña nueva" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />

            {error && (
              <div style={{ background: "var(--error-tint)", border: "1px solid color-mix(in srgb, var(--error) 26%, transparent)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "var(--error)", fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="ds-btn ds-btn-primary ds-btn-lg" style={{ width: "100%", marginTop: 4 }}>
              {loading ? <><Loader2 size={15} className="animate-spin" />Guardando...</> : "Guardar y volver a iniciar sesión"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
