import { describe, it, expect } from "vitest";
import { nivelEntregaColor, todayISO } from "@/lib/transporte";

// Construye una nota con la fecha de entrega a `n` días de hoy (UTC, para evitar
// desfases de zona horaria respecto a `todayISO()` que usa la función).
function notaConDias(n: number): string {
  const base = new Date(todayISO() + "T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + n);
  const [y, m, d] = base.toISOString().slice(0, 10).split("-");
  return `Entrega ${d}/${m}/${y}`;
}

const pendiente = (nota: string | null) => ({ estado: "PENDIENTE DESPACHO", nota });

describe("nivelEntregaColor — semáforo de entrega comprometida", () => {
  it("sin fecha en la nota → 'sin-fecha'", () => {
    expect(nivelEntregaColor(pendiente(null))).toBe("sin-fecha");
    expect(nivelEntregaColor(pendiente("Sin fecha aquí"))).toBe("sin-fecha");
  });

  it("fecha pasada → 'vencida'", () => {
    expect(nivelEntregaColor(pendiente(notaConDias(-1)))).toBe("vencida");
    expect(nivelEntregaColor(pendiente(notaConDias(-30)))).toBe("vencida");
  });

  it("0–10 días restantes → 'amarillo'", () => {
    expect(nivelEntregaColor(pendiente(notaConDias(0)))).toBe("amarillo");
    expect(nivelEntregaColor(pendiente(notaConDias(5)))).toBe("amarillo");
    expect(nivelEntregaColor(pendiente(notaConDias(10)))).toBe("amarillo");
  });

  it("11–15 días restantes → 'azul'", () => {
    expect(nivelEntregaColor(pendiente(notaConDias(11)))).toBe("azul");
    expect(nivelEntregaColor(pendiente(notaConDias(15)))).toBe("azul");
  });

  it("16+ días restantes → 'verde'", () => {
    expect(nivelEntregaColor(pendiente(notaConDias(16)))).toBe("verde");
    expect(nivelEntregaColor(pendiente(notaConDias(60)))).toBe("verde");
  });

  it("DESPACHADO con fecha → 'neutro' (sin urgencia)", () => {
    expect(nivelEntregaColor({ estado: "DESPACHADO", nota: notaConDias(5) })).toBe("neutro");
    expect(nivelEntregaColor({ estado: "DESPACHADO", nota: notaConDias(-3) })).toBe("neutro");
  });

  it("DESPACHADO sin fecha → 'sin-fecha' (la regla de fecha faltante aplica siempre)", () => {
    expect(nivelEntregaColor({ estado: "DESPACHADO", nota: null })).toBe("sin-fecha");
  });
});
