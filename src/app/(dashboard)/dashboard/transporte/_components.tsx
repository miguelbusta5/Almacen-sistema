"use client";

import { Truck } from "lucide-react";
import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
  Guardado,
  TipoGuardado,
  AlertaTier,
  alertaTier,
  scoreGuardado,
  fmtFecha,
  fmtCOP,
  parseEntrega,
  nivelEntregaColor,
  ENTREGA_COLOR,
  ALERTA_TIER_COLOR,
  ALERTA_TIER_LABEL,
} from "@/lib/transporte";
import { calcAlmacenaje } from "@/lib/almacenaje";
import styles from "./transporte.module.css";

export function TipoBadge({ tipo }: { tipo: TipoGuardado }) {
  return <Badge label={tipo === "ECOMMERCE" ? "Ecommerce" : "Común"} variant={tipo === "ECOMMERCE" ? "info" : "default"} dot={false} />;
}

export function EstadoBadge({ estado }: { estado: string }) {
  return <Badge label={estado === "DESPACHADO" ? "Despachado" : "Pendiente"} variant={estado === "DESPACHADO" ? "success" : "warning"} />;
}

// Indicador de urgencia (score 0-100, coloreado por tier de alerta) dentro de la
// celda Fecha. Reserva 22px aunque no haya alerta, para que las fechas se alineen.
function AlertScore({ g }: { g: Guardado }) {
  const tier = alertaTier(g);
  if (tier === "ok") return <span style={{ width: 22, flexShrink: 0, display: "inline-flex" }} />;
  const score = scoreGuardado(g);
  const color = ALERTA_TIER_COLOR[tier];
  return (
    <span
      title={`Urgencia: ${score}/100 · ${ALERTA_TIER_LABEL[tier]}`}
      style={{
        width: 22, height: 22, flexShrink: 0, display: "inline-flex", alignItems: "center",
        justifyContent: "center", borderRadius: "50%", fontSize: 10, fontWeight: 800,
        color, background: `color-mix(in srgb, ${color} 14%, transparent)`,
        fontFamily: "var(--mono)", cursor: "help",
      }}
    >
      {score}
    </span>
  );
}

const TIER_ORDER: AlertaTier[] = ["aviso", "alerta", "critico", "emergencia"];

// Leyenda secundaria: explica los colores del rail (tiers de alerta presentes).
// Nunca reemplaza el badge de Estado por fila.
function TierLegend({ items }: { items: Guardado[] }) {
  if (items.length === 0) return null;
  const present = TIER_ORDER.filter((t) => items.some((g) => alertaTier(g) === t));
  if (present.length === 0) return null;
  return (
    <div className={styles.legend} aria-label="Leyenda de alertas">
      <span className={styles.legendTitle}>Alertas</span>
      {present.map((t) => (
        <span key={t} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: ALERTA_TIER_COLOR[t] }} />
          {ALERTA_TIER_LABEL[t]}
        </span>
      ))}
    </div>
  );
}

