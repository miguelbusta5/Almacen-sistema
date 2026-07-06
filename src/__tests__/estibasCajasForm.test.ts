import { describe, it, expect } from "vitest";
import {
  decodeEstibaObservacion, encodeEstibaObservacion, estibasFromPedido, cajasFromPedido, parseEstibasCajas,
} from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/estibasCajasForm";

describe("encodeEstibaObservacion / decodeEstibaObservacion", () => {
  it("codifica y decodifica sin observación libre", () => {
    const encoded = encodeEstibaObservacion(3, "");
    expect(encoded).toBe("[cajas:3]");
    expect(decodeEstibaObservacion(encoded)).toEqual({ cantidadCajas: 3, observacion: "" });
  });

  it("codifica y decodifica con observación libre", () => {
    const encoded = encodeEstibaObservacion(2, "cerca de la puerta");
    expect(encoded).toBe("[cajas:2] · cerca de la puerta");
    expect(decodeEstibaObservacion(encoded)).toEqual({ cantidadCajas: 2, observacion: "cerca de la puerta" });
  });

  it("decodifica null/texto sin el tag como observación libre, sin cantidad", () => {
    expect(decodeEstibaObservacion(null)).toEqual({ cantidadCajas: null, observacion: "" });
    expect(decodeEstibaObservacion("texto libre viejo")).toEqual({ cantidadCajas: null, observacion: "texto libre viejo" });
  });
});

describe("estibasFromPedido / cajasFromPedido", () => {
  it("devuelve una fila vacía si el pedido no tiene estibas", () => {
    expect(estibasFromPedido(null)).toEqual([{ ubicacion: "", cantidadCajas: "", observacion: "" }]);
    expect(estibasFromPedido({ estibas: [], cajas: [] })).toEqual([{ ubicacion: "", cantidadCajas: "", observacion: "" }]);
  });

  it("ordena por secuencia y decodifica cantidadCajas/observación", () => {
    const rows = estibasFromPedido({
      estibas: [
        { id: "e2", secuencia: 2, ubicacion: "B2", observacion: "[cajas:4] · frágil" },
        { id: "e1", secuencia: 1, ubicacion: "A1", observacion: "[cajas:2]" },
      ],
      cajas: [],
    });
    expect(rows).toEqual([
      { ubicacion: "A1", cantidadCajas: "2", observacion: "" },
      { ubicacion: "B2", cantidadCajas: "4", observacion: "frágil" },
    ]);
  });

  it("mapea cajas a strings, con vacío si faltan datos", () => {
    const rows = cajasFromPedido({
      estibas: [],
      cajas: [{ numeroSecuencia: 1, codigoCaja: "CAJA-1", estibaId: null }, { numeroSecuencia: null, codigoCaja: null, estibaId: null }],
    });
    expect(rows).toEqual([
      { codigoCaja: "CAJA-1", numeroSecuencia: "1" },
      { codigoCaja: "", numeroSecuencia: "" },
    ]);
  });
});

describe("parseEstibasCajas", () => {
  const okEstibas = [
    { ubicacion: "A1", cantidadCajas: "2", observacion: "" },
    { ubicacion: "B2", cantidadCajas: "4", observacion: "frágil" },
  ];

  it("arma el payload cuando todo es válido y la suma coincide", () => {
    const res = parseEstibasCajas(okEstibas, [], 6);
    expect("data" in res).toBe(true);
    if ("data" in res) {
      expect(res.data.estibas).toEqual([
        { secuencia: 1, ubicacion: "A1", observacion: "[cajas:2]" },
        { secuencia: 2, ubicacion: "B2", observacion: "[cajas:4] · frágil" },
      ]);
      expect(res.data.cajas).toEqual([]);
    }
  });

  it("rechaza sin estibas", () => {
    const res = parseEstibasCajas([], [], 6);
    expect(res).toEqual({ error: "Agrega al menos una estiba" });
  });

  it("rechaza estiba sin ubicación", () => {
    const res = parseEstibasCajas([{ ubicacion: "", cantidadCajas: "2", observacion: "" }], [], 2);
    expect(res).toEqual({ error: "Estiba 1: indica la ubicación" });
  });

  it("rechaza cantidad de cajas inválida", () => {
    const res = parseEstibasCajas([{ ubicacion: "A1", cantidadCajas: "0", observacion: "" }], [], 0);
    expect(res).toEqual({ error: "Estiba 1: indica la cantidad de cajas (mayor a 0)" });
  });

  it("rechaza si la suma no coincide con cajasEsperadas", () => {
    const res = parseEstibasCajas(okEstibas, [], 10);
    expect(res).toEqual({
      error: "La suma de cajas por estiba (6) no coincide con las cajas esperadas del pedido (10)",
    });
  });

  it("ignora filas de caja completamente vacías", () => {
    const res = parseEstibasCajas(okEstibas, [{ codigoCaja: "", numeroSecuencia: "" }], 6);
    expect("data" in res && res.data.cajas).toEqual([]);
  });

  it("rechaza número de secuencia de caja inválido", () => {
    const res = parseEstibasCajas(okEstibas, [{ codigoCaja: "X", numeroSecuencia: "0" }], 6);
    expect(res).toEqual({ error: "El número de secuencia de caja debe ser un entero mayor a 0" });
  });

  it("rechaza números de secuencia de caja repetidos", () => {
    const res = parseEstibasCajas(
      okEstibas,
      [{ codigoCaja: "A", numeroSecuencia: "1" }, { codigoCaja: "B", numeroSecuencia: "1" }],
      6
    );
    expect(res).toEqual({ error: "No puede haber dos cajas con el mismo número de secuencia" });
  });
});
