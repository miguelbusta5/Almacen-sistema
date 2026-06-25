import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TransporteAccionesBar, progresoCompleto } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/TransporteAccionesBar";
import type { ProgresoEscaneo } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/EscaneoCajasPanel";
import type { EstadoPedidoGourmet } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components";

// Nota de alcance (Fase G3C6): el botón "Finalizar cargue" se confirma desde
// un `ConfirmModal` en page.tsx (igual patrón que "Enviar a Transporte" e
// "Iniciar cargue" en G3C4/G3C5) — `Modal`/`ConfirmModal` usan `createPortal`
// y en este entorno Vitest (node, sin jsdom) siempre devuelven null. Por eso
// aquí solo se testea `TransporteAccionesBar` (componente puro que decide
// visibilidad/habilitación del botón) — el flujo real de confirmación queda
// documentado como pendiente, igual criterio que en G3C2/G3C4/G3C5.

function finalizarButtonDisabled(html: string): boolean {
  const m = html.match(/<button[^>]*data-testid="btn-finalizar-cargue"[^>]*>/);
  return !!m && /disabled/.test(m[0]);
}

function renderBar(opts: {
  estado: EstadoPedidoGourmet;
  puedeTransporte?: boolean;
  progreso?: ProgresoEscaneo | null;
  finalizando?: boolean;
}) {
  return renderToStaticMarkup(
    <TransporteAccionesBar
      estado={opts.estado}
      puedeTransporte={opts.puedeTransporte ?? true}
      onIniciarCargue={() => {}}
      progreso={opts.progreso ?? null}
      onFinalizarCargue={() => {}}
      finalizando={opts.finalizando ?? false}
    />
  );
}

const PROGRESO_COMPLETO: ProgresoEscaneo = { escaneados: 5, esperados: 5 };
const PROGRESO_INCOMPLETO: ProgresoEscaneo = { escaneados: 2, esperados: 5 };
const PROGRESO_SIN_ESPERADOS: ProgresoEscaneo = { escaneados: 0, esperados: 0 };

describe("TransporteAccionesBar — 'Finalizar cargue' por rol", () => {
  it("aparece para TRANSPORTE (puedeTransporte=true) en EN_CARGUE", () => {
    const html = renderBar({ estado: "EN_CARGUE", progreso: PROGRESO_COMPLETO });
    expect(html).toContain('data-testid="btn-finalizar-cargue"');
  });

  it("aparece para SUPERVISOR_TRANSPORTE/ADMIN/GERENTE en EN_CARGUE (mismo flag puedeTransporte)", () => {
    const html = renderBar({ estado: "EN_CARGUE", puedeTransporte: true, progreso: PROGRESO_COMPLETO });
    expect(html).toContain("Finalizar cargue");
  });

  it("NO aparece para OPERACIONES_GOURMET (puedeTransporte=false)", () => {
    const html = renderBar({ estado: "EN_CARGUE", puedeTransporte: false, progreso: PROGRESO_COMPLETO });
    expect(html).not.toContain('data-testid="btn-finalizar-cargue"');
  });
});

describe("TransporteAccionesBar — 'Finalizar cargue' por estado", () => {
  it("aparece SOLO en EN_CARGUE", () => {
    expect(renderBar({ estado: "EN_CARGUE", progreso: PROGRESO_COMPLETO })).toContain('data-testid="btn-finalizar-cargue"');
  });

  it.each(["BORRADOR", "UBICACION_ASIGNADA", "ENVIADO_A_TRANSPORTE", "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CON_NOVEDAD", "CANCELADO"] as EstadoPedidoGourmet[])(
    "NO aparece en %s",
    (estado) => expect(renderBar({ estado, progreso: PROGRESO_COMPLETO })).not.toContain('data-testid="btn-finalizar-cargue"')
  );
});

describe("TransporteAccionesBar — habilitación del botón por progreso", () => {
  it("se deshabilita si escaneados < esperados", () => {
    const html = renderBar({ estado: "EN_CARGUE", progreso: PROGRESO_INCOMPLETO });
    expect(finalizarButtonDisabled(html)).toBe(true);
    expect(html).toContain('data-testid="finalizar-cargue-hint"');
    expect(html).toContain("El cargue solo puede finalizar cuando el conteo esté completo.");
  });

  it("se habilita si escaneados === esperados (> 0)", () => {
    const html = renderBar({ estado: "EN_CARGUE", progreso: PROGRESO_COMPLETO });
    expect(finalizarButtonDisabled(html)).toBe(false);
    expect(html).not.toContain('data-testid="finalizar-cargue-hint"');
  });

  it("se deshabilita si esperados === 0 (sin progreso real)", () => {
    const html = renderBar({ estado: "EN_CARGUE", progreso: PROGRESO_SIN_ESPERADOS });
    expect(finalizarButtonDisabled(html)).toBe(true);
  });

  it("se deshabilita si no hay progreso cargado (null)", () => {
    const html = renderBar({ estado: "EN_CARGUE", progreso: null });
    expect(finalizarButtonDisabled(html)).toBe(true);
  });

  it("se deshabilita mientras finalizando=true, incluso con progreso completo", () => {
    const html = renderBar({ estado: "EN_CARGUE", progreso: PROGRESO_COMPLETO, finalizando: true });
    expect(finalizarButtonDisabled(html)).toBe(true);
    expect(html).toContain("Finalizando…");
  });
});

describe("progresoCompleto — helper puro", () => {
  it("true solo si esperados > 0 y escaneados === esperados", () => {
    expect(progresoCompleto({ escaneados: 5, esperados: 5 })).toBe(true);
    expect(progresoCompleto({ escaneados: 4, esperados: 5 })).toBe(false);
    expect(progresoCompleto({ escaneados: 0, esperados: 0 })).toBe(false);
    expect(progresoCompleto(null)).toBe(false);
    expect(progresoCompleto(undefined)).toBe(false);
  });
});

describe("TransporteAccionesBar — sin cierre manual cuando puedeCierreManual=false (cierre manual real llegó en G3C7)", () => {
  it("no renderiza el botón de cierre manual si puedeCierreManual no se pasa", () => {
    const html = renderBar({ estado: "EN_CARGUE", progreso: PROGRESO_COMPLETO });
    expect(html).not.toContain('data-testid="btn-cierre-manual"');
  });
});

describe("TransporteAccionesBar — pendiente de cobertura (documentado, requiere jsdom)", () => {
  it.todo("ConfirmModal de finalizar llama POST /finalizar con updatedAt al confirmar (requiere jsdom)");
  it.todo("409 de finalizar (cantidad no coincide / novedad abierta) muestra mensaje del backend y refresca detalle (requiere jsdom)");
  it.todo("éxito de finalizar muestra toast, recarga detalle y listado, pedido queda CARGUE_COMPLETO (requiere jsdom)");
});
