"use client";

import { useState } from "react";
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
import { Badge, SkeletonStat, Stat } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
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
import { nivelEntregaColorFecha, ENTREGA_COLOR } from "@/lib/transporte";
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

const INSIGHT_LEVEL_COLOR: Record<string, string> = {
  critical: "var(--error)",
  warning:  "var(--warning)",
  info:     "var(--info)",
};

export function FacturaIntelBanner({
  insights,
  onOpenFirst,
  onOpenRecord,
}: {
  insights: IntelInsight[];
  onOpenFirst?: () => void;
  onOpenRecord?: (recordId: string) => void;
}) {
  if (insights.length === 0) return null;
  const [first, ...rest] = insights;
  return (
    <section className={styles.intelligence}>
      <div className={styles.sectionLabel}>
        <AlertTriangle size={14} color="var(--error)" />
        Inteligencia operacional
        {insights.length > 1 && <span className={styles.intelCount}>{insights.length} alertas</span>}
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
      {rest.length > 0 && (
        <div className={styles.intelChips}>
          {rest.map((ins) => {
            const color = INSIGHT_LEVEL_COLOR[ins.level] ?? "var(--info)";
            const clickable = Boolean(onOpenRecord && ins.recordId);
            const content = (
              <>
                <span className={styles.intelChipDot} />
                {ins.message}
              </>
            );
            return clickable ? (
              <button
                key={ins.id}
                type="button"
                className={`${styles.intelChip} ${styles.intelChipClickable}`}
                style={{ "--chip-color": color } as CSSProperties}
                title={ins.context ?? "Ver detalle"}
                onClick={() => onOpenRecord?.(String(ins.recordId))}
              >
                {content}
              </button>
            ) : (
              <span
                key={ins.id}
                className={styles.intelChip}
                style={{ "--chip-color": color } as CSSProperties}
                title={ins.context ?? undefined}
              >
                {content}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

// "hace N h" / "hace N días" — para contextualizar cuánto lleva un rechazo sin corregir.
function tiempoTranscurrido(iso: string): string {
  const horas = horasDesde(iso);
  if (horas < 1) return "hace menos de 1 h";
  if (horas < 48) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} días`;
}

// Con más de N rechazadas, la cola colapsa para no desplazar la tabla principal.
const REJECTED_COLLAPSE_THRESHOLD = 3;

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
  const [expanded, setExpanded] = useState(false);
  if (rejected.length === 0) return null;
  const collapsible = rejected.length > REJECTED_COLLAPSE_THRESHOLD;
  const visible = collapsible && !expanded ? rejected.slice(0, REJECTED_COLLAPSE_THRESHOLD) : rejected;
  return (
    <section>
      <div className={styles.sectionLabel}>
        <AlertTriangle size={14} color="var(--error)" />
        {rejected.length} solicitud{rejected.length > 1 ? "es" : ""} rechazada{rejected.length > 1 ? "s" : ""} requiere{rejected.length > 1 ? "n" : ""} corrección
        {collapsible && (
          <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Mostrar menos" : `Ver todas (${rejected.length})`}
            <ChevronDown size={12} style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 160ms ease" }} />
          </button>
        )}
      </div>
      <div className={styles.rejectedStack}>
        {visible.map((d) => (
          <article key={d.id} className={styles.rejectedCard}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                <span className={styles.docCode}>{d.numeroDocumento}</span>
                <Badge label="Rechazado" variant="error" />
                {d.rechazadoAt && <span className={styles.rejectedAge}>Rechazada {tiempoTranscurrido(d.rechazadoAt)}</span>}
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

// Badge de estado robusto: usa los estados reales del dominio y, si llegara
// un valor desconocido/ausente desde la API, degrada a "Sin estado" en vez de
// romper o mostrar texto de otra columna.
function EstadoBadge({ estado }: { estado: EstadoDespacho | null | undefined }) {
  const known = !!estado && estado in ESTADO_DESPACHO_LABEL;
  if (!known) {
    return <Badge label="Sin estado" variant="muted" color="var(--muted)" />;
  }
  const e = estado as EstadoDespacho;
  return (
    <Badge
      label={ESTADO_DESPACHO_LABEL[e]}
      variant={estadoDespachoVariant(e)}
      color={ESTADO_DESPACHO_COLOR[e]}
    />
  );
}

// Leyenda de colores: explica el rail lateral y el ícono de alerta. Solo
// muestra los estados realmente presentes en la bandeja visible.
function StateLegend({ items }: { items: DespachoTienda[] }) {
  if (items.length === 0) return null;
  const presentes = ESTADOS_DESPACHO.filter((e) => items.some((d) => d.estado === e));
  const hayCritico = items.some((d) => d.estado === "CREADO_TIENDA" && horasDesde(d.createdAt) >= 24);
  if (presentes.length === 0 && !hayCritico) return null;
  return (
    <div className={styles.legend} aria-label="Leyenda de estados">
      <span className={styles.legendTitle}>Estados</span>
      {presentes.map((e) => (
        <span key={e} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: ESTADO_DESPACHO_COLOR[e] }} />
          {ESTADO_DESPACHO_LABEL[e]}
        </span>
      ))}
      {hayCritico && (
        <span className={styles.legendItem}>
          <AlertTriangle size={12} color="var(--error)" />
          +24 h sin recogida
        </span>
      )}
    </div>
  );
}

export function FacturasTable({
  loading,
  items,
  allCount,
  selectedId,
  onOpen,
  onClearFilters,
  debug = false,
}: {
  loading: boolean;
  items: DespachoTienda[];
  allCount: number;
  selectedId?: string | null;
  onOpen: (d: DespachoTienda) => void;
  onClearFilters: () => void;
  debug?: boolean;
}) {
  // Columnas según el contrato de tabla del SOT §9:
  // FECHA · CENTRO COSTOS · DOC/CONSECUTIVO · CLIENTE · ESTADO (badge por fila).
  const columns: Column<DespachoTienda>[] = [
    {
      key: "fechaCreacion",
      header: "Fecha",
      sortable: true,
      sortValue: (d) => d.fechaCreacion,
      width: "10%",
      testId: "fecha-cell",
      debugLabel: "Fecha",
      render: (d) => {
        const horas = horasDesde(d.createdAt);
        const critico = d.estado === "CREADO_TIENDA" && horas >= 24;
        const conNovedad = d.estado === "CON_NOVEDAD";
        const alertLabel = critico
          ? `Sin recoger hace ${horas} h`
          : conNovedad
            ? "Con novedad registrada"
            : "";
        return (
          <span className={styles.monoText} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, flexShrink: 0, display: "inline-flex" }}>
              {(critico || conNovedad) && (
                <AlertTriangle size={14} color={critico ? "var(--error)" : "var(--state-alert)"} role="img" aria-label={alertLabel}>
                  <title>{alertLabel}</title>
                </AlertTriangle>
              )}
            </span>
            {fmtFechaTienda(d.fechaCreacion)}
          </span>
        );
      },
    },
    {
      key: "entrega",
      header: "Entrega comprometida",
      sortable: true,
      // Asc = entrega más próxima primero (vencidas arriba); sin fecha al final.
      sortValue: (d) => d.fechaEntregaComprometida ?? "9999-99-99",
      width: "13%",
      testId: "entrega-cell",
      debugLabel: "Entrega",
      render: (d) => {
        if (!d.fechaEntregaComprometida) return <span style={{ color: "var(--error)", fontWeight: 600, fontSize: 11 }}>Sin fecha asignada</span>;
        const color = ENTREGA_COLOR[nivelEntregaColorFecha(d.fechaEntregaComprometida, d.estado === "ENVIADO_CLIENTE")];
        return <span className={styles.monoText} style={{ color, fontWeight: color ? 700 : undefined }}>{fmtFechaTienda(d.fechaEntregaComprometida)}</span>;
      },
    },
    {
      key: "ciudad",
      header: "Ciudad destino",
      sortable: true,
      sortValue: (d) => d.ciudad ?? "",
      width: "12%",
      testId: "ciudad-cell",
      debugLabel: "Ciudad",
      render: (d) => (
        <span className={styles.cellTruncate} style={{ display: "block", color: d.ciudad ? undefined : "var(--faint)" }} title={d.ciudad ?? ""}>{d.ciudad ?? "—"}</span>
      ),
    },
    {
      key: "centroCostos",
      header: "Centro costos",
      sortable: true,
      sortValue: (d) => d.centroCostos,
      width: "14%",
      testId: "centro-cell",
      debugLabel: "Centro",
      render: (d) => (
        <span className={styles.cellTruncate} style={{ display: "block", fontWeight: 600 }} title={d.centroCostos}>
          {d.centroCostos}
        </span>
      ),
    },
    {
      key: "documento",
      header: "Doc. / consecutivo",
      width: "17%",
      testId: "doc-cell",
      debugLabel: "Doc",
      render: (d) => (
        <>
          <div className={`${styles.docCode} ${styles.cellTruncate}`} title={d.numeroDocumento}>{d.numeroDocumento}</div>
          <div className={`${styles.mutedLine} ${styles.cellTruncate}`}>#{d.consecutivo}</div>
        </>
      ),
    },
    {
      key: "clienteNombre",
      header: "Cliente",
      sortable: true,
      sortValue: (d) => d.clienteNombre,
      width: "19%",
      testId: "cliente-cell",
      debugLabel: "Cliente",
      render: (d) => {
        const sub = [d.clienteDocumento, d.clienteTelefono].filter(Boolean).join(" · ");
        return (
          <>
            <div className={styles.clientName} title={d.clienteNombre}>{d.clienteNombre}</div>
            {sub && <div className={`${styles.mutedLine} ${styles.cellTruncate}`} title={sub}>{sub}</div>}
          </>
        );
      },
    },
    {
      key: "estado",
      header: "Estado",
      sortable: true,
      sortValue: (d) => ESTADO_DESPACHO_LABEL[d.estado] ?? "Sin estado",
      width: "15%",
      // (Fecha 10 · Entrega 13 · Ciudad 12 · Centro 14 · Doc 17 · Cliente 19 · Estado 15 = 100%)
      testId: "estado-cell",
      debugLabel: "Estado",
      render: (d) => <EstadoBadge estado={d.estado} />,
    },
  ];

  return (
    <section className={styles.tablePanel}>
      <DataTable<DespachoTienda>
        columns={columns}
        rows={items}
        getRowKey={(d) => d.id}
        loading={loading}
        onRowClick={onOpen}
        getRowColor={(d) => ESTADO_DESPACHO_COLOR[d.estado]}
        isRowSelected={(d) => !!selectedId && d.id === selectedId}
        density="compact"
        tableLayout="fixed"
        minWidth={980}
        skeletonRows={8}
        ariaLabel="Facturas contado"
        debug={debug}
        defaultSort={{ key: "entrega", dir: "asc" }}
        legend={<StateLegend items={items} />}
        empty={{
          icon: <Store size={22} />,
          title: "Sin facturas",
          description: allCount > 0 ? "No hay resultados para estos filtros." : "Las facturas contado aparecerán aquí.",
          action: allCount > 0 ? { label: "Limpiar filtros", onClick: onClearFilters } : undefined,
        }}
      />
    </section>
  );
}

// Hora corta de un hito del flujo ("19 jun, 10:32") o "—" si aún no ocurre.
function fmtHito(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function DetailFlow({ despacho }: { despacho: DespachoTienda }) {
  const estado = despacho.estado;
  // Timestamp real de cada paso del flujo lineal (mismos campos del detalle).
  const hitos: Partial<Record<EstadoDespacho, string | null>> = {
    CREADO_TIENDA:   despacho.createdAt,
    RECOGIDO_TIENDA: despacho.recibidoAt,
    ENTREGADO_CEDI:  despacho.entregadoCediAt,
    ENVIADO_CLIENTE: despacho.despachadoAt,
  };
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
            <span className={styles.flowTimestamp}>{fmtHito(hitos[step])}</span>
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

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
      {error
        ? <span className={styles.fieldError} role="alert">{error}</span>
        : hint
          ? <span className={styles.fieldHint}>{hint}</span>
          : null}
    </div>
  );
}

export function FormChevron() {
  return <ChevronDown size={13} />;
}
