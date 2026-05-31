import { describe, expect, it } from "vitest";
import { haversineKm, nearestNeighbor, canOptimize, navUrl } from "@/lib/logistica";
import type { Parada } from "@/lib/logistica";

describe("haversineKm()", () => {
  it("misma ubicación → 0 km", () => {
    expect(haversineKm(4.711, -74.072, 4.711, -74.072)).toBe(0);
  });

  it("Bogotá → Medellín ≈ 220 km", () => {
    const dist = haversineKm(4.711, -74.072, 6.244, -75.574);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(250);
  });

  it("Bogotá → Cali ≈ 290 km", () => {
    const dist = haversineKm(4.711, -74.072, 3.451, -76.532);
    expect(dist).toBeGreaterThan(260);
    expect(dist).toBeLessThan(320);
  });
});

describe("nearestNeighbor()", () => {
  function stop(lat: number, lng: number, id: string) {
    return { id, lat, lng } as Pick<Parada, "id" | "lat" | "lng">;
  }

  it("1 parada → devuelve igual", () => {
    const s = [stop(4.7, -74.1, "a")];
    expect(nearestNeighbor(s)).toEqual(s);
  });

  it("sin coordenadas → devuelve sin cambios", () => {
    const s = [
      { id: "a", lat: null, lng: null },
      { id: "b", lat: 4.8, lng: -74.1 },
    ];
    expect(nearestNeighbor(s)).toEqual(s);
  });

  it("3 puntos en línea → optimiza al vecino más cercano", () => {
    // A(0,0) → C(0,2) → B(0,10): orden óptimo A→C→B
    const a = stop(0, 0, "a");
    const b = stop(0, 10, "b");
    const c = stop(0, 2, "c");
    const result = nearestNeighbor([a, b, c]);
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("c");
    expect(result[2].id).toBe("b");
  });

  it("respeta el punto inicial", () => {
    const a = stop(4.711, -74.072, "bogota");
    const b = stop(6.244, -75.574, "medellin");
    const c = stop(4.812, -74.015, "cerca");
    const result = nearestNeighbor([a, b, c]);
    // Empieza en 'a', el más cercano es 'cerca', luego Medellín
    expect(result[0].id).toBe("bogota");
    expect(result[1].id).toBe("cerca");
    expect(result[2].id).toBe("medellin");
  });
});

describe("canOptimize()", () => {
  it("menos de 2 paradas → false", () => {
    expect(canOptimize([{ lat: 4.7, lng: -74.1 }])).toBe(false);
  });

  it("alguna sin coordenadas → false", () => {
    expect(canOptimize([{ lat: 4.7, lng: -74.1 }, { lat: null, lng: null }])).toBe(false);
  });

  it("todas con coordenadas → true", () => {
    expect(canOptimize([{ lat: 4.7, lng: -74.1 }, { lat: 4.8, lng: -74.2 }])).toBe(true);
  });
});

describe("navUrl()", () => {
  it("con coordenadas → link de ruta Google Maps", () => {
    const p = { lat: 4.711, lng: -74.072, direccion: "Calle 1" } as Pick<Parada, "lat" | "lng" | "direccion">;
    expect(navUrl(p)).toContain("maps/dir");
    expect(navUrl(p)).toContain("4.711");
  });

  it("sin coordenadas → link de búsqueda", () => {
    const p = { lat: null, lng: null, direccion: "Calle 1 # 2-3" } as Pick<Parada, "lat" | "lng" | "direccion">;
    const url = navUrl(p);
    expect(url).toContain("maps/search");
    expect(url).toContain(encodeURIComponent("Calle 1 # 2-3"));
  });
});
