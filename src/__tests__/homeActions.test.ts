import { describe, expect, it } from "vitest";
import { getHomeActionsByRole, HOME_ACTIONS } from "@/config/homeActions";

// ── helpers ──────────────────────────────────────────────
function ids(role: string, max = 4) {
  return getHomeActionsByRole(role, max).map((a) => a.id);
}
function hasAction(role: string, id: string) {
  return getHomeActionsByRole(role, 99).some((a) => a.id === id);
}

// ════════════════════════════════════════════════════════
describe("getHomeActionsByRole", () => {

  // ── Límite de 4 ─────────────────────────────────────
  it("devuelve máximo 4 acciones por defecto", () => {
    expect(getHomeActionsByRole("ADMIN")).toHaveLength(4);
    expect(getHomeActionsByRole("INVENTARIO")).toHaveLength(
      Math.min(4, HOME_ACTIONS.filter((a) => a.roles.includes("INVENTARIO")).length)
    );
  });

  it("respeta el parámetro max", () => {
    expect(getHomeActionsByRole("ADMIN", 2)).toHaveLength(2);
    expect(getHomeActionsByRole("ADMIN", 99).length).toBeGreaterThan(4);
  });

  it("retorna [] para role nulo o undefined", () => {
    expect(getHomeActionsByRole(null)).toEqual([]);
    expect(getHomeActionsByRole(undefined)).toEqual([]);
    expect(getHomeActionsByRole("")).toEqual([]);
  });

  // ── INVENTARIO ───────────────────────────────────────
  describe("INVENTARIO", () => {
    it("ve nueva-novedad", () => expect(hasAction("INVENTARIO", "nueva-novedad")).toBe(true));
    it("ve ir-conteo", () => expect(hasAction("INVENTARIO", "ir-conteo")).toBe(true));
    it("ve ver-mis-tareas", () => expect(hasAction("INVENTARIO", "ver-mis-tareas")).toBe(true));
    it("NO ve nuevo-guardado", () => expect(hasAction("INVENTARIO", "nuevo-guardado")).toBe(false));
    it("NO ve nuevo-despacho-tienda", () => expect(hasAction("INVENTARIO", "nuevo-despacho-tienda")).toBe(false));
    it("NO ve gestionar-usuarios", () => expect(hasAction("INVENTARIO", "gestionar-usuarios")).toBe(false));
    it("NO ve centro-control", () => expect(hasAction("INVENTARIO", "centro-control")).toBe(false));
    it("las 4 acciones son solo de inventario", () => {
      const result = ids("INVENTARIO");
      expect(result).not.toContain("nuevo-guardado");
      expect(result).not.toContain("nuevo-despacho-tienda");
    });
  });

  // ── SUPERVISOR_INVENTARIO ────────────────────────────
  describe("SUPERVISOR_INVENTARIO", () => {
    it("ve nueva-novedad", () => expect(hasAction("SUPERVISOR_INVENTARIO", "nueva-novedad")).toBe(true));
    it("ve ir-conteo", () => expect(hasAction("SUPERVISOR_INVENTARIO", "ir-conteo")).toBe(true));
    it("ve centro-control", () => expect(hasAction("SUPERVISOR_INVENTARIO", "centro-control")).toBe(true));
    it("ve indicadores-cedi", () => expect(hasAction("SUPERVISOR_INVENTARIO", "indicadores-cedi")).toBe(true));
    it("NO ve nuevo-guardado", () => expect(hasAction("SUPERVISOR_INVENTARIO", "nuevo-guardado")).toBe(false));
    it("NO ve gestionar-usuarios", () => expect(hasAction("SUPERVISOR_INVENTARIO", "gestionar-usuarios")).toBe(false));
  });

  // ── TRANSPORTE ───────────────────────────────────────
  describe("TRANSPORTE", () => {
    it("ve nuevo-guardado", () => expect(hasAction("TRANSPORTE", "nuevo-guardado")).toBe(true));
    it("ve ver-mis-tareas", () => expect(hasAction("TRANSPORTE", "ver-mis-tareas")).toBe(true));
    it("NO ve nuevo-despacho-tienda", () => expect(hasAction("TRANSPORTE", "nuevo-despacho-tienda")).toBe(false));
    it("NO ve nueva-novedad", () => expect(hasAction("TRANSPORTE", "nueva-novedad")).toBe(false));
    it("NO ve ir-conteo", () => expect(hasAction("TRANSPORTE", "ir-conteo")).toBe(false));
    it("NO ve gestionar-usuarios", () => expect(hasAction("TRANSPORTE", "gestionar-usuarios")).toBe(false));
    it("NO ve centro-control", () => expect(hasAction("TRANSPORTE", "centro-control")).toBe(false));
    it("navega a /dashboard/transporte para guardado", () => {
      const action = getHomeActionsByRole("TRANSPORTE", 99).find((a) => a.id === "nuevo-guardado");
      expect(action?.href).toBe("/dashboard/transporte");
    });
  });

  // ── SUPERVISOR_TRANSPORTE ────────────────────────────
  describe("SUPERVISOR_TRANSPORTE", () => {
    it("ve nuevo-guardado", () => expect(hasAction("SUPERVISOR_TRANSPORTE", "nuevo-guardado")).toBe(true));
    it("ve nuevo-despacho-tienda", () => expect(hasAction("SUPERVISOR_TRANSPORTE", "nuevo-despacho-tienda")).toBe(true));
    it("ve centro-control", () => expect(hasAction("SUPERVISOR_TRANSPORTE", "centro-control")).toBe(true));
    it("ve indicadores-cedi", () => expect(hasAction("SUPERVISOR_TRANSPORTE", "indicadores-cedi")).toBe(true));
    it("NO ve nueva-novedad", () => expect(hasAction("SUPERVISOR_TRANSPORTE", "nueva-novedad")).toBe(false));
    it("NO ve gestionar-usuarios", () => expect(hasAction("SUPERVISOR_TRANSPORTE", "gestionar-usuarios")).toBe(false));
  });

  // ── TIENDA ───────────────────────────────────────────
  describe("TIENDA", () => {
    it("ve nuevo-despacho-tienda", () => expect(hasAction("TIENDA", "nuevo-despacho-tienda")).toBe(true));
    it("ve ver-mis-tareas", () => expect(hasAction("TIENDA", "ver-mis-tareas")).toBe(true));
    it("NO ve nueva-novedad", () => expect(hasAction("TIENDA", "nueva-novedad")).toBe(false));
    it("NO ve nuevo-guardado", () => expect(hasAction("TIENDA", "nuevo-guardado")).toBe(false));
    it("NO ve ir-conteo", () => expect(hasAction("TIENDA", "ir-conteo")).toBe(false));
    it("NO ve gestionar-usuarios", () => expect(hasAction("TIENDA", "gestionar-usuarios")).toBe(false));
    it("NO ve centro-control", () => expect(hasAction("TIENDA", "centro-control")).toBe(false));
    it("navega a /dashboard/tienda para despacho", () => {
      const action = getHomeActionsByRole("TIENDA", 99).find((a) => a.id === "nuevo-despacho-tienda");
      expect(action?.href).toBe("/dashboard/tienda");
    });
  });

  // ── SUPERVISOR_TIENDA ────────────────────────────────
  describe("SUPERVISOR_TIENDA", () => {
    it("ve nuevo-despacho-tienda", () => expect(hasAction("SUPERVISOR_TIENDA", "nuevo-despacho-tienda")).toBe(true));
    it("ve centro-control", () => expect(hasAction("SUPERVISOR_TIENDA", "centro-control")).toBe(true));
    it("ve indicadores-cedi", () => expect(hasAction("SUPERVISOR_TIENDA", "indicadores-cedi")).toBe(true));
    it("ve ver-mis-tareas", () => expect(hasAction("SUPERVISOR_TIENDA", "ver-mis-tareas")).toBe(true));
    it("NO ve nueva-novedad", () => expect(hasAction("SUPERVISOR_TIENDA", "nueva-novedad")).toBe(false));
    it("NO ve gestionar-usuarios", () => expect(hasAction("SUPERVISOR_TIENDA", "gestionar-usuarios")).toBe(false));
  });

  // ── TRANSPORTISTA ────────────────────────────────────
  describe("TRANSPORTISTA", () => {
    it("ve preoperacional", () => expect(hasAction("TRANSPORTISTA", "preoperacional")).toBe(true));
    it("NO ve ver-mis-tareas", () => expect(hasAction("TRANSPORTISTA", "ver-mis-tareas")).toBe(false));
    it("NO ve nueva-novedad", () => expect(hasAction("TRANSPORTISTA", "nueva-novedad")).toBe(false));
    it("NO ve nuevo-guardado", () => expect(hasAction("TRANSPORTISTA", "nuevo-guardado")).toBe(false));
    it("NO ve nuevo-despacho-tienda", () => expect(hasAction("TRANSPORTISTA", "nuevo-despacho-tienda")).toBe(false));
    it("NO ve gestionar-usuarios", () => expect(hasAction("TRANSPORTISTA", "gestionar-usuarios")).toBe(false));
    it("NO ve centro-control", () => expect(hasAction("TRANSPORTISTA", "centro-control")).toBe(false));
    it("NO ve indicadores-cedi", () => expect(hasAction("TRANSPORTISTA", "indicadores-cedi")).toBe(false));
    it("navega a /dashboard/preoperacional", () => {
      const action = getHomeActionsByRole("TRANSPORTISTA", 99).find((a) => a.id === "preoperacional");
      expect(action?.href).toBe("/dashboard/preoperacional");
    });
  });

  describe("ETIQUETADO", () => {
    it("solo ve registrar-exportacion", () => {
      expect(ids("ETIQUETADO", 99)).toEqual(["registrar-exportacion"]);
    });
    it("navega a /dashboard/exportaciones", () => {
      const action = getHomeActionsByRole("ETIQUETADO", 99)[0];
      expect(action.href).toBe("/dashboard/exportaciones");
    });
  });

  // ── OPERADOR (legacy) ────────────────────────────────
  describe("OPERADOR", () => {
    it("ve nueva-novedad", () => expect(hasAction("OPERADOR", "nueva-novedad")).toBe(true));
    it("ve nuevo-guardado", () => expect(hasAction("OPERADOR", "nuevo-guardado")).toBe(true));
    it("ve ir-conteo", () => expect(hasAction("OPERADOR", "ir-conteo")).toBe(true));
    it("ve ver-mis-tareas", () => expect(hasAction("OPERADOR", "ver-mis-tareas")).toBe(true));
    it("NO ve gestionar-usuarios", () => expect(hasAction("OPERADOR", "gestionar-usuarios")).toBe(false));
    it("NO ve centro-control", () => expect(hasAction("OPERADOR", "centro-control")).toBe(false));
    it("las 4 primeras (por prioridad) son las más relevantes", () => {
      const result = ids("OPERADOR", 4);
      // prioridad 1: nueva-novedad y nuevo-guardado
      // prioridad 2: ir-conteo y ver-mis-tareas
      expect(result).toContain("nueva-novedad");
      expect(result).toContain("nuevo-guardado");
    });
  });

  // ── GERENTE ──────────────────────────────────────────
  describe("GERENTE", () => {
    it("ve nueva-novedad", () => expect(hasAction("GERENTE", "nueva-novedad")).toBe(true));
    it("ve nuevo-guardado", () => expect(hasAction("GERENTE", "nuevo-guardado")).toBe(true));
    it("ve centro-control", () => expect(hasAction("GERENTE", "centro-control")).toBe(true));
    it("ve indicadores-cedi", () => expect(hasAction("GERENTE", "indicadores-cedi")).toBe(true));
    it("ve ver-auditoria", () => expect(hasAction("GERENTE", "ver-auditoria")).toBe(true));
    it("NO ve gestionar-usuarios", () => expect(hasAction("GERENTE", "gestionar-usuarios")).toBe(false));
  });

  // ── ADMIN ────────────────────────────────────────────
  describe("ADMIN", () => {
    it("ve gestionar-usuarios", () => expect(hasAction("ADMIN", "gestionar-usuarios")).toBe(true));
    it("ve centro-control", () => expect(hasAction("ADMIN", "centro-control")).toBe(true));
    it("ve indicadores-cedi", () => expect(hasAction("ADMIN", "indicadores-cedi")).toBe(true));
    it("ve ver-auditoria", () => expect(hasAction("ADMIN", "ver-auditoria")).toBe(true));
    it("ve nueva-novedad", () => expect(hasAction("ADMIN", "nueva-novedad")).toBe(true));
    it("ve nuevo-guardado", () => expect(hasAction("ADMIN", "nuevo-guardado")).toBe(true));
    it("navega a /dashboard/usuarios para gestión de usuarios", () => {
      const action = getHomeActionsByRole("ADMIN", 99).find((a) => a.id === "gestionar-usuarios");
      expect(action?.href).toBe("/dashboard/usuarios");
    });
    it("navega a /dashboard/inventario para nueva novedad", () => {
      const action = getHomeActionsByRole("ADMIN", 99).find((a) => a.id === "nueva-novedad");
      expect(action?.href).toBe("/dashboard/inventario");
    });
  });

  // ── Separación estricta de áreas ────────────────────
  describe("aislamiento de módulos", () => {
    it("TIENDA no ve acciones de inventario", () => {
      const actions = getHomeActionsByRole("TIENDA", 99);
      expect(actions.every((a) => a.moduleKey !== "inventario")).toBe(true);
      expect(actions.every((a) => a.moduleKey !== "conteo-contar")).toBe(true);
    });

    it("INVENTARIO no ve acciones de transporte", () => {
      const actions = getHomeActionsByRole("INVENTARIO", 99);
      expect(actions.every((a) => a.moduleKey !== "transporte")).toBe(true);
    });

    it("TRANSPORTE no ve acciones de inventario puras", () => {
      const actions = getHomeActionsByRole("TRANSPORTE", 99);
      expect(actions.every((a) => a.moduleKey !== "inventario")).toBe(true);
      expect(actions.every((a) => a.moduleKey !== "conteo-contar")).toBe(true);
      expect(actions.every((a) => a.moduleKey !== "tienda")).toBe(true);
    });
  });

  // ── Orden por prioridad ──────────────────────────────
  describe("orden por prioridad", () => {
    it("las acciones vienen ordenadas de menor a mayor prioridad", () => {
      for (const role of ["INVENTARIO", "TRANSPORTE", "TIENDA", "TRANSPORTISTA", "ADMIN", "GERENTE", "OPERADOR", "ETIQUETADO"]) {
        const actions = getHomeActionsByRole(role, 99);
        for (let i = 1; i < actions.length; i++) {
          expect(actions[i].priority).toBeGreaterThanOrEqual(actions[i - 1].priority);
        }
      }
    });
  });

  // ── Consistencia con moduleKey ───────────────────────
  describe("consistencia de href", () => {
    it("todas las acciones tienen href que empieza con /dashboard/", () => {
      HOME_ACTIONS.forEach((a) => {
        expect(a.href).toMatch(/^\/dashboard\//);
      });
    });

    it("todas las acciones tienen id único", () => {
      const ids = HOME_ACTIONS.map((a) => a.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

});
