// ─── Studio Module — tipos compartidos cliente/servidor ─────────────────────

export type StudioComponentType =
  | "kpi"
  | "tabla"
  | "barra"
  | "linea"
  | "pie"
  | "texto"
  | "imagen"
  | "separador"
  | "filtro_fecha"
  | "filtro_texto"
  | "filtro_categoria";

export type FieldType = "texto" | "numero" | "fecha" | "booleano";
export type AggType = "sum" | "count" | "avg" | "min" | "max" | "ninguna";

// ─── Layout (react-grid-layout) ─────────────────────────────────────────────
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

// ─── Fuente de datos ────────────────────────────────────────────────────────
export interface FieldDef {
  nombre: string;
  alias?: string;
  tipo: FieldType;
  oculto?: boolean;
}

export interface FormulaField {
  id: string;
  nombre: string;
  formula: string;
  tipo: FieldType;
}

export interface Parametro {
  id: string;
  nombre: string;
  tipo: "fecha" | "texto" | "numero" | "lista";
  valorDefault?: string | number;
  opciones?: string[];
}

// ─── Componente ─────────────────────────────────────────────────────────────
export interface FilterConfig {
  campo: string;
  operador: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains";
  valor: string;
}

export interface ComponentConfig {
  fuenteId?: string;
  dimension?: string;
  metrica?: string;
  agregacion?: AggType;
  campoFecha?: string;
  ordenPor?: string;
  orden?: "asc" | "desc";
  limiteFilas?: number;
  filtros?: FilterConfig[];
  columnas?: string[];
  contenido?: string; // para "texto"
  urlImagen?: string; // para "imagen"
  parametroId?: string; // para filtros de parámetro
}

export interface ComponentStyle {
  titulo?: string;
  subtitulo?: string;
  color?: string;
  colorFondo?: string;
  tamanoTexto?: number;
  mostrarEtiquetas?: boolean;
  mostrarLeyenda?: boolean;
  formatoNumero?: "entero" | "decimal" | "moneda" | "porcentaje";
  formatoFecha?: string;
  bordeRadius?: number;
  alineacion?: "left" | "center" | "right";
}

export interface StudioComponent {
  id: string;
  tipo: StudioComponentType;
  config: ComponentConfig;
  estilo: ComponentStyle;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface StudioFuenteData {
  id: string;
  dashboardId: string;
  nombre: string;
  tipo: string;
  urlSheets?: string | null;
  hojaActiva?: string | null;
  campos: FieldDef[];
  camposFormulados: FormulaField[];
  parametros: Parametro[];
  combinaciones: unknown[];
  syncedAt?: string | null;
}

export interface StudioDashboardData {
  id: string;
  nombre: string;
  descripcion?: string | null;
  layout: LayoutItem[];
  componentes: StudioComponent[];
  estilos: Record<string, unknown>;
  estado: "BORRADOR" | "PUBLICADO";
  createdById: string;
  createdAt: string;
  updatedAt: string;
  fuentes: StudioFuenteData[];
}

// ─── API payloads ────────────────────────────────────────────────────────────
export type RawRow = Record<string, string>;

export interface ColumnPreview {
  nombre: string;
  tipo: FieldType;
}

export interface ConnectResponse {
  columnas: ColumnPreview[];
  preview: RawRow[];
}

export interface AggregatedRow {
  dimension: string;
  valor: number;
}
