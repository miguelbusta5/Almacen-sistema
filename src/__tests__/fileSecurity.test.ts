import { describe, expect, it } from "vitest";
import {
  getSafePhotoExtension,
  MAX_IMPORT_FILE_SIZE,
  validateImportFile,
  validateRowLimit,
} from "@/lib/fileSecurity";

function fakeFile(name: string, size: number): File {
  return { name, size } as File;
}

describe("file security guards", () => {
  it("acepta importaciones XLSX dentro del limite", () => {
    expect(validateImportFile(fakeFile("MAESTRO.xlsx", 1024))).toBeNull();
  });

  it("rechaza extensiones no permitidas", () => {
    expect(validateImportFile(fakeFile("payload.svg", 1024))).toContain("Solo se aceptan");
  });

  it("rechaza archivos demasiado grandes", () => {
    expect(validateImportFile(fakeFile("MAESTRO.xlsx", MAX_IMPORT_FILE_SIZE + 1))).toContain("Archivo demasiado grande");
  });

  it("valida limite de filas", () => {
    expect(validateRowLimit(10000)).toBeNull();
    expect(validateRowLimit(10001)).toContain("limite");
  });

  it("solo permite formatos fotograficos seguros", () => {
    expect(getSafePhotoExtension("image/jpeg")).toBe("jpg");
    expect(getSafePhotoExtension("image/png")).toBe("png");
    expect(getSafePhotoExtension("image/webp")).toBe("webp");
    expect(getSafePhotoExtension("image/svg+xml")).toBeNull();
  });
});
