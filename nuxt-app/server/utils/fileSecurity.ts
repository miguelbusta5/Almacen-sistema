// Port de src/lib/fileSecurity.ts (solo la parte usada por el upload de fotos).
const PHOTO_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export type AllowedPhotoMime = keyof typeof PHOTO_TYPES

export function getSafePhotoExtension(mime: string): string | null {
  return PHOTO_TYPES[mime as AllowedPhotoMime] ?? null
}
