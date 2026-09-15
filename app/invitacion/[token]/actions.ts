"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const registroConInvitacionSchema = z.object({
  nombre: z.string().min(2),
  apellidos: z.string().min(2),
  telefono: z.string().optional(),
  password: z.string().min(8),
});

export async function aceptarInvitacionRegistro(
  token: string,
  formData: FormData
): Promise<{ error?: string }> {
  const invitacion = await prisma.invitacion.findUnique({
    where: { token },
    include: { jugador: true },
  });

  if (!invitacion || invitacion.usada || invitacion.expirada || invitacion.expiresAt < new Date()) {
    return { error: "La invitación no es válida o ha caducado" };
  }

  const parsed = registroConInvitacionSchema.safeParse({
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    telefono: formData.get("telefono") || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Datos inválidos" };

  const password = formData.get("password") as string;
  const confirmar = formData.get("confirmarPassword") as string;
  if (password !== confirmar) return { error: "Las contraseñas no coinciden" };

  const email = invitacion.emailDestino.toLowerCase();
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    return { error: "Ya existe una cuenta con ese email. Inicia sesión y vincula desde tu panel." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const nuevoUsuario = await prisma.usuario.create({
    data: {
      email,
      nombre: parsed.data.nombre,
      apellidos: parsed.data.apellidos,
      telefono: parsed.data.telefono,
      passwordHash,
      rol: "USUARIO",
      emailVerificado: true,
    },
  });

  await prisma.tutoria.create({
    data: {
      jugadorId: invitacion.jugadorId,
      usuarioId: nuevoUsuario.id,
      parentesco: null,
      esPrincipal: true,
    },
  });

  await prisma.invitacion.update({
    where: { id: invitacion.id },
    data: { usada: true, fechaUso: new Date(), usuarioAceptaId: nuevoUsuario.id },
  });

  redirect("/login?registered=1");
}

export async function aceptarInvitacionVinculacion(token: string): Promise<{ error?: string; success?: boolean }> {
  const invitacion = await prisma.invitacion.findUnique({
    where: { token },
  });

  if (!invitacion || invitacion.usada || invitacion.expirada || invitacion.expiresAt < new Date()) {
    return { error: "La invitación no es válida o ha caducado" };
  }

  const email = invitacion.emailDestino.toLowerCase();
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario) {
    return { error: "No tienes cuenta todavía. Regístrate primero usando el formulario." };
  }

  // Verificar si ya existe la tutoría
  const existente = await prisma.tutoria.findUnique({
    where: { jugadorId_usuarioId: { jugadorId: invitacion.jugadorId, usuarioId: usuario.id } },
  });

  if (!existente) {
    await prisma.tutoria.create({
      data: {
        jugadorId: invitacion.jugadorId,
        usuarioId: usuario.id,
        parentesco: null,
        esPrincipal: true,
      },
    });
  }

  await prisma.invitacion.update({
    where: { id: invitacion.id },
    data: { usada: true, fechaUso: new Date(), usuarioAceptaId: usuario.id },
  });

  return { success: true };
}
