"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/s3";
import { consentimientoSchema } from "@/lib/validaciones";
import {
  obtenerTextoConsentimiento,
  sanitizarContenidoConsentimiento,
} from "@/lib/consentimiento-contenido";
import {
  enviarNotificacionAJugadores,
  getAppUrl,
} from "@/lib/notificaciones-jugador";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true },
  });
  if (!usuario || usuario.rol !== "ADMIN") throw new Error("Sesión no válida");
  return session;
}

export async function crearConsentimiento(
  formData: FormData
): Promise<{ error?: string; success?: string; consentimientoId?: string }> {
  const session = await requireAdmin();
  const descripcion = sanitizarContenidoConsentimiento(
    String(formData.get("descripcion") ?? "")
  );
  if (obtenerTextoConsentimiento(descripcion).length < 10) {
    return { error: "La descripción debe tener al menos 10 caracteres" };
  }
  const parsed = consentimientoSchema.safeParse({
    titulo: formData.get("titulo"),
    descripcion,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const jugadores = await prisma.jugador.findMany({
    where: { activo: true },
    select: { id: true },
  });
  if (jugadores.length === 0) {
    return { error: "No hay jugadores activos a los que asignar el consentimiento" };
  }

  const consentimiento = await prisma.consentimiento.create({
    data: {
      titulo: parsed.data.titulo,
      descripcion,
      creadoPorId: session.user.id,
      jugadores: {
        create: jugadores.map(({ id }) => ({
          jugadorId: id,
          asignadoDirectamente: true,
        })),
      },
    },
  });

  await notificarConsentimiento(
    consentimiento.titulo,
    jugadores.map(({ id }) => id)
  );
  revalidatePath("/admin/consentimientos");
  revalidatePath("/dashboard/consentimientos");
  for (const jugador of jugadores) {
    revalidatePath(`/dashboard/jugadores/${jugador.id}`);
  }
  return {
    success: "Consentimiento creado y asignado a todos los jugadores",
    consentimientoId: consentimiento.id,
  };
}

export async function revocarConsentimiento(
  consentimientoJugadorId: string
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const asignacion = await prisma.consentimientoJugador.findUnique({
    where: { id: consentimientoJugadorId },
    include: {
      consentimiento: { select: { titulo: true } },
      jugador: { select: { id: true } },
    },
  });
  if (!asignacion) return { error: "Consentimiento no encontrado" };
  if (asignacion.estado !== "FIRMADO" || !asignacion.pdfKey) {
    return { error: "El consentimiento no está firmado" };
  }

  try {
    await deleteObject(asignacion.pdfKey);
  } catch (error) {
    console.error("[consentimiento] No se pudo eliminar el PDF al revocar:", error);
    return { error: "No se pudo eliminar el PDF firmado" };
  }

  await prisma.consentimientoJugador.update({
    where: { id: asignacion.id },
    data: {
      estado: "PENDIENTE",
      pdfKey: null,
      firmadoAt: null,
      firmadoPorId: null,
      firmadoPorNombre: null,
      firmadoPorEmail: null,
      firmadoPorEsTutor: null,
    },
  });

  await notificarConsentimiento(asignacion.consentimiento.titulo, [
    asignacion.jugador.id,
  ]);
  revalidatePath(`/admin/consentimientos/${asignacion.consentimientoId}`);
  revalidatePath("/admin/consentimientos");
  revalidatePath("/dashboard/consentimientos");
  revalidatePath(`/dashboard/jugadores/${asignacion.jugador.id}`);
  return { success: "Firma revocada; el consentimiento vuelve a estar pendiente" };
}

async function notificarConsentimiento(
  titulo: string,
  jugadoresIds: string[]
): Promise<void> {
  await enviarNotificacionAJugadores({
    jugadoresIds,
    crearNotificacion: (jugador) => ({
      titulo: `Consentimiento pendiente: ${titulo}`,
      detalle: `${jugador.nombre} ${jugador.apellidos} debe revisar y firmar este consentimiento.`,
      url: `${getAppUrl()}/dashboard/jugadores/${jugador.id}`,
    }),
  });
}
