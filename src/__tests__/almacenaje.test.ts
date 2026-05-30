import { describe, expect, it } from "vitest";
import { calcAlmacenaje, TARIFA_ALM } from "@/lib/almacenaje";

describe("calcAlmacenaje()", () => {
  describe("fase gracia (primer mes sin costo)", () => {
    it("inicio y fin el mismo día → gracia", () => {
      const r = calcAlmacenaje("2026-01-15", "2026-01-15");
      expect(r.fase).toBe("gracia");
      expect(r.costo).toBe(0);
    });

    it("dentro del mes de gracia → costo 0", () => {
      const r = calcAlmacenaje("2026-01-01", "2026-01-20");
      expect(r.fase).toBe("gracia");
      expect(r.costo).toBe(0);
      expect(r.meses).toBe(0);
    });

    it("exactamente en el fin de gracia → aún gracia", () => {
      // Inicio 2026-01-01 → fin gracia 2026-02-01
      const r = calcAlmacenaje("2026-01-01", "2026-02-01");
      expect(r.fase).toBe("gracia");
    });

    it("diasRestantes correcto a mitad de gracia", () => {
      // Inicio 2026-01-01, fin gracia 2026-02-01, evaluado 2026-01-17 → faltan 15 días
      const r = calcAlmacenaje("2026-01-01", "2026-01-17");
      expect(r.fase).toBe("gracia");
      if (r.fase === "gracia") expect(r.diasRestantes).toBe(15);
    });
  });

  describe("fase cobro", () => {
    it("1 día después de gracia → cobro mes 0, costo 0", () => {
      // gracia vence 2026-02-01, evaluado 2026-02-02
      const r = calcAlmacenaje("2026-01-01", "2026-02-02");
      expect(r.fase).toBe("cobro");
      expect(r.meses).toBe(0);
      expect(r.costo).toBe(0);
    });

    it("1 mes completo de cobro → $150.000", () => {
      // gracia vence 2026-02-01, 1er mes cobro vence 2026-03-01, evaluado 2026-03-02
      const r = calcAlmacenaje("2026-01-01", "2026-03-02");
      expect(r.fase).toBe("cobro");
      expect(r.meses).toBe(1);
      expect(r.costo).toBe(TARIFA_ALM);
    });

    it("2 meses → $300.000", () => {
      const r = calcAlmacenaje("2026-01-01", "2026-04-02");
      expect(r.fase).toBe("cobro");
      expect(r.meses).toBe(2);
      expect(r.costo).toBe(2 * TARIFA_ALM);
    });

    it("6 meses → $900.000", () => {
      const r = calcAlmacenaje("2026-01-01", "2026-08-02");
      expect(r.fase).toBe("cobro");
      expect(r.meses).toBe(6);
      expect(r.costo).toBe(6 * TARIFA_ALM);
    });

    it("costoProximo = meses+1 × TARIFA", () => {
      const r = calcAlmacenaje("2026-01-01", "2026-03-02");
      if (r.fase === "cobro") expect(r.costoProximo).toBe(2 * TARIFA_ALM);
    });
  });

  describe("despachado antes de gracia", () => {
    it("pasando fechaDespacho dentro de gracia → costo 0", () => {
      const r = calcAlmacenaje("2026-01-01", "2026-01-25");
      expect(r.costo).toBe(0);
    });
  });
});
