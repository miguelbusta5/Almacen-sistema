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
// REGLA: 30 días de gracia exactos, luego $5.000 por cada día.
//
// Día  0-30 → $0 (gracia)
// Día  31   → $5.000  (1 día cobrado)
// Día  60   → $150.000 (30 días cobrados)
// Día  90   → $300.000 (60 días cobrados)
// ════════════════════════════════════════════════

describe("calcAlmacenaje() — 30 días de gracia + $5.000/día", () => {

  describe("Período de gracia (días 0-30 → $0)", () => {
    it("Día 0 (mismo día) → gracia, $0", () => {
      const r = calcAlmacenaje(INICIO, INICIO);
      expect(r.cobrosGenerados).toBe(0);
      expect(r.costoAcumulado).toBe(0);
      expect(r.fase).toBe("gracia");
    });

    it("Día 29 → gracia, $0", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 29));
      expect(r.diasTranscurridos).toBe(29);
      expect(r.cobrosGenerados).toBe(0);
      expect(r.costoAcumulado).toBe(0);
      expect(r.fase).toBe("gracia");
      expect(r.diasGraciaRestantes).toBe(1);
    });

    it("Día 30 → gracia, $0 (último día de gracia)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 30));
      expect(r.diasTranscurridos).toBe(30);
      expect(r.cobrosGenerados).toBe(0);
      expect(r.costoAcumulado).toBe(0);
      expect(r.fase).toBe("gracia");
      expect(r.diasGraciaRestantes).toBe(0);
    });
  });

  describe("Cobro diario (a partir del día 31)", () => {
    it("Día 31 → 1 día cobrado, $5.000 (primer día de cobro)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 31));
      expect(r.diasTranscurridos).toBe(31);
      expect(r.cobrosGenerados).toBe(1);
      expect(r.costoAcumulado).toBe(TARIFA_ALM);
      expect(r.costo).toBe(TARIFA_ALM);
      expect(r.fase).toBe("cobro");
    });

    it("Día 32 → 2 días cobrados, $10.000", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 32));
      expect(r.diasTranscurridos).toBe(32);
      expect(r.cobrosGenerados).toBe(2);
      expect(r.costoAcumulado).toBe(2 * TARIFA_ALM);
      expect(r.fase).toBe("cobro");
    });

    it("Día 60 → 30 días cobrados, $150.000", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 60));
      expect(r.diasTranscurridos).toBe(60);
      expect(r.cobrosGenerados).toBe(30);
      expect(r.costoAcumulado).toBe(30 * TARIFA_ALM);
    });

    it("Día 90 → 60 días cobrados, $300.000", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 90));
      expect(r.diasTranscurridos).toBe(90);
      expect(r.cobrosGenerados).toBe(60);
      expect(r.costoAcumulado).toBe(60 * TARIFA_ALM);
    });

    it("Día 120 → 90 días cobrados, $450.000", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 120));
      expect(r.cobrosGenerados).toBe(90);
      expect(r.costoAcumulado).toBe(90 * TARIFA_ALM);
    });
  });

  describe("Campos calculados — coherencia interna", () => {
    it("diasGraciaRestantes correcto dentro de gracia", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 15));
      expect(r.diasGraciaRestantes).toBe(15);
    });

    it("diasHastaProximoCobro = 1 en gracia el día antes del primer cobro (día 30)", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 30));
      expect(r.diasHastaProximoCobro).toBe(1);
    });

    it("diasHastaProximoCobro = 1 siempre una vez en fase de cobro", () => {
      const r31 = calcAlmacenaje(INICIO, dia(INICIO, 31));
      const r60 = calcAlmacenaje(INICIO, dia(INICIO, 60));
      expect(r31.diasHastaProximoCobro).toBe(1);
      expect(r60.diasHastaProximoCobro).toBe(1);
    });

    it("costoProximo = costoAcumulado + 1 día más", () => {
      const r = calcAlmacenaje(INICIO, dia(INICIO, 31));
      expect(r.costoProximo).toBe(2 * TARIFA_ALM);
    });

    it("diasEnPeriodo = 1 en cualquier día de cobro (sin bloques)", () => {
      const r31 = calcAlmacenaje(INICIO, dia(INICIO, 31));
      const r60 = calcAlmacenaje(INICIO, dia(INICIO, 60));
      expect(r31.diasEnPeriodo).toBe(1);
      expect(r60.diasEnPeriodo).toBe(1);
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
