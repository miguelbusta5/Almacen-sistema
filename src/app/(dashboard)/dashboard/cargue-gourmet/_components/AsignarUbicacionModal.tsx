"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";

export interface EstibaForm { secuencia: string; ubicacion: string; observacion: string; }
export interface CajaForm { codigoCaja: string; numeroSecuencia: string; }

export interface PedidoUbicable {
  id: string;
  updatedAt: string;
  estibas: Array<{ secuencia: number; ubicacion: string; observacion: string | null }>;
  cajas: Array<{ numeroSecuencia: number | null; codigoCaja: string | null }>;
}

function emptyEstiba(secuencia: number): EstibaForm {
  return { secuencia: String(secuencia), ubicacion: "", observacion: "" };
}
function emptyCaja(): CajaForm {
  return { codigoCaja: "", numeroSecuencia: "" };
}

function estibasFromPedido(p: PedidoUbicable | null): EstibaForm[] {
  if (!p || p.estibas.length === 0) return [emptyEstiba(1)];
  return p.estibas.map((e) => ({ secuencia: String(e.secuencia), ubicacion: e.ubicacion, observacion: e.observacion ?? "" }));
}
function cajasFromPedido(p: PedidoUbicable | null): CajaForm[] {
  return (p?.cajas ?? []).map((c) => ({
    codigoCaja: c.codigoCaja ?? "",
    numeroSecuencia: c.numeroSecuencia != null ? String(c.numeroSecuencia) : "",
  }));
}

