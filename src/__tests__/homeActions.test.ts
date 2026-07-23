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

  it("respeta el parámetro max", () => {
    expect(getHomeActionsByRole("ADMIN", 2)).toHaveLength(2);
    expect(getHomeActionsByRole("ADMIN", 99).length).toBeGreaterThan(2);
  });

  it("retorna [] para role nulo o undefined", () => {
    expect(getHomeActionsByRole(null)).toEqual([]);
    expect(getHomeActionsByRole(undefined)).toEqual([]);
    expect(getHomeActionsByRole("")).toEqual([]);
  });

  // ── TRANSPORTE ───────────────────────────────────────
  describe("TRANSPORTE", () => {
    it("ve nuevo-guardado", () => expect(hasAction("TRANSPORTE", "nuevo-guardado")).toBe(true));
    it("NO ve nuevo-despacho-tienda", () => expect(hasAction("TRANSPORTE", "nuevo-despacho-tienda")).toBe(false));
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
    it("NO ve gestionar-usuarios", () => expect(hasAction("SUPERVISOR_TRANSPORTE", "gestionar-usuarios")).toBe(false));
  });

  // ── TIENDA ───────────────────────────────────────────
  describe("TIENDA", () => {
    it("ve nuevo-despacho-tienda", () => expect(hasAction("TIENDA", "nuevo-despacho-tienda")).toBe(true));
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
    it("NO ve gestionar-usuarios", () => expect(hasAction("SUPERVISOR_TIENDA", "gestionar-usuarios")).toBe(false));
  });

  // ── TRANSPORTISTA ────────────────────────────────────
  describe("TRANSPORTISTA", () => {
    it("ve preoperacional", () => expect(hasAction("TRANSPORTISTA", "preoperacional")).toBe(true));
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
    it("ve nuevo-guardado", () => expect(hasAction("OPERADOR", "nuevo-guardado")).toBe(true));
    it("NO ve gestionar-usuarios", () => expect(hasAction("OPERADOR", "gestionar-usuarios")).toBe(false));
    it("NO ve centro-control", () => expect(hasAction("OPERADOR", "centro-control")).toBe(false));
    it("ve nuevo-guardado entre las acciones prioritarias", () => {
      const result = ids("OPERADOR", 4);
      expect(result).toContain("nuevo-guardado");
    });
  });

  // ── GERENTE ──────────────────────────────────────────
  describe("GERENTE", () => {
    it("ve nuevo-guardado", () => expect(hasAction("GERENTE", "nuevo-guardado")).toBe(true));
    it("ve centro-control", () => expect(hasAction("GERENTE", "centro-control")).toBe(true));
    it("ve ver-auditoria", () => expect(hasAction("GERENTE", "ver-auditoria")).toBe(true));
    it("NO ve gestionar-usuarios", () => expect(hasAction("GERENTE", "gestionar-usuarios")).toBe(false));
  });

  // ── ADMIN ────────────────────────────────────────────
  describe("ADMIN", () => {
    it("ve gestionar-usuarios", () => expect(hasAction("ADMIN", "gestionar-usuarios")).toBe(true));
    it("ve centro-control", () => expect(hasAction("ADMIN", "centro-control")).toBe(true));
    it("ve ver-auditoria", () => expect(hasAction("ADMIN", "ver-auditoria")).toBe(true));
    it("ve nuevo-guardado", () => expect(hasAction("ADMIN", "nuevo-guardado")).toBe(true));
    it("navega a /dashboard/usuarios para gestión de usuarios", () => {
      const action = getHomeActionsByRole("ADMIN", 99).find((a) => a.id === "gestionar-usuarios");
      expect(action?.href).toBe("/dashboard/usuarios");
    });
  });

  // ── Separación estricta de áreas ────────────────────
  describe("aislamiento de módulos", () => {
    it("TIENDA no ve acciones de transporte", () => {
      const actions = getHomeActionsByRole("TIENDA", 99);
      expect(actions.every((a) => a.moduleKey !== "transporte")).toBe(true);
    });
  });

  // ── Orden por prioridad ──────────────────────────────
  describe("orden por prioridad", () => {
    it("las acciones vienen ordenadas de menor a mayor prioridad", () => {
      for (const role of ["TRANSPORTE", "TIENDA", "TRANSPORTISTA", "ADMIN", "GERENTE", "OPERADOR", "ETIQUETADO"]) {
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
