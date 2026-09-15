import { describe, expect, it } from "vitest";
import {
  calcularPrioridadSolicitudTransporte,
  calcularSemaforoSolicitudTransporte,
  esTransportadoraValida,
  estadoDesdeStella,
  puedeCrearSolicitudTransporte,
  puedeEliminarSolicitudTransporte,
  puedeGestionarSolicitudTransporte,
  puedeVerSolicitudTransporte,
  validarFlete,
  validarPlinesSolicitudTransporte,
} from "@/lib/solicitudesTransporte";

function d(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

describe("solicitudesTransporte", () => {
  it("permite crear a usuarios autenticados excepto TRANSPORTISTA", () => {
    expect(puedeCrearSolicitudTransporte("TIENDA")).toBe(true);
    expect(puedeCrearSolicitudTransporte("OPERACIONES_MUEBLES")).toBe(true);
    expect(puedeCrearSolicitudTransporte("SUPERVISOR_TRANSPORTE")).toBe(true);
    expect(puedeCrearSolicitudTransporte("TRANSPORTISTA")).toBe(false);
  });

  it("limita gestion a supervisor transporte, gerente y admin", () => {
    expect(puedeGestionarSolicitudTransporte("SUPERVISOR_TRANSPORTE")).toBe(true);
    expect(puedeGestionarSolicitudTransporte("GERENTE")).toBe(true);
    expect(puedeGestionarSolicitudTransporte("ADMIN")).toBe(true);
    expect(puedeGestionarSolicitudTransporte("TRANSPORTE")).toBe(false);
    expect(puedeGestionarSolicitudTransporte("TIENDA")).toBe(false);
  });

  it("limita borrado logico a admin y gerente", () => {
    expect(puedeEliminarSolicitudTransporte("ADMIN")).toBe(true);
    expect(puedeEliminarSolicitudTransporte("GERENTE")).toBe(true);
    expect(puedeEliminarSolicitudTransporte("SUPERVISOR_TRANSPORTE")).toBe(false);
    expect(puedeEliminarSolicitudTransporte("TIENDA")).toBe(false);
  });

  it("permite ver propias solicitudes y todas a gestores", () => {
    expect(puedeVerSolicitudTransporte("TIENDA", "u1", "u1")).toBe(true);
    expect(puedeVerSolicitudTransporte("TIENDA", "u1", "u2")).toBe(false);
    expect(puedeVerSolicitudTransporte("SUPERVISOR_TRANSPORTE", "u1", "u2")).toBe(true);
    expect(puedeVerSolicitudTransporte("TRANSPORTISTA", "u1", "u1")).toBe(false);
  });

  it("calcula prioridad segun dias entre solicitud y promesa", () => {
    expect(calcularPrioridadSolicitudTransporte(d("2026-06-01"), d("2026-06-04"))).toBe("ALTO");
    expect(calcularPrioridadSolicitudTransporte(d("2026-06-01"), d("2026-06-06"))).toBe("MEDIO");
    expect(calcularPrioridadSolicitudTransporte(d("2026-06-01"), d("2026-06-07"))).toBe("BAJO");
    expect(calcularPrioridadSolicitudTransporte(d("2026-06-01"), null)).toBeNull();
  });

  it("calcula semaforo con stella y fecha promesa", () => {
    expect(calcularSemaforoSolicitudTransporte({ stellaEstado: "EFECTUADO", fechaPromesaEntrega: d("2026-06-01"), hoy: d("2026-06-12") })).toBe("EFECTUADO");
    expect(calcularSemaforoSolicitudTransporte({ stellaEstado: "CANCELADO", fechaPromesaEntrega: d("2026-06-20"), hoy: d("2026-06-12") })).toBe("CANCELADO");
    expect(calcularSemaforoSolicitudTransporte({ stellaEstado: "PENDIENTE", fechaPromesaEntrega: null, hoy: d("2026-06-12") })).toBe("SIN_FECHA");
    expect(calcularSemaforoSolicitudTransporte({ stellaEstado: "PENDIENTE", fechaPromesaEntrega: d("2026-06-10"), hoy: d("2026-06-12") })).toBe("VENCIDO");
    expect(calcularSemaforoSolicitudTransporte({ stellaEstado: "PENDIENTE", fechaPromesaEntrega: d("2026-06-14"), hoy: d("2026-06-12") })).toBe("ALERTA");
    expect(calcularSemaforoSolicitudTransporte({ stellaEstado: "PROGRAMADO", fechaPromesaEntrega: d("2026-06-20"), hoy: d("2026-06-12") })).toBe("NORMAL");
  });

  it("deriva estado de solicitud desde stella", () => {
    expect(estadoDesdeStella("PENDIENTE")).toBe("PENDIENTE");
    expect(estadoDesdeStella("PROGRAMADO")).toBe("PROGRAMADA");
    expect(estadoDesdeStella("EFECTUADO")).toBe("EFECTUADA");
    expect(estadoDesdeStella("CANCELADO")).toBe("CANCELADA");
  });

  it("valida flete condicional", () => {
    expect(validarFlete(true, null)).toBe("Debes ingresar el valor del flete");
    expect(validarFlete(true, -1)).toBe("Debes ingresar el valor del flete");
    expect(validarFlete(true, 0)).toBeNull();
    expect(validarFlete(false, null)).toBeNull();
  });

  it("exige al menos un PLU valido", () => {
    expect(validarPlinesSolicitudTransporte([])).toBe("Agrega al menos un PLU");
    expect(validarPlinesSolicitudTransporte([{ plu: "", descripcion: "Mesa", unidades: 1 }])).toBe("Cada linea debe tener PLU");
    expect(validarPlinesSolicitudTransporte([{ plu: "ABC", descripcion: "", unidades: 1 }])).toBe("Cada linea debe tener descripcion");
    expect(validarPlinesSolicitudTransporte([{ plu: "ABC", descripcion: "Mesa", unidades: 0 }])).toBe("Cada linea debe tener unidades validas");
    expect(validarPlinesSolicitudTransporte([{ plu: "ABC", descripcion: "Mesa", unidades: 2 }])).toBeNull();
  });

  it("restringe transportadoras al catalogo cerrado", () => {
    expect(esTransportadoraValida("ONE SITE")).toBe(true);
    expect(esTransportadoraValida("PAKING TO GO")).toBe(true);
    expect(esTransportadoraValida("Otra transportadora")).toBe(false);
    expect(esTransportadoraValida(null)).toBe(false);
  });
});
