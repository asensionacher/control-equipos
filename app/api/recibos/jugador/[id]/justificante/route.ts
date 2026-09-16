import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";
import { formatearNumeroRecibo } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recibos/jugador/[id]/justificante
 *
 * Descarga el justificante de pago subido por un jugador para un ReciboJugador concreto.
 * Permisos:
 * - Admin: siempre puede descargar.
 * - Tutor o jugador propio: solo si el ReciboJugador pertenece a un jugador accesible.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const reciboJugadorId = id;

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

  if (!rj) {
    return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
  }
  if (!rj.justificanteKey) {
    return NextResponse.json({ error: "No hay justificante" }, { status: 404 });
  }

  const isAdmin = session.user.rol === "ADMIN";
  const esTutorOJugador =
    rj.jugador.usuarioId === session.user.id || rj.jugador.tutorias.length > 0;
  if (!isAdmin && !esTutorOJugador) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const buf = await getObjectBuffer(rj.justificanteKey);
    const filename =
      rj.justificanteNombre ||
      `justificante-${formatearNumeroRecibo(rj.numero)}.pdf`;

    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        "Content-Type": rj.justificanteMime || "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[justificante] Error leyendo S3:", err);
    return NextResponse.json({ error: "Error al leer el justificante" }, { status: 500 });
  }
}