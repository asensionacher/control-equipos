"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    nombre: z.string().min(2),
    apellidos: z.string().min(2),
    email: z.string().email(),
    telefono: z.string().optional(),
    password: z.string().min(8),
    confirmarPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export async function crearAdmin(formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") {
    return { error: "No autorizado" };
  }

  const parsed = schema.safeParse({
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    email: (formData.get("email") as string)?.toLowerCase(),
    telefono: formData.get("telefono") || undefined,
    password: formData.get("password"),
    confirmarPassword: formData.get("confirmarPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existe = await prisma.usuario.findUnique({ where: { email: parsed.data.email } });
  if (existe) return { error: "Ya existe un usuario con ese email" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.usuario.create({
    data: {
      nombre: parsed.data.nombre,
      apellidos: parsed.data.apellidos,
      email: parsed.data.email,
      telefono: parsed.data.telefono || null,
      passwordHash,
      rol: "ADMIN",
      emailVerificado: true,
    },
  });

  redirect("/admin/usuarios");
}
