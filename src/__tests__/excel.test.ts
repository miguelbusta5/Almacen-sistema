import { describe, expect, it } from "vitest";
import { parseCsvRows } from "@/lib/excel";

describe("excel helpers", () => {
  it("parsea CSV con comillas y comas internas", () => {
    expect(parseCsvRows('PLU,DESCRIPCION\n123,"Silla, comedor"\n')).toEqual([
      ["PLU", "DESCRIPCION"],
      ["123", "Silla, comedor"],
    ]);
  });

  it("ignora filas vacias", () => {
    expect(parseCsvRows("PLU,DESCRIPCION\n\nABC,Producto\n")).toEqual([
      ["PLU", "DESCRIPCION"],
      ["ABC", "Producto"],
    ]);
  });
});
