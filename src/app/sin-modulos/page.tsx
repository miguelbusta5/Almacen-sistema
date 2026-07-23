import { ShieldAlert } from "lucide-react";
import Logo from "@/components/common/Logo";

// Fallback para una sesión válida cuyo rol no tiene ningún módulo visible
// (MODULE_ACCESS vacío para ese rol). No debería pasar en la práctica.
export default function SinModulosPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "clamp(16px, 4vw, 32px)",
        background: "var(--bg)",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <Logo variant="auto" height={20} />
        <ShieldAlert size={32} color="var(--warning)" style={{ margin: "24px auto 12px", display: "block" }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Sin módulos asignados
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Tu cuenta no tiene ningún módulo habilitado todavía. Contacta a un administrador para
          que te asigne el rol correcto.
        </p>
      </div>
    </div>
  );
}
