"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";

export interface PedidoCerrable {
  id: string;
  updatedAt: string;
}

function emptyForm() {
  return { cantidadContadaManual: "", motivo: "", observacion: "" };
}

const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5,
};
const inp: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 12px",
  background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, fontFamily: "var(--sans)",
  color: "var(--text)", outline: "none",
};
const textarea: React.CSSProperties = { ...inp, height: "auto", padding: "8px 12px", resize: "vertical" };

export function CierreManualModal({
  open,
  pedido,
  onClose,
  onClosed,
}: {
  open: boolean;
  pedido: PedidoCerrable | null;
  onClose: () => void;
  onClosed: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError("");
    }
  }, [open]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !pedido) return;
    setError("");

    const cantidad = parseInt(form.cantidadContadaManual, 10);
    if (!Number.isInteger(cantidad) || cantidad < 0) {
      setError("La cantidad contada debe ser un entero mayor o igual a 0");
      return;
    }
    if (form.motivo.trim().length < 5) {
      setError("El motivo es obligatorio y debe tener al menos 5 caracteres");
      return;
    }

    setSaving(true);
    try {
      // 409 aquí puede ser: el pedido ya no está EN_CARGUE/CON_NOVEDAD, ya fue
      // cerrado, updatedAt desactualizado, o no hay cargue válido — se muestra
      // siempre el mensaje real del backend, sin asumir cuál caso.
      await apiPost(`/api/cargue-gourmet/${pedido.id}/cierre-manual`, {
        cantidadContadaManual: cantidad,
        motivo: form.motivo.trim(),
        observacion: form.observacion.trim() || undefined,
        updatedAt: pedido.updatedAt,
      });
      toast.success("Cargue cerrado manualmente");
      onClosed();
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo cerrar manualmente el cargue"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Cierre manual de contingencia"
      subtitle="Documenta una excepción operativa del cargue"
      footer={
        <>
          <button type="button" onClick={handleClose} className="g-btn g-btn-ghost" disabled={saving}>Cancelar</button>
          <button type="submit" form="cierre-manual-form" className="g-btn g-btn-danger" disabled={saving}>
            {saving ? "Cerrando…" : "Cerrar manualmente"}
          </button>
        </>
      }
    >
      <form id="cierre-manual-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          data-testid="cierre-manual-advertencia"
          style={{ fontSize: 13, color: "var(--warning)", background: "var(--warning-tint, rgba(255,196,61,0.12))", border: "1px solid var(--warning)", borderRadius: 8, padding: "10px 12px" }}
        >
          Este cierre documenta una contingencia operativa. Solo debe usarse cuando el cargue no puede finalizarse normalmente.
        </div>

        <div>
          <label style={label}>Cantidad contada manualmente</label>
          <input
            type="number" min={0} required
            value={form.cantidadContadaManual}
            onChange={(e) => setForm((f) => ({ ...f, cantidadContadaManual: e.target.value }))}
            style={inp}
            data-testid="cierre-manual-cantidad-input"
          />
        </div>

        <div>
          <label style={label}>Motivo (mínimo 5 caracteres)</label>
          <textarea
            required
            rows={2}
            value={form.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
            placeholder="Ej. QR ilegibles por daño en varias cajas"
            style={textarea}
            data-testid="cierre-manual-motivo-input"
          />
        </div>

        <div>
          <label style={label}>Observación (opcional)</label>
          <textarea
            rows={2}
            value={form.observacion}
            onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
            style={textarea}
            data-testid="cierre-manual-observacion-input"
          />
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }} data-testid="cierre-manual-error">{error}</p>}
      </form>
    </Modal>
  );
}
