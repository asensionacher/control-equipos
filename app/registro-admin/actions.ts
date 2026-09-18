"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registroSchema = z.object({
  nombre: z.string().min(2),
  apellidos: z.string().min(2),
  email: z.string().email().toLowerCase(),
  telefono: z.string().optional(),
  telefonoAlternativo: z.string().optional(),
  password: z.string().min(8),
});

export async function registrarPrimerAdmin(formData: FormData) {
  const totalAdmins = await prisma.usuario.count({ where: { rol: "ADMIN" } });
  if (totalAdmins > 0) {
    return { error: "Ya existe un administrador registrado" };
  }

  const parsed = registroSchema.safeParse({
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    email: formData.get("email"),
    telefono: formData.get("telefono") || undefined,
    telefonoAlternativo: formData.get("telefonoAlternativo") || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Datos inválidos. Revisa los campos." };
  }

  const existe = await prisma.usuario.findUnique({ where: { email: parsed.data.email } });
  if (existe) {
    return { error: "Ya existe un usuario con ese email" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.usuario.create({
    data: {
      nombre: parsed.data.nombre,
      apellidos: parsed.data.apellidos,
      email: parsed.data.email,
      telefono: parsed.data.telefono,
      telefonoAlternativo: parsed.data.telefonoAlternativo,
      passwordHash,
      rol: "ADMIN",
      emailVerificado: true,
    },
  });

  redirect("/login?registered=1");
}
