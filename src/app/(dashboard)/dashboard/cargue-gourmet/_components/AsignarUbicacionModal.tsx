"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { EstibasCajasFieldset } from "./EstibasCajasFieldset";
import { UbicacionPorEstibaSimplificada, type EstibaUbicacionRow } from "./UbicacionPorEstibaSimplificada";
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

// Un pedido tiene "escaneo inicial" (G2+) cuando al menos una de sus cajas ya
// quedó vinculada a una estiba desde la creación — en ese caso el conteo por
// estiba es un hecho real y ya no se debe volver a pedir.
function tieneEscaneoInicial(pedido: PedidoUbicable | null): boolean {
  return !!pedido && pedido.estibas.length > 0 && pedido.cajas.some((c) => c.estibaId != null);
}

function filasUbicacionSimplificada(pedido: PedidoUbicable | null): EstibaUbicacionRow[] {
  if (!pedido) return [];
  return pedido.estibas
    .slice()
    .sort((a, b) => a.secuencia - b.secuencia)
    .map((e) => ({
      secuencia: e.secuencia,
      cantidadCajas: pedido.cajas.filter((c) => c.estibaId === e.id).length,
      ubicacion: e.ubicacion ?? "",
      observacion: e.observacion ?? "",
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
  const simplificado = tieneEscaneoInicial(pedido);
  const [estibas, setEstibas] = useState<EstibaForm[]>(estibasFromPedido(pedido));
  const [cajas, setCajas] = useState<CajaForm[]>(cajasFromPedido(pedido));
  const [filasSimplificadas, setFilasSimplificadas] = useState<EstibaUbicacionRow[]>(filasUbicacionSimplificada(pedido));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEstibas(estibasFromPedido(pedido));
      setCajas(cajasFromPedido(pedido));
      setFilasSimplificadas(filasUbicacionSimplificada(pedido));
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

    let payloadEstibas: { secuencia: number; ubicacion: string; observacion?: string }[];
    let payloadCajas: { codigoCaja?: string; numeroSecuencia?: number }[] | undefined;
    if (simplificado) {
      for (const row of filasSimplificadas) {
        if (!row.ubicacion.trim()) { setError(`Estiba ${row.secuencia}: indica la ubicación`); return; }
      }
      payloadEstibas = filasSimplificadas.map((row) => ({
        secuencia: row.secuencia,
        ubicacion: row.ubicacion.trim(),
        observacion: row.observacion.trim() || undefined,
      }));
      payloadCajas = undefined;
    } else {
      const parsed = parseEstibasCajas(estibas, cajas, pedido.cajasEsperadas);
      if ("error" in parsed) { setError(parsed.error); return; }
      payloadEstibas = parsed.data.estibas;
      payloadCajas = parsed.data.cajas.length > 0 ? parsed.data.cajas : undefined;
    }

    setSaving(true);
    try {
      await apiPost(`/api/cargue-gourmet/${pedido.id}/ubicacion`, {
        estibas: payloadEstibas,
        cajas: payloadCajas,
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
      subtitle={simplificado ? "Las cajas ya fueron escaneadas al crear el pedido" : "Una ubicación y cantidad de cajas por cada estiba"}
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
        {simplificado ? (
          <UbicacionPorEstibaSimplificada rows={filasSimplificadas} setRows={setFilasSimplificadas} />
        ) : (
          <EstibasCajasFieldset
            estibas={estibas}
            setEstibas={setEstibas}
            cajas={cajas}
            setCajas={setCajas}
            cajasEsperadas={pedido?.cajasEsperadas ?? null}
          />
        )}
        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }} data-testid="ubicacion-error">{error}</p>}
      </form>
    </Modal>
  );
}
