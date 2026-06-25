import { describe, expect, it } from "vitest";
import { clasificarEscaneoGourmet } from "@/lib/gourmetEscaneo";

const ORDEN = "TSDM98761";

describe("clasificarEscaneoGourmet — Escenario QR único por caja", () => {
  const base = {
    ordenPedido: ORDEN,
    cajasEsperadas: 3,
    codigosCajaEsperados: ["TSDM98761-CAJA-01", "TSDM98761-CAJA-02", "TSDM98761-CAJA-03"],
    modoCodigo: "QR_UNICO_CAJA" as const,
  };

  it("válido: caja esperada, sin escaneo previo", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: "TSDM98761-CAJA-01", escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("VALIDO");
    expect(r.incrementaContador).toBe(true);
    expect(r.debeCrearNovedad).toBe(false);
  });

  it("duplicado: caja esperada, ya escaneada válida antes", () => {
    const r = clasificarEscaneoGourmet({
      ...base,
      codigo: "TSDM98761-CAJA-01",
      escaneosValidosPrevios: ["TSDM98761-CAJA-01"],
    });
    expect(r.resultado).toBe("DUPLICADO");
    expect(r.debeCrearNovedad).toBe(true);
    expect(r.tipoNovedadSugerido).toBe("CAJA_DUPLICADA");
    expect(r.incrementaContador).toBe(false);
  });

  it("caja ajena: código no está en la lista de cajas esperadas del pedido", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: "OVDM00001-CAJA-01", escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("CAJA_AJENA");
    expect(r.debeCrearNovedad).toBe(true);
    expect(r.tipoNovedadSugerido).toBe("CAJA_AJENA");
  });

  it("formato inválido: código vacío", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: "   ", escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("FORMATO_INVALIDO");
    expect(r.debeCrearNovedad).toBe(false);
    expect(r.incrementaContador).toBe(false);
  });
});

describe("clasificarEscaneoGourmet — Escenario QR solo con orden", () => {
  const base = {
    ordenPedido: ORDEN,
    cajasEsperadas: 2,
    modoCodigo: "QR_SOLO_ORDEN" as const,
  };

  it("válido mientras no exceda la cantidad esperada", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: ORDEN, escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("VALIDO");
    expect(r.incrementaContador).toBe(true);
  });

  it("excede cantidad cuando ya se alcanzó el límite esperado", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: ORDEN, escaneosValidosPrevios: [ORDEN, ORDEN] });
    expect(r.resultado).toBe("EXCEDE_CANTIDAD");
    expect(r.debeCrearNovedad).toBe(true);
    expect(r.tipoNovedadSugerido).toBe("DIFERENCIA_CANTIDAD");
  });

  it("caja ajena cuando el código no corresponde a la orden", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: "OVDM00001", escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("CAJA_AJENA");
  });

  it("formato inválido: código vacío", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: "", escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("FORMATO_INVALIDO");
  });

  it("no clasifica como DUPLICADO real cuando el modo es solo-orden (no existe ese resultado aquí)", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: ORDEN, escaneosValidosPrevios: [ORDEN] });
    expect(r.resultado).not.toBe("DUPLICADO");
    expect(r.resultado).toBe("VALIDO");
  });
});

describe("clasificarEscaneoGourmet — Escenario sin códigos previos", () => {
  const base = {
    ordenPedido: ORDEN,
    cajasEsperadas: 2,
    modoCodigo: "SIN_CODIGOS_PREVIOS" as const,
  };

  it("válido si el código coincide con la orden", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: `${ORDEN}-X`, escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("VALIDO");
    expect(r.incrementaContador).toBe(true);
  });

  it("caja ajena si no coincide con la orden", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: "OTRA-ORDEN", escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("CAJA_AJENA");
  });

  it("excede cantidad cuando ya se alcanzó el límite esperado", () => {
    const r = clasificarEscaneoGourmet({
      ...base,
      codigo: ORDEN,
      escaneosValidosPrevios: [ORDEN, ORDEN],
    });
    expect(r.resultado).toBe("EXCEDE_CANTIDAD");
  });

  it("formato inválido: código vacío", () => {
    const r = clasificarEscaneoGourmet({ ...base, codigo: "  ", escaneosValidosPrevios: [] });
    expect(r.resultado).toBe("FORMATO_INVALIDO");
  });
});