export function GuardadosTable({
  loading,
  items,
  hasFilters,
  selectedId,
  onOpen,
  onClearFilters,
  onNew,
  debug = false,
}: {
  loading: boolean;
  items: Guardado[];
  hasFilters: boolean;
  selectedId?: string | null;
  onOpen: (g: Guardado) => void;
  onClearFilters: () => void;
  onNew: () => void;
  debug?: boolean;
}) {
  // Columnas según el contrato de tabla del SOT §9. Estado = badge por fila;
  // urgencia = rail por tier (getRowColor) + score en la celda Fecha.
  const columns: Column<Guardado>[] = [
    {
      key: "fecha",
      header: "Fecha",
      sortable: true,
      sortValue: (g) => g.fecha,
      width: "13%",
      testId: "fecha-cell",
      debugLabel: "Fecha",
      render: (g) => (
        <span className={styles.monoText} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <AlertScore g={g} />
          {fmtFecha(g.fecha)}
        </span>
      ),
    },
    {
      key: "entrega",
      header: "Entrega comprometida",
      sortable: true,
      // Asc = entrega más próxima primero (vencidas/tempranas arriba); los
      // guardados sin fecha quedan al final (sentinel "9999-99-99").
      sortValue: (g) => parseEntrega(g.nota) ?? "9999-99-99",
      width: "15%",
      testId: "entrega-cell",
      debugLabel: "Entrega",
      render: (g) => {
        const entrega = parseEntrega(g.nota);
        if (!entrega) return <span style={{ color: "var(--error)", fontWeight: 600, fontSize: 11 }}>Sin fecha asignada</span>;
        const color = ENTREGA_COLOR[nivelEntregaColor(g)];
        return <span className={styles.monoText} style={{ color, fontWeight: color ? 700 : undefined }}>{fmtFecha(entrega)}</span>;
      },
    },
    {
      key: "documento",
      header: "Documento",
      sortable: true,
      sortValue: (g) => g.documento,
      width: "19%",
      testId: "doc-cell",
      debugLabel: "Doc",
      render: (g) => {
        const dias = Math.floor((Date.now() - new Date(g.fecha + "T00:00:00").getTime()) / 86_400_000);
        return (
          <>
            <div className={`${styles.docCode} ${styles.cellTruncate}`} title={g.documento}>{g.documento}</div>
            <div className={`${styles.mutedLine} ${styles.cellTruncate}`}>{dias} día{dias !== 1 ? "s" : ""} en bodega</div>
          </>
        );
      },
    },
    {
      key: "ubicacion",
      header: "Ubicación",
      sortable: true,
      sortValue: (g) => g.ubicacion,
      width: "19%",
      testId: "ubicacion-cell",
      debugLabel: "Ubicación",
      render: (g) => (
        <span className={styles.cellTruncate} style={{ display: "block" }} title={g.ubicacion}>{g.ubicacion}</span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      sortable: true,
      sortValue: (g) => g.tipo,
      width: "10%",
      testId: "tipo-cell",
      debugLabel: "Tipo",
      render: (g) => <TipoBadge tipo={g.tipo} />,
    },
    {
      key: "estado",
      header: "Estado",
      sortable: true,
      sortValue: (g) => g.estado,
      width: "14%",
      testId: "estado-cell",
      debugLabel: "Estado",
      render: (g) => <EstadoBadge estado={g.estado} />,
    },
    {
      key: "almacenaje",
      header: "Almacenaje",
      sortable: true,
      align: "right",
      width: "12%",
      // (Fecha 13 · Entrega 15 · Doc 19 · Ubic 19 · Tipo 10 · Estado 12 · Alm 12 = 100%)
      testId: "almacenaje-cell",
      debugLabel: "Almacenaje",
      sortValue: (g) => calcAlmacenaje(g.fecha, g.estado === "DESPACHADO" ? g.fechaDespacho : null).costo,
      render: (g) => {
        const alm = calcAlmacenaje(g.fecha, g.estado === "DESPACHADO" ? g.fechaDespacho : null);
        if (alm.fase === "gracia") return <span style={{ color: "var(--success)", fontWeight: 600, fontSize: 11 }}>En gracia</span>;
        if (alm.meses === 0) return <span style={{ color: "var(--muted2)", fontWeight: 600, fontSize: 11 }}>Día {alm.diasEnPeriodo}/30</span>;
        return <span style={{ color: "var(--brand)", fontWeight: 700, fontFamily: "var(--mono)", fontSize: 12 }}>{fmtCOP(alm.costo)}</span>;
      },
    },
  ];

  return (
    <section className={styles.tablePanel}>
      <DataTable<Guardado>
        columns={columns}
        rows={items}
        getRowKey={(g) => g.clientId}
        loading={loading}
        onRowClick={onOpen}
        getRowColor={(g) => (alertaTier(g) === "ok" ? undefined : ALERTA_TIER_COLOR[alertaTier(g)])}
        isRowSelected={(g) => !!selectedId && g.clientId === selectedId}
        density="compact"
        tableLayout="fixed"
        minWidth={960}
        skeletonRows={8}
        ariaLabel="Guardados transporte"
        debug={debug}
        defaultSort={{ key: "entrega", dir: "asc" }}
        legend={<TierLegend items={items} />}
        empty={{
          icon: <Truck size={22} />,
          title: "Sin guardados",
          description: hasFilters ? "No hay resultados para estos filtros." : "Los guardados de transporte aparecerán aquí.",
          action: hasFilters ? { label: "Limpiar filtros", onClick: onClearFilters } : { label: "Nuevo guardado", onClick: onNew },
        }}
      />
    </section>
  );
}
