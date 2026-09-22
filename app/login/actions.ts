"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  assertSecureAuthSecret,
  DUMMY_PASSWORD_HASH,
  estaBloqueado,
  registrarFalloAutenticacion,
} from "@/lib/auth-security";

const primerFactorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function prepararLogin(
  email: string,
  password: string
): Promise<{
  valid: boolean;
  requiresTwoFactor: boolean;
  redirectTo: string;
}> {
  assertSecureAuthSecret();
  const parsed = primerFactorSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { valid: false, requiresTwoFactor: false, redirectTo: "/" };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: {
      id: true,
      rol: true,
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      authLockedUntil: true,
    },
  });
  if (!usuario?.passwordHash) {
    await bcrypt.compare(parsed.data.password, DUMMY_PASSWORD_HASH);
    return { valid: false, requiresTwoFactor: false, redirectTo: "/" };
  }
  if (estaBloqueado(usuario)) {
    return { valid: false, requiresTwoFactor: false, redirectTo: "/" };
  }

  const passwordValido = await bcrypt.compare(
    parsed.data.password,
    usuario.passwordHash
  );
  if (!passwordValido) {
    await registrarFalloAutenticacion(usuario.id);
    return { valid: false, requiresTwoFactor: false, redirectTo: "/" };
  }

  return {
    valid: true,
    requiresTwoFactor: usuario.totpEnabled && !!usuario.totpSecret,
    redirectTo: usuario.rol === "ADMIN" ? "/admin" : "/dashboard",
  };
}
