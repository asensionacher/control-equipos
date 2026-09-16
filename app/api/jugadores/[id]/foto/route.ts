import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";
import {
  contentTypeImagenDesdeKey,
  obtenerKeyFotoS3,
} from "@/lib/imagen-upload";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const jugador = await prisma.jugador.findUnique({
    where: { id },
    select: {
      fotoUrl: true,
      usuarioId: true,
      tutorias: {
        where: { usuarioId: session.user.id },
        select: { id: true },
      },
    },
  });
  if (!jugador) {
    return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
  }

  const autorizado =
    session.user.rol === "ADMIN" ||
    jugador.usuarioId === session.user.id ||
    jugador.tutorias.length > 0;
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const key = obtenerKeyFotoS3(jugador.fotoUrl);
  if (!key) {
    return NextResponse.json({ error: "El jugador no tiene una foto subida" }, { status: 404 });
  }

  try {
    const buffer = await getObjectBuffer(key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeImagenDesdeKey(key),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[jugador] Error leyendo la foto:", error);
    return NextResponse.json({ error: "No se pudo leer la foto" }, { status: 500 });
  }
}
