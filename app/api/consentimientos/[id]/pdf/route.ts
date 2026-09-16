import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";

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
  const asignacion = await prisma.consentimientoJugador.findUnique({
    where: { id },
    include: {
      consentimiento: { select: { titulo: true } },
      jugador: {
        include: {
          tutorias: { where: { usuarioId: session.user.id }, select: { id: true } },
        },
      },
    },
  });
  if (!asignacion) {
    return NextResponse.json({ error: "Consentimiento no encontrado" }, { status: 404 });
  }
  if (!asignacion.pdfKey) {
    return NextResponse.json({ error: "El consentimiento no está firmado" }, { status: 404 });
  }
  const autorizado =
    session.user.rol === "ADMIN" ||
    asignacion.jugador.usuarioId === session.user.id ||
    asignacion.jugador.tutorias.length > 0;
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const buffer = await getObjectBuffer(asignacion.pdfKey);
    const filename = `consentimiento-${slug(asignacion.consentimiento.titulo)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[consentimiento] Error leyendo PDF firmado:", error);
    return NextResponse.json({ error: "No se pudo leer el PDF" }, { status: 500 });
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
