"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EmptyState, SkeletonRow } from "./index";

// ═══════════════════════════════════════════════════════════
// DATA TABLE — tabla reutilizable sobre .g-table
// Sorting client-side, empty state, skeleton de carga y
// acciones de fila (render libre por columna).
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
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  getRowColor?: (row: T) => string | undefined;
  isRowSelected?: (row: T) => boolean;
  empty?: { icon?: ReactNode; title: string; description?: string };
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
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

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

  return (
    <div className="g-table-wrap">
      <table className="g-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.sortable ? "sortable" : undefined}
                style={{ textAlign: c.align, width: c.width }}
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
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ height: "auto", padding: 0 }}>
                <EmptyState
                  icon={empty?.icon ?? null}
                  title={empty?.title ?? "Sin datos"}
                  description={empty?.description}
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
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }}>
                    {c.render
                      ? c.render(row)
                      : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
