"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { entrenadorSchema } from "@/lib/validaciones";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  return session;
}

export interface CrearEntrenadorParams {
  nombre: string;
  apellidos: string;
  email?: string | null;
  telefono?: string | null;
  telefonoAlternativo?: string | null;
  observaciones?: string | null;
  usuarioId?: string | null;
  jugadorId?: string | null;
  equiposIds?: string[];
}

export async function crearEntrenador(
  datos: CrearEntrenadorParams
): Promise<{ error?: string; success?: string; entrenadorId?: string }> {
  await requireAdmin();

  const parsed = entrenadorSchema.safeParse({
    nombre: datos.nombre,
    apellidos: datos.apellidos,
    email: datos.email ?? "",
    telefono: datos.telefono ?? "",
    telefonoAlternativo: datos.telefonoAlternativo ?? "",
    observaciones: datos.observaciones ?? "",
    usuarioId: datos.usuarioId ?? "",
    jugadorId: datos.jugadorId ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  // Evitar duplicar vinculaciones únicas
  if (data.usuarioId) {
    const enUso = await prisma.entrenador.findUnique({ where: { usuarioId: data.usuarioId } });
    if (enUso) {
      return {
        error: "Ese usuario ya está vinculado a otro entrenador",
      };
    }
  }
  if (data.jugadorId) {
    const enUso = await prisma.entrenador.findUnique({ where: { jugadorId: data.jugadorId } });
    if (enUso) {
      return {
        error: "Ese jugador ya está vinculado a otro entrenador",
      };
    }
  }

  const session = await auth();
  const entrenador = await prisma.entrenador.create({
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      email: data.email || null,
      telefono: data.telefono || null,
      telefonoAlternativo: data.telefonoAlternativo || null,
      observaciones: data.observaciones || null,
      usuarioId: data.usuarioId || null,
      jugadorId: data.jugadorId || null,
      creadoPorId: session!.user.id,
    },
  });

  const equiposIds = (datos.equiposIds ?? []).filter(Boolean);
  if (equiposIds.length > 0) {
    await prisma.entrenadorEquipo.createMany({
      data: equiposIds.map((equipoId) => ({
        entrenadorId: entrenador.id,
        equipoId,
        rol: "ENTRENADOR_PRINCIPAL",
      })),
    });
  }

  revalidatePath("/admin/entrenadores");
  revalidatePath("/admin/equipos");
  redirect(`/admin/entrenadores/${entrenador.id}`);
}

export interface EditarEntrenadorParams {
  nombre: string;
  apellidos: string;
  email?: string | null;
  telefono?: string | null;
  telefonoAlternativo?: string | null;
  observaciones?: string | null;
  usuarioId?: string | null;
  jugadorId?: string | null;
}

export async function editarEntrenador(
  id: string,
  datos: EditarEntrenadorParams
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  const parsed = entrenadorSchema.safeParse({
    nombre: datos.nombre,
    apellidos: datos.apellidos,
    email: datos.email ?? "",
    telefono: datos.telefono ?? "",
    telefonoAlternativo: datos.telefonoAlternativo ?? "",
    observaciones: datos.observaciones ?? "",
    usuarioId: datos.usuarioId ?? "",
    jugadorId: datos.jugadorId ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  if (data.usuarioId) {
    const enUso = await prisma.entrenador.findFirst({
      where: { usuarioId: data.usuarioId, NOT: { id } },
    });
    if (enUso) return { error: "Ese usuario ya está vinculado a otro entrenador" };
  }
  if (data.jugadorId) {
    const enUso = await prisma.entrenador.findFirst({
      where: { jugadorId: data.jugadorId, NOT: { id } },
    });
    if (enUso) return { error: "Ese jugador ya está vinculado a otro entrenador" };
  }

  await prisma.entrenador.update({
    where: { id },
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      email: data.email || null,
      telefono: data.telefono || null,
      telefonoAlternativo: data.telefonoAlternativo || null,
      observaciones: data.observaciones || null,
      usuarioId: data.usuarioId || null,
      jugadorId: data.jugadorId || null,
    },
  });

  revalidatePath("/admin/entrenadores");
  revalidatePath(`/admin/entrenadores/${id}`);
  revalidatePath("/admin/equipos");
  return { success: "Entrenador actualizado" };
}

export async function asignarEquiposEntrenador(
  entrenadorId: string,
  equiposIds: string[]
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const entrenador = await prisma.entrenador.findUnique({
    where: { id: entrenadorId },
    select: { id: true },
  });
  if (!entrenador) return { error: "Entrenador no encontrado" };

  const temporadas = await prisma.temporada.findMany({
    where: { activa: true },
    select: { id: true },
  });
  const temporadaActivaId = temporadas[0]?.id ?? null;

  const existentes = await prisma.entrenadorEquipo.findMany({
    where: { entrenadorId },
    select: { equipoId: true },
  });
  const existentesSet = new Set(existentes.map((e) => e.equipoId));
  const nuevosIds = equiposIds.filter(
    (equipoId) => equipoId && !existentesSet.has(equipoId)
  );

  if (nuevosIds.length > 0) {
    await prisma.entrenadorEquipo.createMany({
      data: nuevosIds.map((equipoId) => ({
        entrenadorId,
        equipoId,
        rol: "ENTRENADOR_PRINCIPAL",
        temporadaId: temporadaActivaId,
      })),
    });
  }
  revalidatePath(`/admin/entrenadores/${entrenadorId}`);
  revalidatePath("/admin/equipos");
  return { success: "Equipos actualizados" };
}

export async function quitarEquipoEntrenador(
  entrenadorId: string,
  asignacionId: string
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const asignacion = await prisma.entrenadorEquipo.findUnique({
    where: { id: asignacionId },
    select: { entrenadorId: true },
  });
  if (!asignacion || asignacion.entrenadorId !== entrenadorId) {
    return { error: "Asignación no encontrada" };
  }
  await prisma.entrenadorEquipo.delete({ where: { id: asignacionId } });
  revalidatePath(`/admin/entrenadores/${entrenadorId}`);
  revalidatePath("/admin/equipos");
  return { success: "Equipo desvinculado" };
}

export async function eliminarEntrenador(id: string) {
  await requireAdmin();
  await prisma.entrenador.update({
    where: { id },
    data: { activo: false },
  });
  revalidatePath("/admin/entrenadores");
  redirect("/admin/entrenadores");
}
