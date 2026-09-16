"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { putObject, deleteObject, justificanteKey } from "@/lib/s3";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

async function getMisJugadoresIds(): Promise<Set<string>> {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  const rows = await prisma.jugador.findMany({
    where: {
      OR: [
        { tutorias: { some: { usuarioId: session.user.id } } },
        { usuarioId: session.user.id },
      ],
    },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Sube un justificante de pago para un ReciboJugador concreto.
 * El usuario debe tener permiso sobre el jugador (tutor o jugador propio).
 */
export async function subirJustificante(
  reciboJugadorId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const file = formData.get("archivo");
  if (!file || !(file instanceof File)) {
    return { error: "Selecciona un archivo" };
  }
  if (file.size === 0) return { error: "El archivo está vacío" };
  if (file.size > MAX_FILE_SIZE) {
    return { error: "El archivo es demasiado grande (máx. 10 MB)" };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: "Tipo de archivo no permitido (solo PDF o imágenes)" };
  }

  const [rj, gestor] = await Promise.all([
    prisma.reciboJugador.findUnique({
      where: { id: reciboJugadorId },
      include: {
        jugador: {
          include: {
            tutorias: { where: { usuarioId: session.user.id }, select: { id: true } },
          },
        },
      },
    }),
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { nombre: true, apellidos: true, email: true },
    }),
  ]);

  if (!rj || !gestor) return { error: "Recibo no encontrado" };
  if (rj.estado === "ANULADO") return { error: "El recibo está anulado" };
  if (rj.estado === "PAGADO") {
    return { error: "El pago ya está confirmado" };
  }

  const esPropio = rj.jugador.usuarioId === session.user.id;
  const esTutor = rj.jugador.tutorias.length > 0;
  if (!esPropio && !esTutor) return { error: "No autorizado" };

  // Eliminar justificante anterior si existe
  if (rj.justificanteKey) {
    try {
      await deleteObject(rj.justificanteKey);
    } catch (err) {
      console.error("[justificante] Error eliminando justificante anterior:", err);
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const key = justificanteKey(rj.id, file.name);

  await putObject(key, buffer, file.type || "application/pdf");

  await prisma.reciboJugador.update({
    where: { id: rj.id },
    data: {
      estado: "PENDIENTE",
      justificanteKey: key,
      justificanteNombre: file.name,
      justificanteMime: file.type || "application/pdf",
      justificanteSubidoAt: new Date(),
      justificanteSubidoPorNombre: `${gestor.nombre} ${gestor.apellidos}`,
      justificanteSubidoPorEmail: gestor.email,
      justificanteSubidoPorEsTutor: !esPropio && esTutor,
      pagoRechazadoAt: null,
      ultimoMotivoRechazoPago: null,
    },
  });

  revalidatePath(`/dashboard/recibos/${rj.reciboId}`);
  revalidatePath(`/dashboard/jugadores/${rj.jugadorId}`);
  revalidatePath(`/admin/recibos/${rj.reciboId}`);
  revalidatePath("/admin/pendientes");
  return { success: "Justificante subido correctamente" };
}

/**
 * Elimina el justificante subido por el jugador/tutor.
 */
export async function eliminarJustificante(reciboJugadorId: string): Promise<{ error?: string; success?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const rj = await prisma.reciboJugador.findUnique({
    where: { id: reciboJugadorId },
    include: {
      jugador: {
        include: {
          tutorias: { where: { usuarioId: session.user.id }, select: { id: true } },
        },
      },
    },
  });
  if (!rj) return { error: "Recibo no encontrado" };
  const esPropio = rj.jugador.usuarioId === session.user.id;
  const esTutor = rj.jugador.tutorias.length > 0;
  if (!esPropio && !esTutor) return { error: "No autorizado" };
  if (!rj.justificanteKey) return { error: "No hay justificante" };
  if (rj.estado === "ANULADO") return { error: "El recibo está anulado" };
  if (rj.estado === "PAGADO") {
    return { error: "No se puede eliminar el justificante de un recibo confirmado" };
  }

  try {
    await deleteObject(rj.justificanteKey);
  } catch (err) {
    console.error("[justificante] Error eliminando:", err);
  }

  await prisma.reciboJugador.update({
    where: { id: rj.id },
    data: {
      justificanteKey: null,
      justificanteNombre: null,
      justificanteMime: null,
      justificanteSubidoAt: null,
      justificanteSubidoPorNombre: null,
      justificanteSubidoPorEmail: null,
      justificanteSubidoPorEsTutor: null,
    },
  });

  revalidatePath(`/dashboard/recibos/${rj.reciboId}`);
  revalidatePath(`/dashboard/jugadores/${rj.jugadorId}`);
  revalidatePath("/admin/pendientes");
  return { success: "Justificante eliminado" };
}

export async function marcarPagoParaConfirmar(
  reciboJugadorId: string
): Promise<{ error?: string; success?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const [rj, gestor] = await Promise.all([
    prisma.reciboJugador.findUnique({
      where: { id: reciboJugadorId },
      include: {
        jugador: {
          include: {
            tutorias: { where: { usuarioId: session.user.id }, select: { id: true } },
          },
        },
      },
    }),
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { nombre: true, apellidos: true, email: true },
    }),
  ]);
  if (!rj || !gestor) return { error: "Recibo no encontrado" };

  const esPropio = rj.jugador.usuarioId === session.user.id;
  const esTutor = rj.jugador.tutorias.length > 0;
  if (!esPropio && !esTutor) return { error: "No autorizado" };
  if (rj.estado !== "PENDIENTE" && rj.estado !== "RECHAZADO") {
    return { error: "Este recibo ya no está pendiente de pago" };
  }
  if (rj.pagoDeclaradoAt) {
    return { error: "El pago ya está pendiente de confirmación" };
  }

  await prisma.reciboJugador.update({
    where: { id: rj.id },
    data: {
      estado: "PENDIENTE",
      pagoDeclaradoAt: new Date(),
      pagoDeclaradoPorNombre: `${gestor.nombre} ${gestor.apellidos}`,
      pagoDeclaradoPorEmail: gestor.email,
      pagoDeclaradoPorEsTutor: !esPropio && esTutor,
      pagoRechazadoAt: null,
      ultimoMotivoRechazoPago: null,
    },
  });

  revalidatePath(`/dashboard/recibos/${rj.reciboId}`);
  revalidatePath(`/dashboard/jugadores/${rj.jugadorId}`);
  revalidatePath(`/admin/recibos/${rj.reciboId}`);
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Pago marcado como pendiente de confirmación" };
}

/**
 * Helper: lista los jugadores accesibles al usuario actual.
 */
export async function getMisJugadoresAccesibles(): Promise<string[]> {
  const ids = await getMisJugadoresIds();
  return Array.from(ids);
}