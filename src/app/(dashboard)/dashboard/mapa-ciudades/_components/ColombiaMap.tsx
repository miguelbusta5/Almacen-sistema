"use client";

// Este archivo solo se evalúa en el cliente (importado con dynamic + ssr:false).
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from "react-leaflet";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CiudadMapaDTO, TransportadoraCount } from "@/app/api/mapa-ciudades/route";
import { normalizeCity } from "@/lib/cityCoordinates";
import { departamentoDeCiudad, deptLabel } from "@/lib/cityDepartamentos";

const AMBER = "#F59E0B";
const EMERALD = "#0E9C76";
const EXPORT = "#6366F1"; // índigo — exportaciones

// Países destino de exportación (nombre tal como llega del API / GeoJSON).
const PAIS_KEYS = new Set(["ecuador", "mexico", "estados unidos"]);

interface RegionAgg {
  key: string;            // "dept:<norm>" | "pais:<norm>"
  label: string;
  comoOrigen: number;
  comoDestino: number;
  comoExportacion: number;
  total: number;
  transportadoras: Map<string, number>;
  ciudades: string[];
}

interface Props {
  ciudades: CiudadMapaDTO[];
  onSelectCity?: (ciudad: CiudadMapaDTO) => void;
}

// Color de borde/relleno según la actividad agregada de la región.
function colorsFor(r: RegionAgg): { stroke: string; fill: string } {
  if (r.comoExportacion > 0) return { stroke: EXPORT, fill: EXPORT };
  if (r.comoOrigen > 0 && r.comoDestino > 0) return { stroke: AMBER, fill: EMERALD }; // ambas
  if (r.comoOrigen > 0) return { stroke: AMBER, fill: AMBER };
  return { stroke: EMERALD, fill: EMERALD };
}

function toDTO(r: RegionAgg): CiudadMapaDTO {
  const transportadoras: TransportadoraCount[] = Array.from(r.transportadoras.entries())
    .map(([nombre, count]) => ({ nombre, count }))
    .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre));
  return {
    nombre: r.label,
    lat: 0,
    lng: 0,
    comoOrigen: r.comoOrigen,
    comoDestino: r.comoDestino,
    comoExportacion: r.comoExportacion,
    transportadoras,
    total: r.total,
  };
}

function tooltipHtml(r: RegionAgg): string {
  const t = Array.from(r.transportadoras.keys());
  return `
    <div style="line-height:1.5;min-width:150px">
      <div style="font-weight:700;margin-bottom:4px">${r.label}</div>
      <div>Recogidas: <strong>${r.comoOrigen}</strong></div>
      <div>Entregas: <strong>${r.comoDestino}</strong></div>
      ${r.comoExportacion > 0 ? `<div>Exportaciones: <strong>${r.comoExportacion}</strong></div>` : ""}
      <div>Total: <strong>${r.total}</strong></div>
      ${r.ciudades.length ? `<div style="margin-top:4px;font-size:0.85em;color:#555">${r.ciudades.join(" · ")}</div>` : ""}
      ${t.length ? `<div style="margin-top:2px;font-size:0.85em;color:#777">${t.join(" · ")}</div>` : ""}
    </div>`;
}

