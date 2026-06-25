import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CrearPedidoModal } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/CrearPedidoModal";

// Nota de alcance (Fase G3C2): `Modal` (src/components/ui/Modal.tsx) renderiza
// vía `createPortal` y comprueba `typeof document === "undefined"` antes de
// pintar nada. El entorno de Vitest de este proyecto corre en "node" sin
// jsdom ni @testing-library/react instalados (confirmado: no aparecen en
// package.json) — `document` no existe, así que `renderToStaticMarkup` de
// CUALQUIER componente que use `Modal`/`SlidePanel` siempre devuelve cadena
// vacía, sin importar `open`. Esto no es un bug de CrearPedidoModal: es una
// limitación real y preexistente del setup de testing del proyecto frente a
// portales — el mismo patrón se repite en todos los `Modal` ya usados en
// otros módulos (ninguno tiene test de render propio).
//
// Por eso este archivo solo verifica el contrato mínimo verificable
// (no crashea al renderizar en ambos estados) y documenta como pendiente
// la cobertura de estructura/interacción, que requeriría instalar jsdom +
// @testing-library/react — decisión de tooling fuera del alcance de G3C2.

describe("CrearPedidoModal — contrato mínimo (Fase G3C2)", () => {
  it("no lanza error al renderizar con open=false", () => {
    expect(() =>
      renderToStaticMarkup(<CrearPedidoModal open={false} onClose={() => {}} onCreated={() => {}} />)
    ).not.toThrow();
  });

  it("no lanza error al renderizar con open=true (Modal no pinta nada sin document — ver nota de alcance)", () => {
    expect(() =>
      renderToStaticMarkup(<CrearPedidoModal open={true} onClose={() => {}} onCreated={() => {}} />)
    ).not.toThrow();
  });
});

describe("CrearPedidoModal — pendiente de cobertura (documentado, requiere jsdom)", () => {
  it.todo("renderiza los campos Orden, Tipo, Código tienda, Cajas y Estibas esperadas");
  it.todo("botón 'Nuevo pedido' aparece en la página solo para OPERACIONES_GOURMET/ADMIN/GERENTE");
  it.todo("botón 'Nuevo pedido' NO aparece para TRANSPORTE/SUPERVISOR_TRANSPORTE");
  it.todo("escribir en codigo-tienda dispara fetch a /maestro-tiendas y muestra sugerencias");
  it.todo("seleccionar una sugerencia llena nombre/ciudad de solo lectura, no editables");
  it.todo("submit exitoso llama POST /api/cargue-gourmet con el body exacto, cierra el modal y recarga el listado");
  it.todo("submit con error 400 muestra el mensaje del backend sin cerrar el modal");
  it.todo("no hay botones de editar/ubicación/enviar/escanear/finalizar/cierre manual en la página en esta fase");
});
