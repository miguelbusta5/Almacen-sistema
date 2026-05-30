import { describe, expect, it } from "vitest";
import { fmtCOP, fmtFecha, estadoLabel } from "@/lib/muebles";
import { parseEntrega } from "@/lib/transporte";

// ── fmtCOP ──────────────────────────────────────────────────
describe("fmtCOP (muebles)", () => {
  it("0 → $0", () => expect(fmtCOP(0)).toBe("$0"));
  it("positivo formatea con puntos", () => expect(fmtCOP(150000)).toBe("$150.000"));
  it("millón", () => expect(fmtCOP(1500000)).toBe("$1.500.000"));
  it("negativo lleva -$", () => expect(fmtCOP(-500000)).toBe("-$500.000"));
});

// ── fmtFecha ────────────────────────────────────────────────
describe("fmtFecha", () => {
  it("ISO → DD/MM/YYYY", () => expect(fmtFecha("2026-05-30")).toBe("30/05/2026"));
  it("mes y día simples", () => expect(fmtFecha("2026-01-07")).toBe("07/01/2026"));
  it("null → '—'", () => expect(fmtFecha(null)).toBe("—"));
});

// ── estadoLabel ─────────────────────────────────────────────
describe("estadoLabel", () => {
  it("PENDIENTE", () => expect(estadoLabel("PENDIENTE")).toBe("Pendiente"));
  it("EN PROCESO", () => expect(estadoLabel("EN PROCESO")).toBe("En proceso"));
  it("SOLUCIONADO", () => expect(estadoLabel("SOLUCIONADO")).toBe("Solucionado"));
});

// ── parseEntrega (transporte) ────────────────────────────────
describe("parseEntrega", () => {
  it("extrae DD/MM/YYYY de una nota", () =>
    expect(parseEntrega("entrega el 15/06/2026")).toBe("2026-06-15"));

  it("extrae DD-MM-YYYY", () =>
    expect(parseEntrega("15-06-2026")).toBe("2026-06-15"));

  it("rellena día y mes con cero", () =>
    expect(parseEntrega("5/6/2026")).toBe("2026-06-05"));

  it("nota sin fecha → null", () =>
    expect(parseEntrega("sin fecha aquí")).toBeNull());

  it("null → null", () =>
    expect(parseEntrega(null)).toBeNull());

  it("fecha al inicio de nota", () =>
    expect(parseEntrega("15/06/2026 importante")).toBe("2026-06-15"));
});
