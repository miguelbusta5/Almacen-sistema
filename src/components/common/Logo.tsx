// Logotipo Grupo Ambiente. El archivo /logo.png es un wordmark negro (356x131)
// sobre transparente. En fondos oscuros se invierte a blanco vía CSS.
//   variant="dark"  → siempre blanco (fondos oscuros fijos: sidebar, panel login)
//   variant="auto"  → blanco solo en tema oscuro (superficies que cambian con el tema)
//   variant="light" → sin invertir (negro)

const RATIO = 356 / 131;

interface LogoProps {
  variant?: "light" | "dark" | "auto";
  height?: number;
  tagline?: boolean;
}

export default function Logo({ variant = "auto", height = 26, tagline = false }: LogoProps) {
  const cls = variant === "dark" ? "logo-invert" : variant === "auto" ? "logo-auto" : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span
        aria-hidden
        style={{ width: 4, height: height + (tagline ? 16 : 4), borderRadius: 4, background: "var(--brand-grad)", flexShrink: 0 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, lineHeight: 1 }}>
        {tagline && (
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: variant === "dark" ? "#8aa0c6" : "var(--muted)" }}>
            Torre CEDI
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Grupo Ambiente"
          className={cls}
          style={{ height, width: height * RATIO, objectFit: "contain", display: "block" }}
        />
      </div>
    </div>
  );
}
