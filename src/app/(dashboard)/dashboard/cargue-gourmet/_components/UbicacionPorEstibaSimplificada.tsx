"use client";

// Vista simplificada de "Asignar ubicación" para pedidos G2+ (cajas ya
// escaneadas por estiba desde la creación): ya no se vuelve a pedir la
// cantidad de cajas ni sus códigos — solo la ubicación física de cada
// estiba, que ya trae su conteo real de cajas escaneadas.
export interface EstibaUbicacionRow {
  secuencia: number;
  cantidadCajas: number;
  ubicacion: string;
  observacion: string;
}

const inp: React.CSSProperties = {
  minWidth: 0, width: "100%", height: 34, padding: "0 8px", fontSize: 13,
  border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)",
};

export function UbicacionPorEstibaSimplificada({
  rows,
  setRows,
}: {
  rows: EstibaUbicacionRow[];
  setRows: React.Dispatch<React.SetStateAction<EstibaUbicacionRow[]>>;
}) {
  function update(idx: number, patch: Partial<EstibaUbicacionRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>
        Ubicación por estiba (cajas ya escaneadas en la creación del pedido)
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="ubicacion-simplificada-list">
        {rows.map((row, idx) => (
          <div
            key={row.secuencia}
            data-testid={`ubicacion-simplificada-row-${idx}`}
            style={{
              display: "flex", flexDirection: "column", gap: 6,
              padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                Estiba {row.secuencia}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }} data-testid={`ubicacion-simplificada-count-${idx}`}>
                {row.cantidadCajas} caja{row.cantidadCajas !== 1 ? "s" : ""} escaneada{row.cantidadCajas !== 1 ? "s" : ""}
              </span>
            </div>
            <input
              placeholder="Ubicación (ej. Pasillo B - Nivel 2)"
              value={row.ubicacion}
              onChange={(e) => update(idx, { ubicacion: e.target.value })}
              data-testid={`ubicacion-simplificada-ubicacion-${idx}`}
              style={inp}
            />
            <input
              placeholder="Observación (opcional)"
              value={row.observacion}
              onChange={(e) => update(idx, { observacion: e.target.value })}
              data-testid={`ubicacion-simplificada-observacion-${idx}`}
              style={{ ...inp, height: 32, fontSize: 12 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
