"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { temporadaSchema } from "@/lib/validaciones";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return session;
}

export async function crearTemporada(formData: FormData) {
  await requireAdmin();

  const raw = {
    nombre: formData.get("nombre"),
    fechaInicio: formData.get("fechaInicio"),
    fechaFin: formData.get("fechaFin"),
    activa: formData.get("activa") === "on",
  };

  const parsed = temporadaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existe = await prisma.temporada.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existe) return { error: "Ya existe una temporada con ese nombre" };

  if (parsed.data.activa) {
    await prisma.temporada.updateMany({ where: { activa: true }, data: { activa: false } });
  }

  await prisma.temporada.create({
    data: {
      nombre: parsed.data.nombre,
      fechaInicio: new Date(parsed.data.fechaInicio),
      fechaFin: new Date(parsed.data.fechaFin),
      activa: parsed.data.activa,
    },
  });

  revalidatePath("/admin/temporadas");
  redirect("/admin/temporadas");
}

export async function editarTemporada(id: string, formData: FormData) {
  await requireAdmin();

  const raw = {
    nombre: formData.get("nombre"),
    fechaInicio: formData.get("fechaInicio"),
    fechaFin: formData.get("fechaFin"),
    activa: formData.get("activa") === "on",
  };

  const parsed = temporadaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existe = await prisma.temporada.findFirst({
    where: { nombre: parsed.data.nombre, NOT: { id } },
  });
  if (existe) return { error: "Ya existe otra temporada con ese nombre" };

  if (parsed.data.activa) {
    await prisma.temporada.updateMany({ where: { activa: true, NOT: { id } }, data: { activa: false } });
  }

  await prisma.temporada.update({
    where: { id },
    data: {
      nombre: parsed.data.nombre,
      fechaInicio: new Date(parsed.data.fechaInicio),
      fechaFin: new Date(parsed.data.fechaFin),
      activa: parsed.data.activa,
    },
  });

  revalidatePath("/admin/temporadas");
  redirect("/admin/temporadas");
}

export async function eliminarTemporada(id: string) {
  await requireAdmin();
  await prisma.temporada.delete({ where: { id } });
  revalidatePath("/admin/temporadas");
}