export function AsignarUbicacionModal({
  open,
  pedido,
  onClose,
  onSaved,
}: {
  open: boolean;
  pedido: PedidoUbicable | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [estibas, setEstibas] = useState<EstibaForm[]>(estibasFromPedido(pedido));
  const [cajas, setCajas] = useState<CajaForm[]>(cajasFromPedido(pedido));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEstibas(estibasFromPedido(pedido));
      setCajas(cajasFromPedido(pedido));
      setError("");
    }
  }, [open, pedido]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  function addEstiba() {
    const nextSecuencia = estibas.length + 1;
    setEstibas((rows) => [...rows, emptyEstiba(nextSecuencia)]);
  }
  function removeEstiba(idx: number) {
    setEstibas((rows) => rows.filter((_, i) => i !== idx));
  }
  function updateEstiba(idx: number, patch: Partial<EstibaForm>) {
    setEstibas((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addCaja() {
    setCajas((rows) => [...rows, emptyCaja()]);
  }
  function removeCaja(idx: number) {
    setCajas((rows) => rows.filter((_, i) => i !== idx));
  }
  function updateCaja(idx: number, patch: Partial<CajaForm>) {
    setCajas((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !pedido) return;
    setError("");

    if (estibas.length === 0) { setError("Agrega al menos una estiba"); return; }

    const estibasParsed: { secuencia: number; ubicacion: string; observacion?: string }[] = [];
    for (const row of estibas) {
      const secuencia = parseInt(row.secuencia, 10);
      if (!Number.isInteger(secuencia) || secuencia <= 0) { setError("Cada secuencia de estiba debe ser un entero mayor a 0"); return; }
      if (!row.ubicacion.trim()) { setError("Cada estiba debe tener una ubicación"); return; }
      estibasParsed.push({ secuencia, ubicacion: row.ubicacion.trim(), observacion: row.observacion.trim() || undefined });
    }
    const secuenciasEstiba = estibasParsed.map((e) => e.secuencia);
    if (new Set(secuenciasEstiba).size !== secuenciasEstiba.length) {
      setError("No puede haber dos estibas con la misma secuencia");
      return;
    }

    const cajasParsed: { codigoCaja?: string; numeroSecuencia?: number }[] = [];
    for (const row of cajas) {
      if (!row.codigoCaja.trim() && !row.numeroSecuencia.trim()) continue;
      const entry: { codigoCaja?: string; numeroSecuencia?: number } = {};
      if (row.codigoCaja.trim()) entry.codigoCaja = row.codigoCaja.trim();
      if (row.numeroSecuencia.trim()) {
        const n = parseInt(row.numeroSecuencia, 10);
        if (!Number.isInteger(n) || n <= 0) { setError("El número de secuencia de caja debe ser un entero mayor a 0"); return; }
        entry.numeroSecuencia = n;
      }
      cajasParsed.push(entry);
    }
    const numerosCaja = cajasParsed.map((c) => c.numeroSecuencia).filter((n): n is number => n !== undefined);
    if (new Set(numerosCaja).size !== numerosCaja.length) {
      setError("No puede haber dos cajas con el mismo número de secuencia");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/cargue-gourmet/${pedido.id}/ubicacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estibas: estibasParsed,
          cajas: cajasParsed.length > 0 ? cajasParsed : undefined,
          updatedAt: pedido.updatedAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo guardar la ubicación");
        return;
      }
      toast.success("Ubicación asignada");
      onSaved();
      onClose();
    } catch {
      setError("Error de red — verifica tu conexión e intenta de nuevo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Asignar ubicación"
      subtitle="Estibas y cajas del pedido"
      size="lg"
      footer={
        <>
          <button type="button" onClick={handleClose} className="g-btn g-btn-ghost" disabled={saving}>Cancelar</button>
          <button type="submit" form="asignar-ubicacion-form" className="g-btn g-btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar ubicación"}
          </button>
        </>
      }
    >
      <form id="asignar-ubicacion-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>Estibas</label>
            <button type="button" onClick={addEstiba} data-testid="add-estiba-btn" style={{ fontSize: 12, background: "none", border: "none", color: "var(--brand)", cursor: "pointer" }}>
              <Plus size={12} style={{ verticalAlign: "middle" }} /> Añadir estiba
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="estibas-form-list">
            {estibas.map((row, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 28px", gap: 6 }} data-testid={`estiba-row-${idx}`}>
                <input
                  type="number" min={1} placeholder="Secuencia"
                  value={row.secuencia}
                  onChange={(e) => updateEstiba(idx, { secuencia: e.target.value })}
                  data-testid={`estiba-secuencia-${idx}`}
                  style={{ height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" }}
                />
                <input
                  placeholder="Ubicación"
                  value={row.ubicacion}
                  onChange={(e) => updateEstiba(idx, { ubicacion: e.target.value })}
                  data-testid={`estiba-ubicacion-${idx}`}
                  style={{ height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" }}
                />
                <input
                  placeholder="Observación (opcional)"
                  value={row.observacion}
                  onChange={(e) => updateEstiba(idx, { observacion: e.target.value })}
                  data-testid={`estiba-observacion-${idx}`}
                  style={{ height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" }}
                />
                <button type="button" onClick={() => removeEstiba(idx)} data-testid={`remove-estiba-${idx}`} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "var(--error-tint)", color: "var(--error)", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>Cajas (opcional)</label>
            <button type="button" onClick={addCaja} data-testid="add-caja-btn" style={{ fontSize: 12, background: "none", border: "none", color: "var(--brand)", cursor: "pointer" }}>
              <Plus size={12} style={{ verticalAlign: "middle" }} /> Añadir caja
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="cajas-form-list">
            {cajas.map((row, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "90px 1fr 28px", gap: 6 }} data-testid={`caja-row-${idx}`}>
                <input
                  type="number" min={1} placeholder="N°"
                  value={row.numeroSecuencia}
                  onChange={(e) => updateCaja(idx, { numeroSecuencia: e.target.value })}
                  data-testid={`caja-numero-${idx}`}
                  style={{ height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" }}
                />
                <input
                  placeholder="Código de caja (opcional)"
                  value={row.codigoCaja}
                  onChange={(e) => updateCaja(idx, { codigoCaja: e.target.value })}
                  data-testid={`caja-codigo-${idx}`}
                  style={{ height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" }}
                />
                <button type="button" onClick={() => removeCaja(idx)} data-testid={`remove-caja-${idx}`} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "var(--error-tint)", color: "var(--error)", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {cajas.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Sin cajas registradas — opcional.</p>
            )}
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }} data-testid="ubicacion-error">{error}</p>}
      </form>
    </Modal>
  );
}