export default function ColombiaMap({ ciudades, onSelectCity }: Props) {
  const [geoDepts, setGeoDepts] = useState<FeatureCollection | null>(null);
  const [geoPaises, setGeoPaises] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/geo/colombia-departamentos.geojson").then((r) => r.json()).catch(() => null),
      fetch("/geo/paises-export.geojson").then((r) => r.json()).catch(() => null),
    ]).then(([d, p]) => {
      if (!alive) return;
      setGeoDepts(d);
      setGeoPaises(p);
    });
    return () => { alive = false; };
  }, []);

  // Agrega los DTOs por región (departamento o país).
  const { regions, fallback } = useMemo(() => {
    const map = new Map<string, RegionAgg>();
    const fallback: CiudadMapaDTO[] = [];

    const ensure = (key: string, label: string): RegionAgg => {
      let r = map.get(key);
      if (!r) {
        r = { key, label, comoOrigen: 0, comoDestino: 0, comoExportacion: 0, total: 0, transportadoras: new Map(), ciudades: [] };
        map.set(key, r);
      }
      return r;
    };

    for (const c of ciudades) {
      const norm = normalizeCity(c.nombre);
      let key: string | null = null;
      let label = c.nombre;

      if (PAIS_KEYS.has(norm)) {
        key = `pais:${norm}`;
      } else {
        const dpt = departamentoDeCiudad(c.nombre);
        if (dpt) {
          key = `dept:${normalizeCity(dpt)}`;
          label = deptLabel(dpt);
        }
      }

      if (!key) { fallback.push(c); continue; }

      const r = ensure(key, label);
      r.comoOrigen += c.comoOrigen;
      r.comoDestino += c.comoDestino;
      r.comoExportacion += c.comoExportacion;
      r.total += c.total;
      for (const t of c.transportadoras) {
        r.transportadoras.set(t.nombre, (r.transportadoras.get(t.nombre) ?? 0) + t.count);
      }
      // Nombre original de ciudad (no repetir La Estrella si ya está)
      if (!r.ciudades.includes(c.nombre)) r.ciudades.push(c.nombre);
    }

    return { regions: map, fallback };
  }, [ciudades]);

  // Firma para forzar el re-render de las capas GeoJSON al cambiar los filtros.
  const sig = useMemo(
    () => Array.from(regions.values()).map((r) => `${r.key}:${r.total}:${r.comoExportacion}`).sort().join("|"),
    [regions],
  );

  // Estilo de un feature de departamento.
  const styleDept = (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
    const nombre = (feature?.properties?.NOMBRE_DPT as string) ?? "";
    const r = regions.get(`dept:${normalizeCity(nombre)}`);
    if (!r) return { color: "#9aa5b1", weight: 0.6, opacity: 0.25, fillOpacity: 0 };
    const { stroke, fill } = colorsFor(r);
    return { color: stroke, weight: 2.5, opacity: 0.95, fillColor: fill, fillOpacity: 0.35 };
  };

  const stylePais = (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
    const pais = (feature?.properties?.pais as string) ?? "";
    const r = regions.get(`pais:${normalizeCity(pais)}`);
    if (!r) return { color: "#9aa5b1", weight: 0.4, opacity: 0.15, fillOpacity: 0 };
    const { stroke, fill } = colorsFor(r);
    return { color: stroke, weight: 2.5, opacity: 0.95, fillColor: fill, fillOpacity: 0.3 };
  };

  const bindRegion = (prefix: "dept" | "pais", prop: string) =>
    (feature: Feature<Geometry, GeoJsonProperties>, layer: Layer) => {
      const nombre = (feature.properties?.[prop] as string) ?? "";
      const r = regions.get(`${prefix}:${normalizeCity(nombre)}`);
      if (!r) return;
      layer.bindTooltip(tooltipHtml(r), { sticky: true, direction: "top" });
      layer.on("click", () => onSelectCity?.(toDTO(r)));
    };

  return (
    <MapContainer
      center={[4.5709, -74.2973]}
      zoom={5}
      style={{ height: "100%", width: "100%", background: "#e8eef2" }}
      zoomControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      {geoPaises && (
        <GeoJSON
          key={`paises-${sig}`}
          data={geoPaises}
          style={stylePais}
          onEachFeature={bindRegion("pais", "pais")}
        />
      )}

      {geoDepts && (
        <GeoJSON
          key={`depts-${sig}`}
          data={geoDepts}
          style={styleDept}
          onEachFeature={bindRegion("dept", "NOMBRE_DPT")}
        />
      )}

      {/* Fallback: regiones activas sin polígono conocido → punto */}
      {fallback.map((c) => (
        <CircleMarker
          key={c.nombre}
          center={[c.lat, c.lng]}
          radius={8}
          pathOptions={{ color: "#fff", weight: 1.5, fillColor: EXPORT, fillOpacity: 0.9 }}
          eventHandlers={{ click: () => onSelectCity?.(c) }}
        >
          <Tooltip direction="top">{c.nombre}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
