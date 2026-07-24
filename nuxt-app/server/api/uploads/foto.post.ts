import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { put } from '@vercel/blob'
import { requireAuth } from '../../utils/auth'
import { getSafePhotoExtension } from '../../utils/fileSecurity'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// POST /api/uploads/foto — port de src/app/api/uploads/foto/route.ts.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'foto')
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Sin archivo' })

  const ext = getSafePhotoExtension(file.type ?? '')
  if (!ext) throw createError({ statusCode: 400, statusMessage: 'Solo se aceptan imagenes JPG, PNG o WebP' })
  if (file.data.length > MAX_SIZE) throw createError({ statusCode: 400, statusMessage: 'Maximo 5 MB por foto' })

  const filename = `uploads/${Date.now()}-${actor.id.slice(-6)}.${ext}`
  const blob = await put(filename, file.data, { access: 'public' })
  return { success: true, url: blob.url }
})
