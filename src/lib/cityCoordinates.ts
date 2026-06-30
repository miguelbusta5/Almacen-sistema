export interface CityCoords {
  lat: number;
  lng: number;
}

// Normaliza nombres de ciudad: sin tildes, sin puntos, trim, minúsculas.
// Permite que "Bogotá D.C.", "Bogota D.C." y "bogota dc" resuelvan igual.
export function normalizeCity(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\./g, "");
}

// Clave normalizada → coordenadas WGS-84 (centroide de la ciudad)
const RAW: Record<string, CityCoords> = {
  "bogota dc":        { lat: 4.7110,  lng: -74.0721 },
  "medellin":         { lat: 6.2442,  lng: -75.5812 },
  "cali":             { lat: 3.4516,  lng: -76.5320 },
  "barranquilla":     { lat: 10.9685, lng: -74.7813 },
  "cartagena":        { lat: 10.3910, lng: -75.4794 },
  "bucaramanga":      { lat: 7.1193,  lng: -73.1227 },
  "pereira":          { lat: 4.8133,  lng: -75.6961 },
  "manizales":        { lat: 5.0703,  lng: -75.5138 },
  "armenia":          { lat: 4.5339,  lng: -75.6811 },
  "cucuta":           { lat: 7.8939,  lng: -72.5078 },
  "ibague":           { lat: 4.4389,  lng: -75.2322 },
  "santa marta":      { lat: 11.2408, lng: -74.1990 },
  "villavicencio":    { lat: 4.1420,  lng: -73.6266 },
  "pasto":            { lat: 1.2136,  lng: -77.2811 },
  "monteria":         { lat: 8.7575,  lng: -75.8812 },
  "sincelejo":        { lat: 9.3047,  lng: -75.3978 },
  "valledupar":       { lat: 10.4781, lng: -73.2697 },
  "neiva":            { lat: 2.9273,  lng: -75.2819 },
  "tunja":            { lat: 5.5353,  lng: -73.3678 },
  "popayan":          { lat: 2.4419,  lng: -76.6072 },
  "riohacha":         { lat: 11.5444, lng: -72.9072 },
  "quibdo":           { lat: 5.6947,  lng: -76.6611 },
  "yopal":            { lat: 5.3378,  lng: -72.3958 },
  "florencia":        { lat: 1.6144,  lng: -75.6062 },
  "san andres":       { lat: 12.5847, lng: -81.7006 },
  "arauca":           { lat: 7.0870,  lng: -70.7593 },
  "leticia":          { lat: -4.2153, lng: -69.9406 },
  "mocoa":            { lat: 1.1519,  lng: -76.6496 },
  "mitu":             { lat: 1.2536,  lng: -70.2335 },
  "puerto carreno":   { lat: 6.1896,  lng: -67.4857 },
  "inirida":          { lat: 3.8653,  lng: -67.9239 },
};

export function getCityCoords(nombre: string): CityCoords | null {
  return RAW[normalizeCity(nombre)] ?? null;
}

export const CITY_COORDINATES = RAW;
