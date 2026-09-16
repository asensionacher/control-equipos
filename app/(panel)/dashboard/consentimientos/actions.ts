"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generarPdfConsentimiento } from "@/lib/pdf-consentimiento";
import { consentimientoPdfKey, deleteObject, putObject } from "@/lib/s3";

const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024;

export async function firmarConsentimiento(
  consentimientoJugadorId: string,
  firmaDataUrl: string
): Promise<{ error?: string; success?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };
  if (!firmaDataUrl.startsWith("data:image/png;base64,")) {
    return { error: "La firma no tiene un formato válido" };
  }

  let firmaPng: Buffer;
  try {
    firmaPng = Buffer.from(firmaDataUrl.slice("data:image/png;base64,".length), "base64");
  } catch {
    return { error: "No se pudo leer la firma" };
  }
  if (
    firmaPng.length === 0 ||
    firmaPng.length > MAX_SIGNATURE_SIZE ||
    firmaPng.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  ) {
    return { error: "La firma no es una imagen PNG válida" };
  }

  const [asignacion, firmante] = await Promise.all([
    prisma.consentimientoJugador.findUnique({
      where: { id: consentimientoJugadorId },
      include: {
        consentimiento: true,
        jugador: {
          include: {
            tutorias: { where: { usuarioId: session.user.id }, select: { id: true } },
          },
        },
      },
    }),
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, nombre: true, apellidos: true, email: true },
    }),
  ]);
  if (!asignacion || !firmante) return { error: "Consentimiento no encontrado" };
  const autorizado =
    asignacion.jugador.usuarioId === session.user.id ||
    asignacion.jugador.tutorias.length > 0;
  if (!autorizado) return { error: "No autorizado" };
  if (asignacion.estado === "FIRMADO") return { error: "El consentimiento ya está firmado" };

  const firmadoAt = new Date();
  const firmadoPorNombre = `${firmante.nombre} ${firmante.apellidos}`;
  let pdf: Buffer;
  try {
    pdf = await generarPdfConsentimiento({
      titulo: asignacion.consentimiento.titulo,
      descripcion: asignacion.consentimiento.descripcion,
      jugador: {
        nombre: asignacion.jugador.nombre,
        apellidos: asignacion.jugador.apellidos,
        dniNie: asignacion.jugador.dniNie,
      },
      firmante: {
        nombre: firmadoPorNombre,
        email: firmante.email,
        esTutor:
          asignacion.jugador.usuarioId !== session.user.id &&
          asignacion.jugador.tutorias.length > 0,
      },
      firmadoAt,
      firmaPng,
    });
  } catch (error) {
    console.error("[consentimiento] Error generando PDF:", error);
    return { error: "No se pudo generar el PDF firmado" };
  }

  const key = consentimientoPdfKey(asignacion.id);
  try {
    await putObject(key, pdf, "application/pdf");
    const result = await prisma.consentimientoJugador.updateMany({
      where: { id: asignacion.id, estado: "PENDIENTE" },
      data: {
        estado: "FIRMADO",
        pdfKey: key,
        firmadoAt,
        firmadoPorId: firmante.id,
        firmadoPorNombre,
        firmadoPorEmail: firmante.email,
        firmadoPorEsTutor:
          asignacion.jugador.usuarioId !== session.user.id &&
          asignacion.jugador.tutorias.length > 0,
      },
    });
    if (result.count !== 1) {
      await deleteObject(key);
      return { error: "El consentimiento ya había sido firmado" };
    }
  } catch (error) {
    try {
      await deleteObject(key);
    } catch {
      // Se conserva el error original.
    }
    console.error("[consentimiento] Error guardando PDF firmado:", error);
    return { error: "No se pudo guardar el consentimiento firmado" };
  }

  revalidatePath("/dashboard/consentimientos");
  revalidatePath(`/dashboard/jugadores/${asignacion.jugadorId}`);
  revalidatePath(`/admin/consentimientos/${asignacion.consentimientoId}`);
  revalidatePath("/admin/consentimientos");
  return { success: "Consentimiento firmado correctamente" };
}
