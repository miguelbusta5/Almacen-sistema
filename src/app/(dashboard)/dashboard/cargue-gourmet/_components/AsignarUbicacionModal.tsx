"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { EstibasCajasFieldset } from "./EstibasCajasFieldset";
import {
  type EstibaForm, type CajaForm, type PedidoConEstibasCajas,
  estibasFromPedido, cajasFromPedido, parseEstibasCajas,
} from "./estibasCajasForm";

export type { EstibaForm, CajaForm } from "./estibasCajasForm";
export { decodeEstibaObservacion } from "./estibasCajasForm";

export interface PedidoUbicable extends PedidoConEstibasCajas {
  id: string;
  updatedAt: string;
  cajasEsperadas: number;
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !pedido) return;
    setError("");

    const parsed = parseEstibasCajas(estibas, cajas, pedido.cajasEsperadas);
    if ("error" in parsed) { setError(parsed.error); return; }

    setSaving(true);
    try {
      await apiPost(`/api/cargue-gourmet/${pedido.id}/ubicacion`, {
        estibas: parsed.data.estibas,
        cajas: parsed.data.cajas.length > 0 ? parsed.data.cajas : undefined,
        updatedAt: pedido.updatedAt,
      });
      toast.success("Ubicación asignada");
      onSaved();
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo guardar la ubicación"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Asignar ubicación"
      subtitle="Una ubicación y cantidad de cajas por cada estiba"
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
        <EstibasCajasFieldset
          estibas={estibas}
          setEstibas={setEstibas}
          cajas={cajas}
          setCajas={setCajas}
          cajasEsperadas={pedido?.cajasEsperadas ?? null}
        />
        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }} data-testid="ubicacion-error">{error}</p>}
      </form>
    </Modal>
  );
}
