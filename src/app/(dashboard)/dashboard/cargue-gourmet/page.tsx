"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ModuleHero } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { canSeeModule } from "@/lib/modulePermissions";
import { getModuleCssVars } from "@/lib/moduleTheme";
import {
  CargueGourmetTable, ESTADOS_PEDIDO_GOURMET, ESTADO_LABEL,
  type GourmetPedidoRow, type EstadoPedidoGourmet,
} from "./_components";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

const inp: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.7rem",
  fontSize: 12, fontFamily: "var(--mono)", outline: "none", background: "var(--surface)", color: "var(--text)",
};

export default function CargueGourmetPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const toast = useToast();

  const [pedidos, setPedidos] = useState<GourmetPedidoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [debugTable, setDebugTable] = useState(false);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [estado, setEstado] = useState<EstadoPedidoGourmet | "">("");
  const [tipoOrden, setTipoOrden] = useState<"" | "OVDM" | "TSDM">("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modo debug de tabla: /dashboard/cargue-gourmet?debugTable=1
  useEffect(() => { setDebugTable(new URLSearchParams(window.location.search).get("debugTable") === "1"); }, []);

  // Debounce simple para la búsqueda de texto — no hay otro patrón de
  // debounce en el proyecto, así que se mantiene minimal (un solo setTimeout).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQDebounced(q.trim()), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const load = useCallback(async (toPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (qDebounced) params.set("q", qDebounced);
      if (ciudad) params.set("ciudad", ciudad);
      if (estado) params.set("estado", estado);
      if (tipoOrden) params.set("tipoOrden", tipoOrden);
      params.set("page", String(toPage));
      params.set("pageSize", String(PAGE_SIZE));

      const res = await fetch(`/api/cargue-gourmet?${params.toString()}`);
      if (!res.ok) {
        toast.error("No se pudo cargar el listado de Cargue Gourmet");
        return;
      }
      const json = await res.json();
      setPedidos(json.data ?? []);
      setTotal(json.total ?? 0);
      setPage(json.page ?? toPage);
    } catch {
      toast.error("Error de red al cargar pedidos — verifica tu conexión");
    } finally {
      setLoading(false);
    }
  }, [qDebounced, ciudad, estado, tipoOrden, page, toast]);

  useEffect(() => {
    if (!role || !canSeeModule(role, "cargue-gourmet")) return;
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, ciudad, estado, tipoOrden, role]);

  if (role && !canSeeModule(role, "cargue-gourmet")) {
    return (
      <div className="g-panel g-empty animate-fade-in">
        <h3>Acceso restringido</h3>
        <p>No tienes permiso para ver el módulo Cargue Gourmet.</p>
      </div>
    );
  }

  const hasFilters = q || ciudad || estado || tipoOrden;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="animate-fade-in" style={getModuleCssVars("cargue-gourmet") as React.CSSProperties}>
      <ModuleHero
        moduleKey="cargue-gourmet"
        kicker="Gourmet · Transporte"
        title="Cargue Gourmet"
        description={`${total} pedido${total !== 1 ? "s" : ""} · ubicación y cargue verificado de pedidos Gourmet.`}
      />

      {/* Filtros */}
      <div className="g-panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por orden, tienda o código…"
          style={{ ...inp, flex: 1, minWidth: 180 }}
        />
        <input
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          placeholder="Ciudad"
          style={{ ...inp, width: 140 }}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoPedidoGourmet | "")} style={inp}>
          <option value="">Todos los estados</option>
          {ESTADOS_PEDIDO_GOURMET.map((e) => (
            <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
          ))}
        </select>
        <select value={tipoOrden} onChange={(e) => setTipoOrden(e.target.value as "" | "OVDM" | "TSDM")} style={inp}>
          <option value="">Todos los tipos</option>
          <option value="OVDM">OVDM</option>
          <option value="TSDM">TSDM</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setQ(""); setCiudad(""); setEstado(""); setTipoOrden(""); }}
            style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
          >
            Limpiar
          </button>
        )}
      </div>

      <CargueGourmetTable rows={pedidos} loading={loading} debug={debugTable} />

      {/* Paginación */}
      {!loading && pedidos.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem", fontSize: 12, color: "var(--muted)" }}>
          <span>Página {page} de {totalPages} · {total} pedido{total !== 1 ? "s" : ""}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button disabled={page <= 1} onClick={() => load(page - 1)} className="g-btn g-btn-secondary g-btn-sm">Anterior</button>
            <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="g-btn g-btn-secondary g-btn-sm">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
