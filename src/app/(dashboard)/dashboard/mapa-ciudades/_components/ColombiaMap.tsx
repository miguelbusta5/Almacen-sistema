"use client";

// Este archivo solo se evalúa en el cliente (importado con dynamic + ssr:false).
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CiudadMapaDTO } from "@/app/api/mapa-ciudades/route";

const AMBER = "#F59E0B";
const EMERALD = "#0E9C76";
const EXPORT = "#6366F1"; // índigo — exportaciones
const SIZE = 22;
const R = SIZE / 2;

function splitIcon(): L.DivIcon {
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${R}" cy="${R}" r="${R - 1}" fill="${AMBER}" stroke="#fff" stroke-width="1.5"/>
    <path d="M${R},${R} L${R},1 A${R - 1},${R - 1} 0 0,1 ${R},${SIZE - 1} Z" fill="${EMERALD}"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [SIZE, SIZE],
    iconAnchor: [R, R],
    tooltipAnchor: [0, -R - 4],
  });
}

// Radio escalado por volumen de procesos.
function radiusFor(total: number): number {
  return 7 + Math.min(9, Math.sqrt(total));
}

interface Props {
  ciudades: CiudadMapaDTO[];
  onSelectCity?: (ciudad: CiudadMapaDTO) => void;
}

export default function ColombiaMap({ ciudades, onSelectCity }: Props) {
  return (
    <MapContainer
      center={[4.5709, -74.2973]}
      zoom={6}
      style={{ height: "100%", width: "100%", background: "#e8eef2" }}
      zoomControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      {ciudades.map((ciudad) => {
        const pos: [number, number] = [ciudad.lat, ciudad.lng];
        const tooltip = (
          <Tooltip direction="top" offset={[0, -6]}>
            <div style={{ lineHeight: 1.5, minWidth: 150 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{ciudad.nombre}</div>
              <div>Recogidas: <strong>{ciudad.comoOrigen}</strong></div>
              <div>Entregas: <strong>{ciudad.comoDestino}</strong></div>
              {ciudad.comoExportacion > 0 && (
                <div>Exportaciones: <strong>{ciudad.comoExportacion}</strong></div>
              )}
              <div>Total: <strong>{ciudad.total}</strong></div>
              {ciudad.transportadoras.length > 0 && (
                <div style={{ marginTop: 4, fontSize: "0.85em", color: "#555" }}>
                  {ciudad.transportadoras.map((t) => t.nombre).join(" · ")}
                </div>
              )}
            </div>
          </Tooltip>
        );

        const esExportacion = ciudad.comoExportacion > 0;
        const soloOrigen = ciudad.comoOrigen > 0 && ciudad.comoDestino === 0;
        const soloDestino = ciudad.comoDestino > 0 && ciudad.comoOrigen === 0;
        const handlers = { click: () => onSelectCity?.(ciudad) };

        // Prioridad: si hay actividad de exportación, el nodo se pinta índigo.
        if (esExportacion) {
          return (
            <CircleMarker
              key={ciudad.nombre}
              center={pos}
              radius={radiusFor(ciudad.total)}
              pathOptions={{ color: "#fff", weight: 1.5, fillColor: EXPORT, fillOpacity: 0.9 }}
              eventHandlers={handlers}
            >
              {tooltip}
            </CircleMarker>
          );
        }

        if (soloOrigen || soloDestino) {
          const color = soloOrigen ? AMBER : EMERALD;
          return (
            <CircleMarker
              key={ciudad.nombre}
              center={pos}
              radius={radiusFor(ciudad.total)}
              pathOptions={{ color: "#fff", weight: 1.5, fillColor: color, fillOpacity: 0.9 }}
              eventHandlers={handlers}
            >
              {tooltip}
            </CircleMarker>
          );
        }

        // Ambos roles → marcador bicolor
        return (
          <Marker key={ciudad.nombre} position={pos} icon={splitIcon()} eventHandlers={handlers}>
            {tooltip}
          </Marker>
        );
      })}
    </MapContainer>
  );
}
