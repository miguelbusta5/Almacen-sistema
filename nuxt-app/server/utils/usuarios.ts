// Constantes y helpers del módulo Usuarios (servidor).
// Port de src/lib/roles.ts + los schemas de src/app/api/users/*.
import { z } from 'zod'

export const USER_ROLE_VALUES = [
  'ADMIN', 'GERENTE', 'OPERADOR', 'TRANSPORTISTA', 'INVENTARIO', 'TRANSPORTE',
  'SUPERVISOR_INVENTARIO', 'SUPERVISOR_TRANSPORTE', 'TIENDA', 'SUPERVISOR_TIENDA',
  'OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET', 'ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO',
] as const

export const roleSchema = z.enum(USER_ROLE_VALUES)

/**
 * Campos que se devuelven al cliente. NUNCA incluir `password`: es el hash bcrypt
 * y no debe salir del servidor bajo ninguna circunstancia. Cualquier `select` de
 * usuario en este módulo pasa por aquí.
 */
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
} as const

/** Coste del hash. El mismo que usa la app Next — cambiarlo invalidaría nada, pero
 *  encarece o abarata la verificación de TODAS las contraseñas nuevas. */
export const BCRYPT_ROUNDS = 12

export const createUserSchema = z.object({
  email: z.string().email('Email invalido'),
  name: z.string().min(2, 'Nombre muy corto'),
  password: z.string().min(8, 'Contrasena minimo 8 caracteres'),
  role: roleSchema.default('INVENTARIO'),
  transportistaId: z.string().nullable().optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, 'Contraseña mínimo 8 caracteres').optional(),
})

export const vehiculoSchema = z.object({
  placa: z.string().min(3, 'Placa requerida').max(20),
  tipo: z.string().min(2, 'Tipo requerido').max(20),
  capacidadKg: z.coerce.number().int().positive().nullable().optional(),
  estado: z.enum(['ACTIVO', 'MANTENIMIENTO', 'INACTIVO']).default('ACTIVO'),
})

export const transportistaCreateSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido').max(255),
  telefono: z.string().max(30).nullable().optional(),
  vehiculoId: z.string().nullable().optional(),
})

export const transportistaUpdateSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(2).max(255).optional(),
  telefono: z.string().max(30).nullable().optional(),
  vehiculoId: z.string().nullable().optional(),
  activo: z.boolean().optional(),
})
