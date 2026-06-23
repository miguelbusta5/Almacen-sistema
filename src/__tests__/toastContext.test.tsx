import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ToastProvider, useToast, toastReducer, createToastId,
  type ToastItem,
} from "@/contexts/ToastContext";

// ─────────────────────────────────────────────────────────────────────────
// Entorno de tests es "node" (sin jsdom) y no se instalan librerías nuevas
// en esta fase, así que el comportamiento interactivo (apilado, auto-dismiss,
// cierre manual) se valida contra el reducer puro `toastReducer`, que es
// exactamente la lógica que el ToastProvider ejecuta en cada show()/remove().
// El montaje real del Provider se valida con renderToStaticMarkup.
// ─────────────────────────────────────────────────────────────────────────

function mockItem(overrides: Partial<ToastItem> = {}): ToastItem {
  return {
    id: createToastId(),
    message: "Mensaje de prueba",
    type: "success",
    duration: 3000,
    ...overrides,
  };
}

describe("ToastProvider — render", () => {
  it("renderiza sin romper junto con sus children", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <div data-testid="contenido-hijo">Contenido</div>
      </ToastProvider>,
    );
    expect(html).toContain("Contenido");
  });

  it("no rompe si useToast() se llama dentro de un componente hijo anidado", () => {
    function Nieto() {
      const toast = useToast();
      // Solo se valida que el objeto tenga la forma esperada — no se invoca
      // durante el render (eso dispararía un setState fuera de ciclo).
      expect(typeof toast.success).toBe("function");
      expect(typeof toast.error).toBe("function");
      expect(typeof toast.info).toBe("function");
      expect(typeof toast.warning).toBe("function");
      expect(typeof toast.show).toBe("function");
      return <span>nieto</span>;
    }
    function Hijo() {
      return <Nieto />;
    }
    const html = renderToStaticMarkup(
      <ToastProvider>
        <Hijo />
      </ToastProvider>,
    );
    expect(html).toContain("nieto");
  });

  it("useToast() fuera de un ToastProvider devuelve funciones no-op sin lanzar", () => {
    function SinProvider() {
      const toast = useToast();
      expect(() => toast.success("hola")).not.toThrow();
      expect(() => toast.error("hola")).not.toThrow();
      return null;
    }
    expect(() => renderToStaticMarkup(<SinProvider />)).not.toThrow();
  });
});

describe("toastReducer — disparo de variantes y apilado", () => {
  it("ADD agrega una toast de variante success", () => {
    const item = mockItem({ type: "success", message: "Guardado ✓" });
    const result = toastReducer([], { type: "ADD", item });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("success");
    expect(result[0].message).toBe("Guardado ✓");
  });

  it("ADD agrega una toast de variante error", () => {
    const item = mockItem({ type: "error", message: "Error al guardar" });
    const result = toastReducer([], { type: "ADD", item });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("error");
  });

  it("se pueden apilar varias toasts simultáneamente", () => {
    const a = mockItem({ message: "Primera" });
    const b = mockItem({ message: "Segunda" });
    const c = mockItem({ message: "Tercera" });
    let state = toastReducer([], { type: "ADD", item: a });
    state = toastReducer(state, { type: "ADD", item: b });
    state = toastReducer(state, { type: "ADD", item: c });
    expect(state).toHaveLength(3);
    expect(state.map((t) => t.message)).toEqual(["Primera", "Segunda", "Tercera"]);
  });

  it("auto-dismiss: REMOVE quita la toast correspondiente (simula el timeout)", () => {
    const a = mockItem({ message: "Se autodescarta" });
    const b = mockItem({ message: "Permanece" });
    let state = toastReducer([], { type: "ADD", item: a });
    state = toastReducer(state, { type: "ADD", item: b });
    state = toastReducer(state, { type: "REMOVE", id: a.id });
    expect(state).toHaveLength(1);
    expect(state[0].message).toBe("Permanece");
  });

  it("cierre manual: REMOVE por id elimina exactamente esa toast (mismo path que el botón cerrar)", () => {
    const a = mockItem();
    const b = mockItem();
    let state = toastReducer([], { type: "ADD", item: a });
    state = toastReducer(state, { type: "ADD", item: b });
    state = toastReducer(state, { type: "REMOVE", id: b.id });
    expect(state.map((t) => t.id)).toEqual([a.id]);
  });

  it("REMOVE de un id inexistente no rompe ni cambia el estado", () => {
    const a = mockItem();
    const state = toastReducer([a], { type: "REMOVE", id: "no-existe" });
    expect(state).toHaveLength(1);
  });

  it("createToastId genera ids únicos", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createToastId()));
    expect(ids.size).toBe(50);
  });
});
