import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacturaIntelBanner } from "@/app/(dashboard)/dashboard/tienda/_components";
import type { IntelInsight } from "@/lib/inteligencia";

// Fase 4 (mejora UX Facturas Contado): el banner destaca la primera alerta y
// muestra las demás como chips por nivel (clicables solo si traen recordId).

const critica: IntelInsight = {
  id: "tienda-pendientes-24h",
  level: "critical",
  module: "tienda",
  message: "2 despachos llevan más de 24h sin ser recogidos",
  context: "36008 · 36011",
};

const warningConRecord: IntelInsight = {
  id: "tienda-con-novedad",
  level: "warning",
  module: "tienda",
  message: "1 despacho registrado con novedad",
  recordId: "row-9",
};

const infoSinRecord: IntelInsight = {
  id: "tienda-cc-concentrado",
  level: "info",
  module: "tienda",
  message: "Un centro concentra el 40% del volumen de hoy",
};

describe("FacturaIntelBanner — alertas operativas en lista", () => {
  it("sin insights no renderiza nada", () => {
    expect(renderToStaticMarkup(<FacturaIntelBanner insights={[]} />)).toBe("");
  });

  it("con 1 insight: destacada sin chips ni contador", () => {
    const html = renderToStaticMarkup(<FacturaIntelBanner insights={[critica]} />);
    expect(html).toContain("más de 24h sin ser recogidos");
    expect(html).toContain("36008 · 36011");
    expect(html).not.toContain("alertas");
  });

  it("con N insights: contador y chips para las restantes", () => {
    const html = renderToStaticMarkup(
      <FacturaIntelBanner insights={[critica, warningConRecord, infoSinRecord]} onOpenRecord={() => {}} />,
    );
    expect(html).toContain("3 alertas");
    // La primera va destacada, no como chip.
    expect(html).toContain("más de 24h sin ser recogidos");
    expect(html).toContain("registrado con novedad");
    expect(html).toContain("40% del volumen");
  });

  it("chip con recordId es botón; sin recordId es span estático", () => {
    const html = renderToStaticMarkup(
      <FacturaIntelBanner insights={[critica, warningConRecord, infoSinRecord]} onOpenRecord={() => {}} />,
    );
    const chipButton = html.match(/<button[^>]*>[^<]*<span[^>]*><\/span>1 despacho registrado con novedad<\/button>/);
    expect(chipButton).not.toBeNull();
    const chipSpan = html.includes("Un centro concentra el 40% del volumen de hoy</span>");
    expect(chipSpan).toBe(true);
  });

  it("sin onOpenRecord ningún chip es botón", () => {
    const html = renderToStaticMarkup(
      <FacturaIntelBanner insights={[critica, warningConRecord]} />,
    );
    expect(html).not.toContain("<button");
  });
});
