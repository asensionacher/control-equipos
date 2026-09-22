import "server-only";
import type { Prisma, Usuario } from "@prisma/client";
import { prisma } from "./prisma";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const AUTH_SECRET_PLACEHOLDER =
  "cambia-esto-por-una-clave-segura-de-al-menos-32-caracteres";
export const DUMMY_PASSWORD_HASH =
  "$2a$10$Mw3LqYK4sjwFAv9Yo6hN8.j8/Ljt9vlrNQuz2LZcecHW0N5hbEFp2";

export function assertSecureAuthSecret(): void {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32 || secret === AUTH_SECRET_PLACEHOLDER) {
    throw new Error(
      "AUTH_SECRET debe ser una clave aleatoria de al menos 32 caracteres y no puede usar el valor de ejemplo."
    );
  }
}

export function estaBloqueado(
  usuario: Pick<Usuario, "authLockedUntil">
): boolean {
  return !!usuario.authLockedUntil && usuario.authLockedUntil > new Date();
}

export async function registrarFalloAutenticacion(usuarioId: string): Promise<void> {
  const usuario = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { authFailedAttempts: { increment: 1 } },
    select: { authFailedAttempts: true },
  });

  if (usuario.authFailedAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          authFailedAttempts: 0,
          authLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
        },
      }),
      prisma.auditoriaSeguridad.create({
        data: {
          accion: "CUENTA_BLOQUEADA_INTENTOS",
          usuarioAfectadoId: usuarioId,
          detalle: { minutos: LOCK_MINUTES },
        },
      }),
    ]);
  }
}

export async function limpiarFallosAutenticacion(usuarioId: string): Promise<void> {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { authFailedAttempts: 0, authLockedUntil: null },
  });
}

export async function registrarAuditoriaSeguridad(params: {
  accion: string;
  ejecutadoPorId?: string | null;
  usuarioAfectadoId?: string | null;
  detalle?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditoriaSeguridad.create({
    data: {
      accion: params.accion,
      ejecutadoPorId: params.ejecutadoPorId ?? null,
      usuarioAfectadoId: params.usuarioAfectadoId ?? null,
      detalle: params.detalle,
    },
  });
}
