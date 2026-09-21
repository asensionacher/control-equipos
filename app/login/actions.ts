"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const primerFactorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function requiereSegundoFactor(
  email: string,
  password: string
): Promise<boolean> {
  const parsed = primerFactorSchema.safeParse({ email, password });
  if (!parsed.success) return false;

  const usuario = await prisma.usuario.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: {
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
    },
  });
  if (!usuario?.passwordHash || !usuario.totpEnabled || !usuario.totpSecret) {
    return false;
  }

  return bcrypt.compare(parsed.data.password, usuario.passwordHash);
}
