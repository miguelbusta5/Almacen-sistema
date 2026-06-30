import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TransporteAccionesBar } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/TransporteAccionesBar";
import { CierreManualModal } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/CierreManualModal";
import type { EstadoPedidoGourmet } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components";

// Nota de alcance (Fase G3C7): igual que en G3C2/G3C4/G3C5/G3C6,
// `CierreManualModal` está envuelto en `Modal` (createPortal), que en este
// entorno Vitest (node, sin jsdom) siempre devuelve null. Por eso solo se
// testea el contrato mínimo de ese componente. La visibilidad/habilitación
// del botón "Cierre manual" vive en `TransporteAccionesBar` (puro, sin
// portal) y tiene cobertura completa real.

const ALL_ESTADOS: EstadoPedidoGourmet[] = [
  "BORRADOR", "UBICACION_ASIGNADA", "ENVIADO_A_TRANSPORTE", "EN_CARGUE",
  "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CON_NOVEDAD", "CANCELADO",
];

function renderBar(opts: {
  estado: EstadoPedidoGourmet;
  puedeTransporte?: boolean;
  puedeCierreManual?: boolean;
}) {
  return renderToStaticMarkup(
    <TransporteAccionesBar
      estado={opts.estado}
      puedeTransporte={opts.puedeTransporte ?? false}
      onIniciarCargue={() => {}}
      puedeCierreManual={opts.puedeCierreManual ?? true}
      onCierreManual={() => {}}
    />
  );
}

describe("TransporteAccionesBar — 'Cierre manual' por rol", () => {
  it("aparece para SUPERVISOR_TRANSPORTE en EN_CARGUE", () => {
    const html = renderBar({ estado: "EN_CARGUE", puedeCierreManual: true });
    expect(html).toContain('data-testid="btn-cierre-manual"');
  });

  it("aparece para SUPERVISOR_TRANSPORTE en CON_NOVEDAD", () => {
    const html = renderBar({ estado: "CON_NOVEDAD", puedeCierreManual: true });
    expect(html).toContain('data-testid="btn-cierre-manual"');
  });

  it("aparece para ADMIN en EN_CARGUE (mismo flag puedeCierreManual)", () => {
    const html = renderBar({ estado: "EN_CARGUE", puedeCierreManual: true });
    expect(html).toContain("Cierre manual");
  });

  it("aparece para GERENTE en EN_CARGUE (mismo flag puedeCierreManual)", () => {
    const html = renderBar({ estado: "EN_CARGUE", puedeCierreManual: true });
    expect(html).toContain("Cierre manual");
  });

  it("NO aparece para TRANSPORTE (puedeCierreManual=false)", () => {
    const html = renderBar({ estado: "EN_CARGUE", puedeTransporte: true, puedeCierreManual: false });
    expect(html).not.toContain('data-testid="btn-cierre-manual"');
  });

  it("NO aparece para OPERACIONES_GOURMET (puedeCierreManual=false, puedeTransporte=false)", () => {
    const html = renderBar({ estado: "EN_CARGUE", puedeTransporte: false, puedeCierreManual: false });
    expect(html).toBe("");
  });
});

describe("TransporteAccionesBar — 'Cierre manual' por estado", () => {
  it.each(["EN_CARGUE", "CON_NOVEDAD"] as EstadoPedidoGourmet[])(
    "aparece en %s",
    (estado) => expect(renderBar({ estado, puedeCierreManual: true })).toContain('data-testid="btn-cierre-manual"')
  );

  it.each(["BORRADOR", "UBICACION_ASIGNADA", "ENVIADO_A_TRANSPORTE", "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CANCELADO"] as EstadoPedidoGourmet[])(
    "NO aparece en %s",
    (estado) => expect(renderBar({ estado, puedeCierreManual: true })).not.toContain('data-testid="btn-cierre-manual"')
  );
});

describe("TransporteAccionesBar — sin cámara ni QR", () => {
  it("no renderiza cámara ni librería QR en ningún estado", () => {
    for (const estado of ALL_ESTADOS) {
      const html = renderBar({ estado, puedeCierreManual: true });
      for (const prohibido of ["camera", "Camera", "getUserMedia", "qrcode", "barcode", "QrReader", "BarcodeScanner"]) {
        expect(html).not.toContain(prohibido);
      }
    }
  });

  it("no hay referencias a getUserMedia en el módulo", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dir = "src/app/(dashboard)/dashboard/cargue-gourmet";

    function walk(d: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(full);
      }
      return out;
    }

    for (const file of walk(dir)) {
      const src = fs.readFileSync(file, "utf-8");
      expect(src).not.toMatch(/getUserMedia/);
    }
  });

  it("mantiene los endpoints del cargue (iniciar-cargue, escanear, finalizar, ubicacion) referenciados", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/app/(dashboard)/dashboard/cargue-gourmet/page.tsx", "utf-8");
    for (const endpoint of ["/iniciar-cargue", "/escanear", "/finalizar", "/ubicacion"]) {
      expect(src).toContain(endpoint);
    }
    // "Enviar a Transporte" fue eliminado: ya no debe referenciarse.
    expect(src).not.toContain("/enviar-transporte");
  });
});

describe("CierreManualModal — contrato mínimo (Modal con portal, ver nota de alcance)", () => {
  it("no lanza error al renderizar abierto o cerrado", () => {
    expect(() =>
      renderToStaticMarkup(<CierreManualModal open={false} pedido={null} onClose={() => {}} onClosed={() => {}} />)
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(<CierreManualModal open={true} pedido={null} onClose={() => {}} onClosed={() => {}} />)
    ).not.toThrow();
  });

  it.todo("muestra la advertencia de contingencia y los 3 campos del formulario (requiere jsdom)");
  it.todo("rechaza motivo con menos de 5 caracteres antes de enviar (requiere jsdom)");
  it.todo("rechaza cantidadContadaManual negativa o no entera antes de enviar (requiere jsdom)");
  it.todo("envía POST /cierre-manual con cantidadContadaManual, motivo, observacion y updatedAt=detalle.updatedAt (requiere jsdom)");
  it.todo("409 muestra el mensaje del backend sin cerrar el modal y conserva los datos del formulario (requiere jsdom)");
  it.todo("éxito muestra toast, cierra el modal, recarga detalle y listado (requiere jsdom)");
});
