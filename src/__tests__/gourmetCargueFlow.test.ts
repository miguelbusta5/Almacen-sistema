import { describe, expect, it } from "vitest";
import {
  esTransicionValidaGourmet,
  rolPuedeTransicionarGourmet,
  puedeTransicionarGourmet,
  assertTransicionGourmet,
  esEstadoTerminalGourmet,
  ESTADOS_TERMINALES_GOURMET,
  type EstadoPedidoGourmet,
} from "@/lib/gourmetCargueFlow";

describe("gourmetCargueFlow — transiciones válidas", () => {
  it.each([
    ["BORRADOR", "UBICACION_ASIGNADA"],
    ["BORRADOR", "CANCELADO"],
    ["UBICACION_ASIGNADA", "ENVIADO_A_TRANSPORTE"],
    ["UBICACION_ASIGNADA", "UBICACION_ASIGNADA"],
    ["UBICACION_ASIGNADA", "CANCELADO"],
    ["ENVIADO_A_TRANSPORTE", "EN_CARGUE"],
    ["ENVIADO_A_TRANSPORTE", "CANCELADO"],
    ["EN_CARGUE", "CARGUE_COMPLETO"],
    ["EN_CARGUE", "CARGUE_COMPLETO_MANUAL"],
    ["EN_CARGUE", "CON_NOVEDAD"],
    ["CON_NOVEDAD", "CARGUE_COMPLETO_MANUAL"],
    ["CON_NOVEDAD", "EN_CARGUE"],
  ] as [EstadoPedidoGourmet, EstadoPedidoGourmet][])(
    "%s → %s es válida",
    (origen, destino) => expect(esTransicionValidaGourmet(origen, destino)).toBe(true)
  );
});

describe("gourmetCargueFlow — transiciones inválidas", () => {
  it.each([
    ["BORRADOR", "ENVIADO_A_TRANSPORTE"],
    ["BORRADOR", "EN_CARGUE"],
    ["UBICACION_ASIGNADA", "EN_CARGUE"],
    ["ENVIADO_A_TRANSPORTE", "CARGUE_COMPLETO"],
    ["ENVIADO_A_TRANSPORTE", "BORRADOR"],
    ["EN_CARGUE", "BORRADOR"],
    ["CON_NOVEDAD", "CARGUE_COMPLETO"],
    ["CON_NOVEDAD", "CANCELADO"],
  ] as [EstadoPedidoGourmet, EstadoPedidoGourmet][])(
    "%s → %s es inválida",
    (origen, destino) => expect(esTransicionValidaGourmet(origen, destino)).toBe(false)
  );
});

describe("gourmetCargueFlow — estados terminales", () => {
  it("CARGUE_COMPLETO, CARGUE_COMPLETO_MANUAL y CANCELADO son terminales", () => {
    expect(ESTADOS_TERMINALES_GOURMET).toEqual(["CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CANCELADO"]);
    expect(esEstadoTerminalGourmet("CARGUE_COMPLETO")).toBe(true);
    expect(esEstadoTerminalGourmet("CARGUE_COMPLETO_MANUAL")).toBe(true);
    expect(esEstadoTerminalGourmet("CANCELADO")).toBe(true);
  });

  it("BORRADOR, EN_CARGUE, etc. no son terminales", () => {
    expect(esEstadoTerminalGourmet("BORRADOR")).toBe(false);
    expect(esEstadoTerminalGourmet("EN_CARGUE")).toBe(false);
    expect(esEstadoTerminalGourmet("CON_NOVEDAD")).toBe(false);
  });

  it("no se puede salir de CARGUE_COMPLETO", () => {
    expect(esTransicionValidaGourmet("CARGUE_COMPLETO", "EN_CARGUE")).toBe(false);
    expect(esTransicionValidaGourmet("CARGUE_COMPLETO", "CANCELADO")).toBe(false);
  });

  it("no se puede salir de CARGUE_COMPLETO_MANUAL", () => {
    expect(esTransicionValidaGourmet("CARGUE_COMPLETO_MANUAL", "EN_CARGUE")).toBe(false);
    expect(esTransicionValidaGourmet("CARGUE_COMPLETO_MANUAL", "CANCELADO")).toBe(false);
  });

  it("no se puede salir de CANCELADO", () => {
    expect(esTransicionValidaGourmet("CANCELADO", "BORRADOR")).toBe(false);
    expect(esTransicionValidaGourmet("CANCELADO", "EN_CARGUE")).toBe(false);
  });
});

