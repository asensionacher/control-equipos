const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

interface ImagenValidada {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}

export async function validarImagenSubida(file: File): Promise<ImagenValidada> {
  if (file.size === 0) throw new Error("Selecciona una imagen");
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("La imagen no puede superar los 5 MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { buffer, contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
  ) {
    return { buffer, contentType: "image/png", extension: "png" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { buffer, contentType: "image/webp", extension: "webp" };
  }
  throw new Error("La imagen debe estar en formato JPG, PNG o WebP");
}

export function contentTypeImagenDesdeKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function obtenerKeyFotoS3(fotoUrl: string | null): string | null {
  return fotoUrl?.startsWith("s3:") ? fotoUrl.slice(3) : null;
}

export function obtenerFotoJugadorSrc(
  jugador: { id: string; fotoUrl: string | null }
): string | null {
  if (!jugador.fotoUrl) return null;
  return jugador.fotoUrl.startsWith("s3:")
    ? `/api/jugadores/${jugador.id}/foto`
    : jugador.fotoUrl;
}
