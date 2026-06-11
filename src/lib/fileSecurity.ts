export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10000;

const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedPhotoMime = keyof typeof PHOTO_TYPES;

export function validateImportFile(file: File, options?: {
  allowedExtensions?: string[];
  maxSize?: number;
}): string | null {
  const allowedExtensions = options?.allowedExtensions ?? [".xlsx"];
  const maxSize = options?.maxSize ?? MAX_IMPORT_FILE_SIZE;
  const name = file.name.toLowerCase();

  if (!allowedExtensions.some((ext) => name.endsWith(ext))) {
    return `Solo se aceptan archivos ${allowedExtensions.join(", ")}`;
  }
  if (file.size > maxSize) {
    return `Archivo demasiado grande. Maximo ${Math.round(maxSize / 1024 / 1024)} MB`;
  }
  return null;
}

export function validateRowLimit(count: number, maxRows = MAX_IMPORT_ROWS): string | null {
  if (count > maxRows) return `El archivo supera el limite de ${maxRows} filas`;
  return null;
}

export function getSafePhotoExtension(mime: string): string | null {
  return PHOTO_TYPES[mime as AllowedPhotoMime] ?? null;
}
