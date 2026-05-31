"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { UbicacionActiva } from "@/lib/logistica";

// Ícono circular sin depender de imágenes externas
function circleIcon(color: string) {
  return L.divIcon({
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.45)"></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function FitBounds({ posiciones }: { posiciones: UbicacionActiva[] }) {
  const map = useMap();
  useEffect(() => {
    if (posiciones.length === 0) return;
    const bounds = L.latLngBounds(posiciones.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [map, posiciones]);
  return null;
}

function tiempoRelativo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

interface Props {
  posiciones: UbicacionActiva[];
  height?: number;
}

export default function MapaRutas({ posiciones, height = 380 }: Props) {
  const center: [number, number] = posiciones.length > 0
    ? [posiciones[0].lat, posiciones[0].lng]
    : [4.711, -74.0721]; // Bogotá por defecto

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height, width: "100%", borderRadius: 12, zIndex: 1 }}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {posiciones.length > 0 && <FitBounds posiciones={posiciones} />}
      {posiciones.map((p) => (
        <Marker
          key={p.transportistaId}
          position={[p.lat, p.lng]}
          icon={circleIcon("#3b82f6")}
        >
          <Popup>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <strong>{p.nombre}</strong><br />
              {p.rutaNombre && <span style={{ color: "#64748b" }}>{p.rutaNombre}<br /></span>}
              <span style={{ color: "#94a3b8", fontSize: 11 }}>{tiempoRelativo(p.registradoAt)}</span>
            </div>
          </Popup>
        </Marker>
      ))}
      {posiciones.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1000 }}>
          <div style={{ background: "#0f172a99", color: "#e2e8f0", padding: "0.5rem 1rem", borderRadius: 8, fontSize: 13 }}>
            Sin posiciones GPS activas
          </div>
        </div>
      )}
    </MapContainer>
  );
}
