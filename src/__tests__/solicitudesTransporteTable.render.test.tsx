import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SolicitudesTable } from "@/app/(dashboard)/dashboard/solicitudes-transporte/_components";
import type { Solicitud } from "@/app/(dashboard)/dashboard/solicitudes-transporte/_components";

// Fila mock con datos reales similares a producción (incluye textos largos).
const mockRow: Solicitud = {
  id: "sol-1",
  fechaSolicitud: "2026-06-01",
  areaSolicitante: "Despachos",
  solicitanteNombre: "Maria Fernanda Restrepo Gutierrez",
  solicitanteCorreo: "maria.restrepo@grupoambiente.com",
  solicitanteTelefono: "3001234567",
  tipoVenta: "N/A",
  numeroPedido: "PED-99887766",
  facturaIntegracion: "FAC-001",
  cobroFlete: false,
  cantidadCajas: 12,
  volumenEstimado: "Mediano",
  tipoMercancia: "Mixto",
  ciudadOrigen: "Bogota D.C. - Zona Industrial Montevideo Norte",
  zonaRecogida: "Urbana",
  direccionRecogida: "Calle 1 # 2-3",
  puntoRecogida: "90 Cedi",
  ciudadEntrega: "Medellin - Comuna 14 El Poblado",
  direccionEntrega: "Calle 4 # 5-6",
  zonaEntrega: "Urbana",
  fechaPromesaEntrega: "2026-06-10",
  ventanaEntrega: "Horario A.M",
  restriccionHoraria: false,
  tipoServicio: "Entrega directa",
  observacionesSolicitante: "Sin observaciones",
  estado: "PROGRAMADA",
  stellaEstado: "PROGRAMADO",
  transportadora: "Transportadora XYZ",
  semaforo: "ALERTA",
  creadoPorId: "user-1",
  plines: [{ plu: "PLU1", descripcion: "Producto 1", unidades: 3 }],
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const html = renderToStaticMarkup(
  <SolicitudesTable loading={false} rows={[mockRow]} onOpen={() => {}} />,
);

function cellHtml(testId: string): string {
  const m = html.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}
const text = (testId: string) => cellHtml(testId).replace(/<[^>]*>/g, "").trim();

describe("SolicitudesTable — estructura y mapeo (render)", () => {
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>")[0] ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("ESTRUCTURA: th === td === col === 8 (sin celda extra de rail)", () => {
    expect(thCount).toBe(8);
    expect(tdCount).toBe(8);
    expect(colCount).toBe(8);
    expect(thCount).toBe(tdCount);
    expect(colCount).toBe(thCount);
  });

  it("ESTRUCTURA: la primera celda corresponde al primer header (Solicitud)", () => {
    const beforeFirstTd = firstRow.slice(0, firstRow.indexOf("<td"));
    expect(beforeFirstTd).not.toContain("<td");
    expect(firstRow.indexOf('data-testid="solicitud-cell"')).toBeLessThan(
      firstRow.indexOf('data-testid="origen-cell"'),
    );
  });

  it("ESTRUCTURA: las celdas van en el mismo orden que los headers", () => {
    const ids = [
      "solicitud-cell", "origen-cell", "destino-cell", "cajas-cell",
      "promesa-cell", "estado-cell", "semaforo-cell", "gestion-cell",
    ];
    const positions = ids.map((id) => firstRow.indexOf(`data-testid="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("CONTENIDO: estado-cell = badge de Estado (no Cliente/solicitante)", () => {
    expect(cellHtml("estado-cell")).toContain("ds-badge");
    expect(text("estado-cell")).toBe("PROGRAMADA");
    expect(text("estado-cell")).not.toContain("Maria Fernanda");
  });

  it("CONTENIDO: semaforo-cell = badge de Semáforo (no Estado)", () => {
    expect(cellHtml("semaforo-cell")).toContain("ds-badge");
    expect(text("semaforo-cell")).toBe("ALERTA");
    expect(text("semaforo-cell")).not.toBe("PROGRAMADA");
  });

  it("CONTENIDO: solicitud-cell no contiene el estado", () => {
    expect(text("solicitud-cell")).not.toContain("PROGRAMADA");
    expect(text("solicitud-cell")).toContain("PED-99887766");
  });

  it("CONTENIDO: no existe rail como celda extra; el rail va en --row-color del <tr>", () => {
    expect(firstRow).toContain("--row-color");
    expect(firstRow.match(/<td[ >]/g)?.length).toBe(8);
  });

  it("RENDER: textos largos no rompen la estructura de la tabla", () => {
    expect(text("origen-cell")).toContain("Bogota D.C.");
    expect(text("destino-cell")).toContain("Medellin");
    expect(thCount).toBe(tdCount);
  });

  it("GUARD: no usa tr::before ni tr::after en el markup generado", () => {
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });
});
