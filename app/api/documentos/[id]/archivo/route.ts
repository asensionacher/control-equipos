import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const documento = await prisma.solicitudDocumentoJugador.findUnique({
    where: { id },
    include: {
      jugador: {
        include: {
          tutorias: { where: { usuarioId: session.user.id }, select: { id: true } },
        },
      },
    },
  });
  if (!documento) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (!documento.archivoKey) {
    return NextResponse.json({ error: "No hay ningún PDF subido" }, { status: 404 });
  }

  const autorizado =
    session.user.rol === "ADMIN" ||
    documento.jugador.usuarioId === session.user.id ||
    documento.jugador.tutorias.length > 0;
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const buffer = await getObjectBuffer(documento.archivoKey);
    const filename = (documento.archivoNombre ?? "documento.pdf").replace(/[\r\n"]/g, "");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[documento] Error leyendo el PDF:", error);
    return NextResponse.json({ error: "No se pudo leer el documento" }, { status: 500 });
  }
}
