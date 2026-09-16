"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject, documentoJugadorKey, putObject } from "@/lib/s3";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function subirDocumento(
  solicitudJugadorId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo PDF" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "El archivo es demasiado grande (máx. 10 MB)" };
  }
  if (file.type !== "application/pdf") {
    return { error: "Solo se permiten archivos PDF" };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return { error: "El archivo seleccionado no es un PDF válido" };
  }

  const [documento, gestor] = await Promise.all([
    prisma.solicitudDocumentoJugador.findUnique({
      where: { id: solicitudJugadorId },
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
  if (!documento || !gestor) return { error: "Solicitud no encontrada" };
  const autorizado =
    documento.jugador.usuarioId === session.user.id ||
    documento.jugador.tutorias.length > 0;
  if (!autorizado) return { error: "No autorizado" };
  if (documento.estado === "VALIDADO") {
    return { error: "El documento ya ha sido validado" };
  }

  if (documento.archivoKey) {
    try {
      await deleteObject(documento.archivoKey);
    } catch (error) {
      console.error("[documento] No se pudo eliminar el PDF anterior:", error);
      return { error: "No se pudo sustituir el documento anterior" };
    }
  }

  const key = documentoJugadorKey(documento.id, file.name);
  try {
    await putObject(key, buffer, "application/pdf");
    await prisma.solicitudDocumentoJugador.update({
      where: { id: documento.id },
      data: {
        estado: "SUBIDO",
        archivoKey: key,
        archivoNombre: file.name,
        archivoMime: "application/pdf",
        archivoSubidoAt: new Date(),
        archivoSubidoPorNombre: `${gestor.nombre} ${gestor.apellidos}`,
        archivoSubidoPorEmail: gestor.email,
        archivoSubidoPorEsTutor:
          documento.jugador.usuarioId !== session.user.id &&
          documento.jugador.tutorias.length > 0,
        validadoAt: null,
        rechazadoAt: null,
        ultimoMotivoRechazo: null,
      },
    });
  } catch (error) {
    try {
      await deleteObject(key);
    } catch {
      // El error original se registra y se devuelve al usuario.
    }
    console.error("[documento] Error guardando el PDF:", error);
    return { error: "No se pudo guardar el documento" };
  }

  revalidatePath("/dashboard/documentos");
  revalidatePath(`/dashboard/jugadores/${documento.jugadorId}`);
  revalidatePath(`/admin/documentos/${documento.solicitudId}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Documento subido y pendiente de revisión" };
}
