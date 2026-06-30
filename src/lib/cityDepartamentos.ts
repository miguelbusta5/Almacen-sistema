import { normalizeCity } from "@/lib/cityCoordinates";

// Ciudad (normalizada) → nombre del departamento EXACTO como aparece en
// public/geo/colombia-departamentos.geojson (propiedad NOMBRE_DPT, en mayúsculas).
// El match se hace normalizando ambos lados con normalizeCity.
export const CITY_TO_DEPARTAMENTO: Record<string, string> = {
  "bogota dc":      "SANTAFE DE BOGOTA D.C",
  "medellin":       "ANTIOQUIA",
  "la estrella":    "ANTIOQUIA", // origen fijo de exportaciones
  "cali":           "VALLE DEL CAUCA",
  "barranquilla":   "ATLANTICO",
  "cartagena":      "BOLIVAR",
  "bucaramanga":    "SANTANDER",
  "pereira":        "RISARALDA",
  "manizales":      "CALDAS",
  "armenia":        "QUINDIO",
  "cucuta":         "NORTE DE SANTANDER",
  "ibague":         "TOLIMA",
  "santa marta":    "MAGDALENA",
  "villavicencio":  "META",
  "pasto":          "NARIÑO",
  "monteria":       "CORDOBA",
  "sincelejo":      "SUCRE",
  "valledupar":     "CESAR",
  "neiva":          "HUILA",
  "tunja":          "BOYACA",
  "popayan":        "CAUCA",
  "riohacha":       "LA GUAJIRA",
  "quibdo":         "CHOCO",
  "yopal":          "CASANARE",
  "florencia":      "CAQUETA",
  "san andres":     "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
  "arauca":         "ARAUCA",
  "leticia":        "AMAZONAS",
  "mocoa":          "PUTUMAYO",
  "mitu":           "VAUPES",
  "puerto carreno": "VICHADA",
  "inirida":        "GUAINIA",
};

// Devuelve el departamento (NOMBRE_DPT) de una ciudad, o null si no está mapeada.
export function departamentoDeCiudad(nombre: string): string | null {
  return CITY_TO_DEPARTAMENTO[normalizeCity(nombre)] ?? null;
}

// Etiqueta bonita por clave normalizada de departamento (para tooltip/panel).
const DEPT_LABEL: Record<string, string> = {
  "antioquia": "Antioquia",
  "atlantico": "Atlántico",
  "santafe de bogota dc": "Bogotá D.C.",
  "bolivar": "Bolívar",
  "boyaca": "Boyacá",
  "caldas": "Caldas",
  "caqueta": "Caquetá",
  "cauca": "Cauca",
  "cesar": "Cesar",
  "cordoba": "Córdoba",
  "cundinamarca": "Cundinamarca",
  "choco": "Chocó",
  "huila": "Huila",
  "la guajira": "La Guajira",
  "magdalena": "Magdalena",
  "meta": "Meta",
  "narino": "Nariño",
  "norte de santander": "Norte de Santander",
  "quindio": "Quindío",
  "risaralda": "Risaralda",
  "santander": "Santander",
  "sucre": "Sucre",
  "tolima": "Tolima",
  "valle del cauca": "Valle del Cauca",
  "arauca": "Arauca",
  "casanare": "Casanare",
  "putumayo": "Putumayo",
  "amazonas": "Amazonas",
  "guainia": "Guainía",
  "guaviare": "Guaviare",
  "vaupes": "Vaupés",
  "vichada": "Vichada",
  "archipielago de san andres providencia y santa catalina": "San Andrés y Providencia",
};

// Etiqueta legible a partir del NOMBRE_DPT del GeoJSON (con fallback Title Case).
export function deptLabel(nombreDpt: string): string {
  const key = normalizeCity(nombreDpt);
  if (DEPT_LABEL[key]) return DEPT_LABEL[key];
  return nombreDpt
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
