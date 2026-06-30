"use client";

// Este archivo solo se evalúa en el cliente (importado con dynamic + ssr:false).
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CiudadMapaDTO } from "@/app/api/mapa-ciudades/route";

const AMBER = "#F59E0B";
const EMERALD = "#14DBA0";
const SIZE = 20;
const R = SIZE / 2;

function splitIcon(): L.DivIcon {
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${R}" cy="${R}" r="${R}" fill="${AMBER}"/>
    <path d="M${R},${R} L${R},0 A${R},${R} 0 0,1 ${R},${SIZE} Z" fill="${EMERALD}"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [SIZE, SIZE],
    iconAnchor: [R, R],
    tooltipAnchor: [0, -R - 4],
  });
}

interface Props {
  ciudades: CiudadMapaDTO[];
}

export default function ColombiaMap({ ciudades }: Props) {
  return (
    <MapContainer
      center={[4.5709, -74.2973]}
      zoom={6}
      style={{ height: "100%", width: "100%", background: "#0d1117" }}
      zoomControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      {ciudades.map((ciudad) => {
        const pos: [number, number] = [ciudad.lat, ciudad.lng];
        const tooltip = (
          <Tooltip direction="top" offset={[0, -6]}>
            <div style={{ lineHeight: 1.5, minWidth: 160 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{ciudad.nombre}</div>
              <div>Recogidas: <strong>{ciudad.comoOrigen}</strong></div>
              <div>Entregas: <strong>{ciudad.comoDestino}</strong></div>
              <div>Total: <strong>{ciudad.total}</strong></div>
              {ciudad.transportadoras.length > 0 && (
                <div style={{ marginTop: 4, fontSize: "0.85em", color: "#aaa" }}>
                  {ciudad.transportadoras.join(" · ")}
                </div>
              )}
            </div>
          </Tooltip>
        );

        const soloOrigen = ciudad.comoOrigen > 0 && ciudad.comoDestino === 0;
        const soloDestino = ciudad.comoDestino > 0 && ciudad.comoOrigen === 0;

        if (soloOrigen) {
          return (
            <CircleMarker
              key={ciudad.nombre}
              center={pos}
              radius={9}
              pathOptions={{ color: AMBER, fillColor: AMBER, fillOpacity: 0.9, weight: 1.5 }}
            >
              {tooltip}
            </CircleMarker>
          );
        }

        if (soloDestino) {
          return (
            <CircleMarker
              key={ciudad.nombre}
              center={pos}
              radius={9}
              pathOptions={{ color: EMERALD, fillColor: EMERALD, fillOpacity: 0.9, weight: 1.5 }}
            >
              {tooltip}
            </CircleMarker>
          );
        }

        // Ambos roles → marcador bicolor
        return (
          <Marker key={ciudad.nombre} position={pos} icon={splitIcon()}>
            {tooltip}
          </Marker>
        );
      })}
    </MapContainer>
  );
}
