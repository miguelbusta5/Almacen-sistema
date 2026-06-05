"use client";

import {
  useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search, Home, Package, Truck, ClipboardList,
  Users, ScrollText, Plus, ArrowRight, X,
  BarChart3, FileText, Store,
} from "lucide-react";
import { useCommandPalette } from "@/contexts/CommandPaletteContext";
import { canSeeModule } from "@/lib/modulePermissions";

// ── Tipos ─────────────────────────────────────────────────
type ResultGroup = "actions" | "navigate" | "muebles" | "transporte";

interface PaletteResult {
  id: string;
  group: ResultGroup;
  icon: React.ReactNode;
  label: string;
  description?: string;
  color?: string;
  action: () => void;
}

const GROUP_LABEL: Record<ResultGroup, string> = {
  actions:    "Acciones rápidas",
  navigate:   "Navegar a",
  muebles:    "Novedades Muebles",
  transporte: "Guardados Transporte",
};

const GROUP_ORDER: ResultGroup[] = ["actions", "navigate", "muebles", "transporte"];

// ── Búsqueda debounced ────────────────────────────────────
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Componente principal ──────────────────────────────────
export default function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [liveResults, setLiveResults] = useState<PaletteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 280);

  useEffect(() => { setMounted(true); }, []);

  // Enfocar input cuando se abre
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIdx(0);
      setLiveResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Navegación y cierre
  const go = useCallback((path: string) => {
    close();
    router.push(path);
  }, [close, router]);

  // Items estáticos (sin query)
  const staticResults = useMemo((): PaletteResult[] => {
    const see = (key: Parameters<typeof canSeeModule>[1]) => canSeeModule(role, key);

    const actions: PaletteResult[] = [
      ...(see("inventario") ? [{ id: "a-novedad",  group: "actions" as ResultGroup, icon: <Plus size={14} />, label: "Nueva novedad de inventario", description: "Registrar diferencia de PLU en el CEDI", color: "#2563EB", action: () => go("/dashboard/inventario") }] : []),
      ...(see("transporte") ? [{ id: "a-guardado", group: "actions" as ResultGroup, icon: <Plus size={14} />, label: "Nuevo guardado en transporte",  description: "Registrar pedido en custodia",          color: "#0E7490", action: () => go("/dashboard/transporte") }] : []),
      ...(see("tienda")     ? [{ id: "a-despacho", group: "actions" as ResultGroup, icon: <Store size={14} />, label: "Nuevo despacho de tienda", description: "Registrar despacho para recogida por transporte", color: "#7C3AED", action: () => go("/dashboard/tienda") }] : []),
    ];

    const navigate: PaletteResult[] = [
      { id: "n-inicio", group: "navigate", icon: <Home size={14} />, label: "Inicio", action: () => go("/dashboard") },
      ...(see("inventario")    ? [{ id: "n-inventario",  group: "navigate" as ResultGroup, icon: <Package size={14} />,       label: "Novedades Inventario",    action: () => go("/dashboard/inventario") }] : []),
      ...(see("tienda")        ? [{ id: "n-tienda",      group: "navigate" as ResultGroup, icon: <Store size={14} />,          label: "Despachos Tienda",        action: () => go("/dashboard/tienda") }] : []),
      ...(see("transporte")    ? [{ id: "n-transporte",  group: "navigate" as ResultGroup, icon: <Truck size={14} />,          label: "Guardados Transporte",    action: () => go("/dashboard/transporte") }] : []),
      ...(see("conteo-contar") ? [{ id: "n-contar",      group: "navigate" as ResultGroup, icon: <ClipboardList size={14} />,  label: "Conteo",                  action: () => go("/dashboard/conteo/contar") }] : []),
      ...(see("conteo")        ? [{ id: "n-conteo",      group: "navigate" as ResultGroup, icon: <BarChart3 size={14} />,      label: "Gestión de Conteo",       action: () => go("/dashboard/conteo") }] : []),
      ...(see("centro-control")? [{ id: "n-control",     group: "navigate" as ResultGroup, icon: <BarChart3 size={14} />,      label: "Centro de Control",       action: () => go("/dashboard/centro-control") }] : []),
      ...(see("usuarios")      ? [{ id: "n-usuarios",    group: "navigate" as ResultGroup, icon: <Users size={14} />,          label: "Usuarios",                action: () => go("/dashboard/usuarios") }] : []),
      ...(see("auditoria")     ? [{ id: "n-auditoria",   group: "navigate" as ResultGroup, icon: <ScrollText size={14} />,     label: "Auditoría",               action: () => go("/dashboard/auditoria") }] : []),
    ];

    return [...actions, ...navigate];
  }, [role, go]);

  // Búsqueda en vivo (debounced)
  useEffect(() => {
    if (debouncedQuery.length < 2) { setLiveResults([]); return; }
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const [nRes, gRes] = await Promise.all([
          fetch(`/api/novedades?q=${encodeURIComponent(debouncedQuery)}&pageSize=5`),
          fetch(`/api/transporte?q=${encodeURIComponent(debouncedQuery)}&pageSize=5`),
        ]);
        if (cancelled) return;
        const [nJ, gJ] = await Promise.all([nRes.json(), gRes.json()]);
        const results: PaletteResult[] = [];

        if (nJ.success) {
          for (const n of nJ.data ?? []) {
            results.push({
              id: `nov-${n.id}`,
              group: "muebles",
              icon: <Package size={13} />,
              label: `PLU ${n.plu}`,
              description: `${n.descripcion ?? ""} · ${n.posicion} · ${n.estado}`,
              color: "#2563EB",
              action: () => go("/dashboard/muebles"),
            });
          }
        }
        if (gJ.success) {
          for (const g of gJ.data ?? []) {
            results.push({
              id: `gua-${g.clientId}`,
              group: "transporte",
              icon: <Truck size={13} />,
              label: g.documento,
              description: `${g.ubicacion} · ${g.estado} · ${g.tipo}`,
              color: "#0E7490",
              action: () => go("/dashboard/transporte"),
            });
          }
        }
        if (!cancelled) setLiveResults(results);
      } catch { /* noop */ } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery, go]);

  // Resultados combinados y filtrados
  const allResults = useMemo((): PaletteResult[] => {
    if (!query) return staticResults;
    const q = query.toLowerCase();
    const filtered = staticResults.filter((r) =>
      r.label.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q)
    );
    return [...filtered, ...liveResults];
  }, [query, staticResults, liveResults]);

  // Resetear índice cuando cambian resultados
  useEffect(() => { setSelectedIdx(0); }, [allResults]);

  // Scroll automático al ítem seleccionado
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  // Teclado: Esc, flechas, Enter
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, allResults.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && allResults[selectedIdx]) {
        e.preventDefault();
        allResults[selectedIdx].action();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close, allResults, selectedIdx]);

  // ⚠ Todos los hooks ANTES de cualquier return condicional (Rules of Hooks)
  const grouped = useMemo(() => {
    const map = new Map<ResultGroup, { result: PaletteResult; globalIdx: number }[]>();
    let idx = 0;
    for (const result of allResults) {
      if (!map.has(result.group)) map.set(result.group, []);
      map.get(result.group)!.push({ result, globalIdx: idx++ });
    }
    return map;
  }, [allResults]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh",
        padding: "12vh 16px 0",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 16,
          width: "100%", maxWidth: 580,
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        {/* ── Input de búsqueda ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: allResults.length > 0 ? "1px solid var(--border)" : "none",
        }}>
          <Search size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar o ejecutar un comando…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 15, color: "var(--text)", fontFamily: "var(--sans)",
            }}
          />
          {searching && (
            <div style={{ width: 14, height: 14, border: "2px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 }} />
          )}
          {query && !searching && (
            <button
              onClick={() => setQuery("")}
              style={{ background: "var(--surface2)", border: "none", borderRadius: 5, padding: "3px 6px", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
            >
              <X size={11} />Limpiar
            </button>
          )}
          <kbd style={{ display: "flex", alignItems: "center", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 6px", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", flexShrink: 0 }}>
            Esc
          </kbd>
        </div>

        {/* ── Lista de resultados ── */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {allResults.length === 0 && query.length > 0 && !searching && (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              <FileText size={28} style={{ margin: "0 auto 10px", opacity: 0.4, display: "block" }} />
              Sin resultados para "{query}"
            </div>
          )}

          {GROUP_ORDER.map((group) => {
            const items = grouped.get(group);
            if (!items || items.length === 0) return null;
            return (
              <div key={group}>
                <div style={{ padding: "8px 18px 4px", fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {GROUP_LABEL[group]}
                </div>
                {items.map(({ result, globalIdx }) => (
                  <button
                    key={result.id}
                    data-idx={globalIdx}
                    onClick={result.action}
                    onMouseEnter={() => setSelectedIdx(globalIdx)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center",
                      gap: 12, padding: "9px 18px",
                      background: selectedIdx === globalIdx ? "var(--surface2)" : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                      transition: "background .08s",
                    }}
                  >
                    {/* Ícono */}
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: result.color ? result.color + "14" : "var(--surface2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: result.color ?? "var(--muted2)",
                    }}>
                      {result.icon}
                    </div>

                    {/* Texto */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", letterSpacing: "-0.01em" }}>
                        {result.label}
                      </div>
                      {result.description && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {result.description}
                        </div>
                      )}
                    </div>

                    {/* Flecha (visible cuando está seleccionado) */}
                    <ArrowRight
                      size={13}
                      style={{
                        color: "var(--muted)", flexShrink: 0,
                        opacity: selectedIdx === globalIdx ? 1 : 0,
                        transition: "opacity .1s",
                      }}
                    />
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* ── Footer con hints ── */}
        <div style={{
          padding: "8px 18px",
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 16,
          fontSize: 11, color: "var(--faint)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <kbd style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)" }}>↑↓</kbd>
            navegar
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <kbd style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)" }}>↵</kbd>
            seleccionar
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <kbd style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)" }}>Esc</kbd>
            cerrar
          </span>
          <span style={{ marginLeft: "auto" }}>
            {allResults.length} resultado{allResults.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
