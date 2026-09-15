import { describe, expect, it } from "vitest";
import { calcAlmacenaje, TARIFA_ALM } from "@/lib/almacenaje";

// Helper: fecha = fechaInicio + n días
function dia(fechaInicio: string, n: number): string {
  const d = new Date(fechaInicio + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const INICIO = "2026-01-01";

// ════════════════════════════════════════════════
// REGLA CORRECTA: 30 días de gracia exactos.
// Sin prorrateo. Cobros completos por bloque de 30 días.
//
// Días  0-30 → 0 cobros ($0)
// Días 31-60 → 1 cobro  ($150.000)
// Días 61-90 → 2 cobros ($300.000)
// Días 91-120→ 3 cobros ($450.000)
// ════════════════════════════════════════════════

describe("calcAlmacenaje() — regla de 30 días exactos", () => {

  describe("Período de gracia (días 0-30 → $0)", () => {
    it("Día 0 (mismo día) → gracia, 0 cobros", () => {
      const r = calcAlmacenaje(INICIO, INICIO);
      expect(r.cobrosGenerados).toBe(0);
      expect(r.costoAcumulado).toBe(0);
      expect(r.fase).toBe("gracia");
    });

    it("Día 29 → gracia, 0 cobros, $0", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 29));
      expect(r.diasTranscurridos).toBe(29);
      expect(r.cobrosGenerados).toBe(0);
      expect(r.costoAcumulado).toBe(0);
      expect(r.fase).toBe("gracia");
      expect(r.diasGraciaRestantes).toBe(1);
    });

    it("Día 30 → gracia, 0 cobros, $0 (último día de gracia)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 30));
      expect(r.diasTranscurridos).toBe(30);
      expect(r.cobrosGenerados).toBe(0);
      expect(r.costoAcumulado).toBe(0);
      expect(r.fase).toBe("gracia");
      expect(r.diasGraciaRestantes).toBe(0);
    });
  });

  describe("Primer período de cobro (días 31-60 → 1 cobro)", () => {
    it("Día 31 → 1 cobro, $150.000 (primer cobro generado)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 31));
      expect(r.diasTranscurridos).toBe(31);
      expect(r.cobrosGenerados).toBe(1);
      expect(r.costoAcumulado).toBe(TARIFA_ALM);
      expect(r.costo).toBe(TARIFA_ALM);
      expect(r.fase).toBe("cobro");
    });

    it("Día 60 → 1 cobro, $150.000 (último día del primer período)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 60));
      expect(r.diasTranscurridos).toBe(60);
      expect(r.cobrosGenerados).toBe(1);
      expect(r.costoAcumulado).toBe(TARIFA_ALM);
      expect(r.fase).toBe("cobro");
    });
  });

  describe("Segundo período de cobro (días 61-90 → 2 cobros)", () => {
    it("Día 61 → 2 cobros, $300.000 (segundo cobro generado)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 61));
      expect(r.diasTranscurridos).toBe(61);
      expect(r.cobrosGenerados).toBe(2);
      expect(r.costoAcumulado).toBe(2 * TARIFA_ALM);
      expect(r.costo).toBe(2 * TARIFA_ALM);
    });

    it("Día 90 → 2 cobros, $300.000 (último día del segundo período)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 90));
      expect(r.diasTranscurridos).toBe(90);
      expect(r.cobrosGenerados).toBe(2);
      expect(r.costoAcumulado).toBe(2 * TARIFA_ALM);
    });
  });

  describe("Tercer período de cobro (días 91-120 → 3 cobros)", () => {
    it("Día 91 → 3 cobros, $450.000 (tercer cobro generado)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 91));
      expect(r.diasTranscurridos).toBe(91);
      expect(r.cobrosGenerados).toBe(3);
      expect(r.costoAcumulado).toBe(3 * TARIFA_ALM);
      expect(r.costo).toBe(3 * TARIFA_ALM);
    });
  });

  describe("Períodos adicionales", () => {
    it("Día 120 → 3 cobros, $450.000", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 120));
      expect(r.cobrosGenerados).toBe(3);
      expect(r.costoAcumulado).toBe(3 * TARIFA_ALM);
    });

    it("Día 121 → 4 cobros, $600.000", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 121));
      expect(r.cobrosGenerados).toBe(4);
      expect(r.costoAcumulado).toBe(4 * TARIFA_ALM);
    });
  });

  describe("Campos calculados — coherencia interna", () => {
    it("diasGraciaRestantes correcto dentro de gracia", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 15));
      expect(r.diasGraciaRestantes).toBe(15);
    });

    it("diasHastaProximoCobro = 30 el día justo después del cobro", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 31));
      expect(r.diasHastaProximoCobro).toBe(30);
    });

    it("diasHastaProximoCobro = 1 el día antes del próximo cobro", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 60));
      expect(r.diasHastaProximoCobro).toBe(1);
    });

    it("costoProximo = cobrosGenerados+1 × TARIFA", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 31));
      expect(r.costoProximo).toBe(2 * TARIFA_ALM);
    });

    it("diasEnPeriodo = 1 el día del cobro", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 31));
      expect(r.diasEnPeriodo).toBe(1);
    });

    it("diasEnPeriodo = 30 el último día del período", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 60));
      expect(r.diasEnPeriodo).toBe(30);
    });
  });

  describe("Casos especiales", () => {
    it("Despachado mismo día de ingreso → costo $0", () => {
      const r = calcAlmacenaje(INICIO, INICIO);
      expect(r.costoAcumulado).toBe(0);
      expect(r.fase).toBe("gracia");
    });

    it("Sin endDate → usa hoy, no lanza error", () => {
      expect(() => calcAlmacenaje(INICIO)).not.toThrow();
    });

    it("Sin endDate null → usa hoy, no lanza error", () => {
      expect(() => calcAlmacenaje(INICIO, null)).not.toThrow();
    });
  });
});
