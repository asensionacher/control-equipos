import { prisma } from "@/lib/prisma";
import {
  obtenerKeyFotoS3,
  validarImagenSubida,
} from "@/lib/imagen-upload";
import { deleteObject, fotoJugadorKey, putObject } from "@/lib/s3";

export async function validarFotoFormulario(formData?: FormData): Promise<string | null> {
  const foto = formData?.get("foto");
  if (!(foto instanceof File) || foto.size === 0) return null;
  try {
    await validarImagenSubida(foto);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "La foto no es válida";
  }
}

export async function actualizarFotoJugador(
  jugadorId: string,
  formData?: FormData
): Promise<string | null> {
  if (!formData) return null;
  const foto = formData.get("foto");
  const eliminarFoto = formData.get("eliminarFoto") === "on";
  if ((!(foto instanceof File) || foto.size === 0) && !eliminarFoto) return null;

  const jugador = await prisma.jugador.findUnique({
    where: { id: jugadorId },
    select: { fotoUrl: true },
  });
  if (!jugador) return "Jugador no encontrado";

  const anteriorKey = obtenerKeyFotoS3(jugador.fotoUrl);
  let nuevaKey: string | null = null;

  if (foto instanceof File && foto.size > 0) {
    try {
      const imagen = await validarImagenSubida(foto);
      nuevaKey = fotoJugadorKey(jugadorId, imagen.extension);
      await putObject(nuevaKey, imagen.buffer, imagen.contentType);
    } catch (error) {
      return error instanceof Error ? error.message : "No se pudo subir la foto";
    }
  }

  try {
    await prisma.jugador.update({
      where: { id: jugadorId },
      data: { fotoUrl: nuevaKey ? `s3:${nuevaKey}` : null },
    });
  } catch (error) {
    if (nuevaKey) await deleteObject(nuevaKey).catch(() => undefined);
    console.error("[jugador] No se pudo guardar la foto:", error);
    return "No se pudo guardar la foto";
  }

  if (anteriorKey && anteriorKey !== nuevaKey) {
    await deleteObject(anteriorKey).catch((error) => {
      console.error("[jugador] No se pudo eliminar la foto anterior:", error);
    });
  }
  return null;
}
