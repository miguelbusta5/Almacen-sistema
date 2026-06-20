"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Package,
  Pencil,
  Search,
  Store,
  Truck,
} from "lucide-react";
import {
  Badge,
  EmptyState,
  SkeletonStat,
  SkeletonTable,
  Stat,
} from "@/components/ui";
import {
  DespachoTienda,
  EstadoDespacho,
  ESTADO_DESPACHO_COLOR,
  ESTADO_DESPACHO_LABEL,
  ESTADOS_DESPACHO,
  FLUJO_ESTADOS,
  PlinDespacho,
  estadoDespachoVariant,
  fmtFechaTienda,
  horasDesde,
} from "@/lib/tienda";
import type { IntelInsight } from "@/lib/inteligencia";
import styles from "./tienda.module.css";

type KpiItem = {
  key: string;
  value: number | string;
  label: string;
  hint: string;
  color: string;
  icon: ReactNode;
  onClick?: () => void;
};

export function FacturaKpiGrid({
  loading,
  kpis,
  onEstado,
}: {
  loading: boolean;
  kpis: {
    total: number;
    pendientesRecogida: number;
    recogidoTienda: number;
    entregadoCedi: number;
    enviadoCliente: number;
    novedades: number;
  };
  onEstado: (estado: EstadoDespacho) => void;
}) {
  if (loading) {
    return (
      <div className={styles.kpiGrid}>
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
    );
  }

  const pct = (value: number) => kpis.total > 0 ? `${Math.round((value / kpis.total) * 100)}% del total` : "Sin registros";
  const items: KpiItem[] = [
    {
      key: "creados",
      value: kpis.pendientesRecogida,
      label: "Creados en tienda",
      hint: pct(kpis.pendientesRecogida),
      color: ESTADO_DESPACHO_COLOR.CREADO_TIENDA,
      icon: <Store size={16} />,
      onClick: () => onEstado("CREADO_TIENDA"),
    },
    {
      key: "proceso",
      value: kpis.recogidoTienda + kpis.entregadoCedi,
      label: "En proceso CEDI",
      hint: pct(kpis.recogidoTienda + kpis.entregadoCedi),
      color: ESTADO_DESPACHO_COLOR.RECOGIDO_TIENDA,
      icon: <Truck size={16} />,
      onClick: () => onEstado("RECOGIDO_TIENDA"),
    },
    {
      key: "enviados",
      value: kpis.enviadoCliente,
      label: "Enviados al cliente",
      hint: pct(kpis.enviadoCliente),
      color: ESTADO_DESPACHO_COLOR.ENVIADO_CLIENTE,
      icon: <CheckCircle2 size={16} />,
      onClick: () => onEstado("ENVIADO_CLIENTE"),
    },
    {
      key: "novedad",
      value: kpis.novedades,
      label: "Con novedad",
      hint: pct(kpis.novedades),
      color: kpis.novedades > 0 ? ESTADO_DESPACHO_COLOR.CON_NOVEDAD : "var(--muted)",
      icon: <AlertTriangle size={16} />,
      onClick: () => onEstado("CON_NOVEDAD"),
    },
    {
      key: "total",
      value: kpis.total,
      label: "Total facturas",
      hint: "Bandeja visible",
      color: "var(--mod-color)",
      icon: <Package size={16} />,
    },
  ];

  return (
    <div className={styles.kpiGrid}>
      {items.map((item) => (
        <Stat
          key={item.key}
          icon={item.icon}
          value={item.value}
          label={item.label}
          trend={item.hint}
          color={item.color}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
}

export function EstadoPipeline({
  items,
  activeEstado,
  onToggle,
}: {
  items: DespachoTienda[];
  activeEstado: string;
  onToggle: (estado: EstadoDespacho) => void;
}) {
  return (
    <div className={styles.pipeline}>
      {FLUJO_ESTADOS.map((estado) => {
        const count = items.filter((d) => d.estado === estado).length;
        const color = ESTADO_DESPACHO_COLOR[estado];
        const active = activeEstado === estado;
        return (
          <button
            key={estado}
            type="button"
            className={`${styles.pipelineStep} ${active ? styles.pipelineStepActive : ""}`}
            style={{ "--step-color": color } as CSSProperties}
            onClick={() => onToggle(estado)}
          >
            <span className={styles.pipelineCount}>{count}</span>
            <span className={styles.pipelineLabel}>{ESTADO_DESPACHO_LABEL[estado]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FacturaIntelBanner({
  insights,
  onOpenFirst,
}: {
  insights: IntelInsight[];
  onOpenFirst?: () => void;
}) {
  if (insights.length === 0) return null;
  const first = insights[0];
  return (
    <section className={styles.intelligence}>
      <div className={styles.sectionLabel}>
        <AlertTriangle size={14} color="var(--error)" />
        Inteligencia operacional
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 14, alignItems: "center" }}>
        <div>
          <div style={{ color: "var(--text)", fontSize: 16, fontWeight: 850 }}>{first.message}</div>
          {first.context && <div className={styles.mutedLine}>{first.context}</div>}
        </div>
        {onOpenFirst && (
          <button type="button" className="ds-btn ds-btn-secondary" onClick={onOpenFirst}>
            Ver detalle
          </button>
        )}
      </div>
    </section>
  );
}

export function RejectedQueue({
  rejected,
  onOpen,
  onEdit,
  onResend,
}: {
  rejected: DespachoTienda[];
  onOpen: (d: DespachoTienda) => void;
  onEdit: (d: DespachoTienda) => void;
  onResend: (id: string) => void;
}) {
  if (rejected.length === 0) return null;
  return (
    <section>
      <div className={styles.sectionLabel}>
        <AlertTriangle size={14} color="var(--error)" />
        {rejected.length} solicitud{rejected.length > 1 ? "es" : ""} rechazada{rejected.length > 1 ? "s" : ""} requiere{rejected.length > 1 ? "n" : ""} corrección
      </div>
      <div className={styles.rejectedStack}>
        {rejected.map((d) => (
          <article key={d.id} className={styles.rejectedCard}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                <span className={styles.docCode}>{d.numeroDocumento}</span>
                <Badge label="Rechazado" variant="error" />
              </div>
              <div className={styles.mutedLine}>
                {d.clienteNombre} · {d.centroCostos}
                {d.numeroCajas != null && ` · ${d.numeroCajas} caja${d.numeroCajas !== 1 ? "s" : ""}`}
              </div>
              {d.motivoRechazo && (
                <div className={styles.noteBox} style={{ "--section-color": "var(--error)", marginTop: 10 } as CSSProperties}>
                  <strong style={{ display: "block", color: "var(--error)", marginBottom: 3 }}>Motivo del rechazo</strong>
                  {d.motivoRechazo}
                </div>
              )}
            </div>
            <div className={styles.rejectedActions}>
              <button type="button" onClick={() => onOpen(d)} className="ds-btn ds-btn-secondary ds-btn-sm">Ver detalle</button>
              <button type="button" onClick={() => onEdit(d)} className="ds-btn ds-btn-secondary ds-btn-sm"><Pencil size={12} />Editar</button>
              <button type="button" onClick={() => onResend(d.id)} className="ds-btn ds-btn-primary ds-btn-sm"><CheckCircle2 size={12} />Re-enviar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FacturaFilterBar({
  query,
  estado,
  centro,
  centros,
  count,
  total,
  onQuery,
  onEstado,
  onCentro,
  onClear,
}: {
  query: string;
  estado: string;
  centro: string;
  centros: string[];
  count: number;
  total: number;
  onQuery: (value: string) => void;
  onEstado: (value: string) => void;
  onCentro: (value: string) => void;
  onClear: () => void;
}) {
  const hasFilters = Boolean(query || estado || centro);
  return (
    <div className={styles.toolbar}>
      <div className={styles.searchBox}>
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar doc, cliente, consecutivo..."
          className={`ds-input ${styles.searchInput}`}
        />
      </div>
      <select value={estado} onChange={(e) => onEstado(e.target.value)} className="ds-input">
        <option value="">Todos los estados</option>
        {ESTADOS_DESPACHO.map((e) => <option key={e} value={e}>{ESTADO_DESPACHO_LABEL[e]}</option>)}
      </select>
      <select value={centro} onChange={(e) => onCentro(e.target.value)} className="ds-input">
        <option value="">Todos los centros</option>
        {centros.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
      </select>
      {hasFilters && <button type="button" className="ds-btn ds-btn-secondary" onClick={onClear}>Limpiar</button>}
      <span className={styles.countPill}>{count} de {total}</span>
    </div>
  );
}

export function FacturasTable({
  loading,
  items,
  allCount,
  selectedId,
  sortCol,
  sortDir,
  onSort,
  onOpen,
  onClearFilters,
}: {
  loading: boolean;
  items: DespachoTienda[];
  allCount: number;
  selectedId?: string | null;
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  onOpen: (d: DespachoTienda) => void;
  onClearFilters: () => void;
}) {
  const Th = ({ col, label }: { col: string; label: string }) => {
    const active = sortCol === col;
    return (
      <th className={styles.sortable} onClick={() => onSort(col)}>
        {label} {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </th>
    );
  };

  return (
    <section className={styles.tablePanel}>
      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : items.length === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            icon={<Store size={22} />}
            title="Sin facturas"
            description={allCount > 0 ? "No hay resultados para estos filtros." : "Las facturas contado aparecerán aquí."}
            action={allCount > 0 ? { label: "Limpiar filtros", onClick: onClearFilters } : undefined}
          />
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.facturaTable}>
            <thead>
              <tr>
                <th style={{ width: 24 }} />
                <Th col="fechaCreacion" label="Fecha" />
                <Th col="centroCostos" label="Centro costos" />
                <th>Doc. / consecutivo</th>
                <Th col="clienteNombre" label="Cliente" />
                <Th col="estado" label="Estado" />
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const horas = d.estado === "CREADO_TIENDA" ? horasDesde(d.createdAt) : 0;
                const critico = horas >= 24;
                return (
                  <tr
                    key={d.id}
                    className={`${styles.row} ${selectedId === d.id ? styles.rowSelected : ""}`}
                    style={{ "--row-color": ESTADO_DESPACHO_COLOR[d.estado] } as CSSProperties}
                    onClick={() => onOpen(d)}
                  >
                    <td>{critico && <AlertTriangle size={15} color="var(--error)" aria-label="Creado hace más de 24 horas sin recogida" />}</td>
                    <td className={styles.monoText}>{fmtFechaTienda(d.fechaCreacion)}</td>
                    <td style={{ fontWeight: 800 }}>{d.centroCostos}</td>
                    <td>
                      <div className={styles.docCode}>{d.numeroDocumento}</div>
                      <div className={styles.mutedLine}>#{d.consecutivo}</div>
                    </td>
                    <td>
                      <div className={styles.clientName}>{d.clienteNombre}</div>
                      {d.clienteTelefono && <div className={styles.mutedLine}>{d.clienteTelefono}</div>}
                    </td>
                    <td>
                      <Badge
                        label={ESTADO_DESPACHO_LABEL[d.estado]}
                        variant={estadoDespachoVariant(d.estado)}
                        color={ESTADO_DESPACHO_COLOR[d.estado]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function DetailFlow({ estado }: { estado: EstadoDespacho }) {
  return (
    <div className={styles.detailFlow}>
      {FLUJO_ESTADOS.map((step, index) => {
        const currentIndex = FLUJO_ESTADOS.indexOf(estado);
        const done = currentIndex > index;
        const active = estado === step;
        const color = ESTADO_DESPACHO_COLOR[step];
        return (
          <div
            key={step}
            className={`${styles.detailFlowStep} ${done ? styles.detailFlowStepDone : ""} ${active ? styles.detailFlowStepActive : ""}`}
            style={{ "--flow-color": color } as CSSProperties}
          >
            <span className={styles.flowDot}>{done ? <CheckCircle2 size={14} /> : active ? <span style={{ width: 8, height: 8, borderRadius: 99, background: "#fff" }} /> : null}</span>
            <span>{ESTADO_DESPACHO_LABEL[step].split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PluList({ plines }: { plines: PlinDespacho[] }) {
  return (
    <div className={styles.pluList}>
      {plines.map((p) => (
        <div key={p.id} className={styles.pluItem}>
          <Package size={14} color="var(--mod-color)" />
          <span className={styles.docCode}>{p.plu}</span>
          {p.descripcion && <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted2)", fontSize: 12 }}>{p.descripcion}</span>}
          <span className={styles.docCode} style={{ color: "var(--mod-color)" }}>{p.unidades} u.</span>
        </div>
      ))}
    </div>
  );
}

export function FormSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.formSection}>
      <div className={styles.formSectionTitle}>
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function FormChevron() {
  return <ChevronDown size={13} />;
}
