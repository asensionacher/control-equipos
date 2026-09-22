import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import {
  cifrarSecret,
  descifrarSecret,
  esSecretTotpLegacy,
  verificarTotp,
} from "./totp";
import {
  assertSecureAuthSecret,
  DUMMY_PASSWORD_HASH,
  estaBloqueado,
  limpiarFallosAutenticacion,
  registrarFalloAutenticacion,
} from "./auth-security";
import type { Rol } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: Rol;
      nombre: string;
      apellidos: string;
      authVersion: number;
      twoFactorStatus: "none" | "setup_required" | "complete";
      mfaVerifiedAt?: number;
    } & DefaultSession["user"];
  }
}

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
  totp: z.string().optional(),
});

function requiresTwoFactorError(): CredentialsSignin {
  const error = new CredentialsSignin();
  error.code = "requires_2fa";
  return error;
}

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
        totp: { label: "Código de verificación", type: "text" },
      },
      async authorize(credentials) {
        assertSecureAuthSecret();
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, totp } = parsed.data;
        const usuario = await prisma.usuario.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!usuario || !usuario.passwordHash) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          return null;
        }
        if (estaBloqueado(usuario)) return null;
        if (usuario.totpEnabled && !usuario.totpSecret) return null;

        const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
        if (!passwordValido) {
          await registrarFalloAutenticacion(usuario.id);
          return null;
        }

        const baseUser = {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          apellidos: usuario.apellidos,
          rol: usuario.rol,
          authVersion: usuario.authVersion,
        };

        if (usuario.totpEnabled && usuario.totpSecret) {
          if (!totp) {
            throw requiresTwoFactorError();
          }
          const secret = descifrarSecret(usuario.totpSecret);
          const verification = verificarTotp(
            secret,
            totp,
            usuario.lastAcceptedTotpStep
          );
          if (!verification.valid || verification.timeStep == null) {
            await registrarFalloAutenticacion(usuario.id);
            return null;
          }
          const consumed = await prisma.usuario.updateMany({
            where: {
              id: usuario.id,
              authVersion: usuario.authVersion,
              OR: [
                { lastAcceptedTotpStep: null },
                { lastAcceptedTotpStep: { lt: verification.timeStep } },
              ],
            },
            data: {
              lastAcceptedTotpStep: verification.timeStep,
              ...(esSecretTotpLegacy(usuario.totpSecret)
                ? { totpSecret: cifrarSecret(secret) }
                : {}),
            },
          });
          if (consumed.count !== 1) return null;
          await limpiarFallosAutenticacion(usuario.id);
          return {
            ...baseUser,
            twoFactorStatus: "complete" as const,
            mfaVerifiedAt: Date.now(),
          };
        }

        await limpiarFallosAutenticacion(usuario.id);
        return {
          ...baseUser,
          twoFactorStatus:
            usuario.rol === "ADMIN"
              ? ("setup_required" as const)
              : ("none" as const),
        };
      },
    }),
  ],
});

export const { handlers, signIn, signOut } = nextAuth;
const rawAuth = nextAuth.auth;

async function getCurrentSession(allowAdminMfaSetup: boolean) {
  assertSecureAuthSecret();
  const session = await rawAuth();
  if (!session?.user?.id) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      rol: true,
      authVersion: true,
      totpEnabled: true,
    },
  });
  if (
    !usuario ||
    usuario.rol !== session.user.rol ||
    usuario.authVersion !== session.user.authVersion
  ) {
    return null;
  }

  if (
    usuario.totpEnabled &&
    session.user.twoFactorStatus !== "complete"
  ) {
    return null;
  }
  if (
    usuario.rol === "ADMIN" &&
    !usuario.totpEnabled &&
    !allowAdminMfaSetup
  ) {
    return null;
  }

  return session;
}

export function auth() {
  return getCurrentSession(false);
}

export function authForMfaSetup() {
  return getCurrentSession(true);
}
