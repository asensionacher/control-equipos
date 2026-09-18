import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { descifrarSecret, verificarTotp } from "./totp";
import type { Rol } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: Rol;
      nombre: string;
      apellidos: string;
      twoFactorStatus: "none" | "complete";
    } & DefaultSession["user"];
  }
}

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
  totp: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          rol: Rol;
          nombre: string;
          apellidos: string;
          twoFactorStatus?: "none" | "complete";
        };
        token.id = u.id;
        token.rol = u.rol;
        token.nombre = u.nombre;
        token.apellidos = u.apellidos;
        token.twoFactorStatus = u.twoFactorStatus ?? "complete";
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as Rol;
        session.user.nombre = token.nombre as string;
        session.user.apellidos = token.apellidos as string;
        session.user.twoFactorStatus =
          (token.twoFactorStatus as "none" | "complete" | undefined) ?? "complete";
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
        totp: { label: "Código de verificación", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, totp } = parsed.data;
        const usuario = await prisma.usuario.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!usuario || !usuario.passwordHash) return null;

        const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
        if (!passwordValido) return null;

        const baseUser = {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          apellidos: usuario.apellidos,
          rol: usuario.rol,
          twoFactorStatus: "complete" as const,
        };

        if (usuario.totpEnabled && usuario.totpSecret) {
          if (!totp) {
            throw new Error("REQUIRES_2FA");
          }
          const secret = descifrarSecret(usuario.totpSecret);
          if (!verificarTotp(secret, totp)) return null;
          return baseUser;
        }

        return baseUser;
      },
    }),
  ],
});
