"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EmptyState, SkeletonRow } from "./index";

// ═══════════════════════════════════════════════════════════
// DATA TABLE — tabla reutilizable CANÓNICA del design system.
// Contrato SOT §9: layout determinista (table-layout:fixed + <colgroup>),
// ESTADO por fila (render → <Badge>), densidad compacta opcional,
// truncado + title, rail de color por fila, selección, sort, empty y skeleton.
// Base `.ds-table` (clase estándar; comparte estilos con `.g-table` en globals.css).
// ═══════════════════════════════════════════════════════════
export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  /** Valor para ordenar (por defecto row[key]). */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  width?: number | string;
  /** Trunca el contenido en una línea (ellipsis + title). Solo aplica a celdas sin `render`. */
  truncate?: boolean;
  /** data-testid permanente en cada `<td>` de esta columna (para tests de render/QA). */
  testId?: string;
  /** Etiqueta que muestra el modo debug dentro de la celda (default = `key`). */
  debugLabel?: string;
}

type SortState = { key: string; dir: "asc" | "desc" };

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  getRowColor?: (row: T) => string | undefined;
  isRowSelected?: (row: T) => boolean;
  empty?: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
  /** Densidad de fila. `compact` = filas más bajas y tipografía menor (default `comfortable`). */
  density?: "comfortable" | "compact";
  /** `fixed` + `<colgroup>` = anchos deterministas (evita el corrimiento thead/tbody). */
  tableLayout?: "auto" | "fixed";
  minWidth?: number | string;
  skeletonRows?: number;
  /** Orden inicial. */
  defaultSort?: SortState;
  /** Ayuda secundaria bajo la tabla (p. ej. leyenda de estados). Nunca sustituye el badge por fila. */
  legend?: ReactNode;
  ariaLabel?: string;
  /** Modo debug: cada celda antepone el nombre de su columna (diagnóstico de mapeo/corrimiento). */
  debug?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  onRowClick,
  getRowColor,
  isRowSelected,
  empty,
  density = "comfortable",
  tableLayout = "auto",
  minWidth,
  skeletonRows = 6,
  defaultSort,
  legend,
  ariaLabel,
  debug,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getVal =
      col.sortValue ?? ((r: T) => String((r as Record<string, unknown>)[col.key] ?? ""));
    return [...rows].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" },
    );
  }

  const hasWidths = columns.some((c) => c.width != null);
  const tableClass = `ds-table${density === "compact" ? " ds-table--compact" : ""}`;

  return (
    <>
      <div className="ds-table-wrap" style={{ overflowX: "auto" }}>
        <table className={tableClass} style={{ tableLayout, minWidth }} aria-label={ariaLabel}>
          {hasWidths && (
            <colgroup>
              {columns.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.sortable ? "sortable" : undefined}
                  style={{ textAlign: c.align }}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {c.header}
                    {sort?.key === c.key &&
                      (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ height: "auto", padding: 0 }}>
                  <EmptyState
                    icon={empty?.icon ?? null}
                    title={empty?.title ?? "Sin datos"}
                    description={empty?.description}
                    action={empty?.action}
                  />
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={getRowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={isRowSelected?.(row) ? "is-selected" : undefined}
                  style={{
                    cursor: onRowClick ? "pointer" : "default",
                    "--row-color": getRowColor?.(row),
                  } as CSSProperties}
                >
                  {columns.map((c) => {
                    const raw = c.render
                      ? c.render(row)
                      : String((row as Record<string, unknown>)[c.key] ?? "");
                    const content =
                      c.truncate && !c.render ? (
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={String((row as Record<string, unknown>)[c.key] ?? "")}
                        >
                          {raw}
                        </span>
                      ) : (
                        raw
                      );
                    return (
                      <td key={c.key} data-testid={c.testId} style={{ textAlign: c.align }}>
                        {debug && (
                          <span
                            style={{ color: "var(--warning)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 800, marginRight: 4 }}
                          >
                            {(c.debugLabel ?? c.key).toUpperCase()}:
                          </span>
                        )}
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {legend}
    </>
  );
}
