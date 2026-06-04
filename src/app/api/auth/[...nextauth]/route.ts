import { handlers } from "@/lib/auth";

// Vercel: ampliar timeout para cold start + bcrypt en el endpoint de autenticación
export const maxDuration = 30;

export const { GET, POST } = handlers;