import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Augmentación de tipos: la sesión/usuario/JWT llevan `id` y `role`.
declare module "next-auth" {
  interface User {
    role?: string;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: { id?: string; role?: string; mustChangePassword?: boolean } & DefaultSession["user"];
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    mustChangePassword?: boolean;
  }
}

// Bloqueo por fuerza bruta: 5 intentos fallidos → 15 minutos de espera. Sin
// esto, una contraseña de 8 caracteres (el mínimo que exige la app) se puede
// probar sin límite contra el endpoint de login.
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

// Hash bcrypt válido de una cadena arbitraria, solo para igualar tiempos.
// No corresponde a ninguna contraseña utilizable.
const HASH_SENUELO = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7dO0bqBqyLwLrHqDGqZ0yBqXqXqXqXq";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!rawEmail || !password) return null;
        const email = rawEmail.toLowerCase().trim();

        const user = await prisma.user.findUnique({ where: { email } });

        // Se compara contra un hash señuelo cuando el correo no existe para que
        // el endpoint tarde lo mismo en ambos casos. Sin esto, la diferencia de
        // tiempo (bcrypt vs. respuesta inmediata) delata qué correos son de
        // usuarios reales, que es el primer paso de un ataque dirigido.
        if (!user || !user.active) {
          await bcrypt.compare(password, HASH_SENUELO);
          return null;
        }

        // Cuenta bloqueada: no se evalúa la contraseña. El mensaje que ve el
        // usuario es el mismo genérico de credenciales inválidas — decir "cuenta
        // bloqueada" confirmaría que el correo existe.
        if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) return null;

        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
          const intentos = user.intentosFallidos + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              intentosFallidos: intentos,
              ...(intentos >= MAX_INTENTOS && {
                bloqueadoHasta: new Date(Date.now() + BLOQUEO_MINUTOS * 60_000),
              }),
            },
          }).catch(() => {});
          return null;
        }

        // Login correcto: se limpia el contador para que los fallos sueltos de
        // un usuario legítimo no se acumulen hasta bloquearlo semanas después.
        if (user.intentosFallidos > 0 || user.bloqueadoHasta) {
          await prisma.user
            .update({ where: { id: user.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
            .catch(() => {});
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        if (token.id) session.user.id = token.id;
        session.user.mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  // 12 h cubre el turno mas largo (incluido el de noche) con margen: con 8 h la
  // sesion vencia a media jornada y la pantalla solo decia "No autorizado".
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
});