describe("gourmetCargueFlow — permisos por rol", () => {
  it("Gourmet/Admin/Gerente pasan BORRADOR → UBICACION_ASIGNADA", () => {
    expect(rolPuedeTransicionarGourmet("OPERACIONES_GOURMET", "BORRADOR", "UBICACION_ASIGNADA")).toBe(true);
    expect(rolPuedeTransicionarGourmet("ADMIN", "BORRADOR", "UBICACION_ASIGNADA")).toBe(true);
    expect(rolPuedeTransicionarGourmet("GERENTE", "BORRADOR", "UBICACION_ASIGNADA")).toBe(true);
  });

  it("TRANSPORTE no puede pasar BORRADOR → UBICACION_ASIGNADA", () => {
    expect(rolPuedeTransicionarGourmet("TRANSPORTE", "BORRADOR", "UBICACION_ASIGNADA")).toBe(false);
  });

  it("Transporte/Supervisor/Admin/Gerente inician cargue (ENVIADO_A_TRANSPORTE → EN_CARGUE)", () => {
    for (const role of ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"]) {
      expect(rolPuedeTransicionarGourmet(role, "ENVIADO_A_TRANSPORTE", "EN_CARGUE")).toBe(true);
    }
  });

  it("OPERACIONES_GOURMET no puede iniciar cargue", () => {
    expect(rolPuedeTransicionarGourmet("OPERACIONES_GOURMET", "ENVIADO_A_TRANSPORTE", "EN_CARGUE")).toBe(false);
  });

  it("Transporte/Supervisor/Admin/Gerente finalizan cargue normal (EN_CARGUE → CARGUE_COMPLETO)", () => {
    for (const role of ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"]) {
      expect(rolPuedeTransicionarGourmet(role, "EN_CARGUE", "CARGUE_COMPLETO")).toBe(true);
    }
  });

  it("cierre manual permitido para SUPERVISOR_TRANSPORTE, ADMIN, GERENTE", () => {
    expect(rolPuedeTransicionarGourmet("SUPERVISOR_TRANSPORTE", "EN_CARGUE", "CARGUE_COMPLETO_MANUAL")).toBe(true);
    expect(rolPuedeTransicionarGourmet("ADMIN", "EN_CARGUE", "CARGUE_COMPLETO_MANUAL")).toBe(true);
    expect(rolPuedeTransicionarGourmet("GERENTE", "EN_CARGUE", "CARGUE_COMPLETO_MANUAL")).toBe(true);
    expect(rolPuedeTransicionarGourmet("SUPERVISOR_TRANSPORTE", "CON_NOVEDAD", "CARGUE_COMPLETO_MANUAL")).toBe(true);
  });

  it("cierre manual rechazado para TRANSPORTE", () => {
    expect(rolPuedeTransicionarGourmet("TRANSPORTE", "EN_CARGUE", "CARGUE_COMPLETO_MANUAL")).toBe(false);
    expect(rolPuedeTransicionarGourmet("TRANSPORTE", "CON_NOVEDAD", "CARGUE_COMPLETO_MANUAL")).toBe(false);
  });

  it("cierre manual rechazado para OPERACIONES_GOURMET", () => {
    expect(rolPuedeTransicionarGourmet("OPERACIONES_GOURMET", "EN_CARGUE", "CARGUE_COMPLETO_MANUAL")).toBe(false);
  });

  it("cancelación solo ADMIN/GERENTE", () => {
    expect(rolPuedeTransicionarGourmet("ADMIN", "BORRADOR", "CANCELADO")).toBe(true);
    expect(rolPuedeTransicionarGourmet("GERENTE", "BORRADOR", "CANCELADO")).toBe(true);
    expect(rolPuedeTransicionarGourmet("OPERACIONES_GOURMET", "BORRADOR", "CANCELADO")).toBe(false);
    expect(rolPuedeTransicionarGourmet("TRANSPORTE", "ENVIADO_A_TRANSPORTE", "CANCELADO")).toBe(false);
    expect(rolPuedeTransicionarGourmet("SUPERVISOR_TRANSPORTE", "UBICACION_ASIGNADA", "CANCELADO")).toBe(false);
  });
});

describe("gourmetCargueFlow — puedeTransicionarGourmet (transición + rol combinados)", () => {
  it("true solo si la transición es válida Y el rol tiene permiso", () => {
    expect(puedeTransicionarGourmet("BORRADOR", "UBICACION_ASIGNADA", "OPERACIONES_GOURMET")).toBe(true);
    expect(puedeTransicionarGourmet("BORRADOR", "UBICACION_ASIGNADA", "TRANSPORTE")).toBe(false);
    expect(puedeTransicionarGourmet("BORRADOR", "EN_CARGUE", "ADMIN")).toBe(false); // transición inexistente
  });
});

describe("gourmetCargueFlow — assertTransicionGourmet", () => {
  it("ok:true cuando la transición y el rol son válidos", () => {
    expect(assertTransicionGourmet("EN_CARGUE", "CARGUE_COMPLETO", "TRANSPORTE")).toEqual({ ok: true });
  });

  it("motivo TRANSICION_INVALIDA cuando el estado destino no es alcanzable", () => {
    const r = assertTransicionGourmet("CARGUE_COMPLETO", "EN_CARGUE", "ADMIN");
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("TRANSICION_INVALIDA");
  });

  it("motivo SIN_PERMISO cuando la transición existe pero el rol no puede ejecutarla", () => {
    const r = assertTransicionGourmet("EN_CARGUE", "CARGUE_COMPLETO_MANUAL", "TRANSPORTE");
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("SIN_PERMISO");
  });
});
