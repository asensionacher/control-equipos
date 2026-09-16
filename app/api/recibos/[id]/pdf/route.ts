import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generarPdfRecibo } from "@/lib/pdf-recibo";
import { getConfiguracionClub } from "@/lib/club-utils";
import { reciboPdfKey, putObject } from "@/lib/s3";
import { formatearNumeroRecibo } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recibos/[id]/pdf?jugadorId=xxx
 *
 * - Admin: puede descargar cualquier recibo. Si no se pasa jugadorId,
 *   se genera un PDF resumen con todos los jugadores asignados.
 * - Jugador / tutor: solo puede descargar recibos asignados a jugadores
 *   sobre los que tiene permiso (su propia ficha o un jugador tutorizado).
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const reciboId = parseInt(id, 10);
  if (!Number.isFinite(reciboId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const jugadorId = req.nextUrl.searchParams.get("jugadorId");

  const recibo = await prisma.recibo.findUnique({
    where: { id: reciboId },
    include: {
      equipo: { include: { temporada: true } },
      equipos: { include: { temporada: true } },
      jugadores: {
        include: {
          equiposOrigen: { include: { temporada: true } },
          jugador: {
            include: {
              tutorias: { include: { usuario: { select: { id: true, nombre: true, apellidos: true, email: true } } } },
              usuario: { select: { id: true, nombre: true, apellidos: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!recibo) {
    return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
  }

  // Comprobación de permisos
  const isAdmin = session.user.rol === "ADMIN";
  let jugadorObjetivo: typeof recibo.jugadores[number]["jugador"] | null = null;

  if (isAdmin) {
    if (jugadorId) {
      jugadorObjetivo =
        recibo.jugadores.find((rj) => rj.jugadorId === jugadorId)?.jugador ?? null;
      if (!jugadorObjetivo) {
        return NextResponse.json(
          { error: "El jugador indicado no está asignado a este recibo" },
          { status: 400 }
        );
      }
    }
  } else {
    // USUARIO: verificar que el jugador objetivo (o el primer asignado, si no se indica)
    // es su propia ficha o un jugador tutorizado por él.
    const misJugadoresIds = await getJugadoresAccesibles(session.user.id);

    const targetId = jugadorId ?? recibo.jugadores[0]?.jugadorId;
    if (!targetId || !misJugadoresIds.has(targetId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    jugadorObjetivo =
      recibo.jugadores.find((rj) => rj.jugadorId === targetId)?.jugador ?? null;
  }

  // Generar PDF
  const club = await getConfiguracionClub();
  const pdfBuffer = await generarPdfRecibo({
    recibo,
    club,
    jugadorObjetivo: jugadorObjetivo ?? undefined,
    numeroRecibo: jugadorObjetivo
      ? recibo.jugadores.find((rj) => rj.jugadorId === jugadorObjetivo.id)?.numero
      : undefined,
  });

  // Subir a S3 para cache (solo si no hay jugadorObjetivo, i.e. PDF admin)
  // Para PDFs personalizados por jugador, regeneramos cada vez
  let pdfKey: string | null = null;
  if (!jugadorObjetivo && recibo.pdfKey) {
    pdfKey = recibo.pdfKey;
  } else if (!jugadorObjetivo) {
    pdfKey = reciboPdfKey(recibo.id);
    try {
      await putObject(pdfKey, pdfBuffer, "application/pdf");
      await prisma.recibo.update({ where: { id: recibo.id }, data: { pdfKey } });
    } catch (err) {
      console.error("[recibo] Error subiendo PDF a S3:", err);
    }
  }

  // Stream
  const reciboJugadorObjetivo = jugadorObjetivo
    ? recibo.jugadores.find((rj) => rj.jugadorId === jugadorObjetivo.id)
    : null;
  const filename = reciboJugadorObjetivo
    ? `recibo-${formatearNumeroRecibo(reciboJugadorObjetivo.numero).replace("#", "")}-${slug(
        jugadorObjetivo!.nombre
      )}-${slug(jugadorObjetivo!.apellidos)}.pdf`
    : `resumen-emision-${recibo.id}.pdf`;

  return new NextResponse(pdfBuffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function getJugadoresAccesibles(usuarioId: string): Promise<Set<string>> {
  // Jugadores donde el usuario es tutor (cualquier tutoría) o donde es el propio jugador
  const rows = await prisma.jugador.findMany({
    where: {
      OR: [
        { tutorias: { some: { usuarioId } } },
        { usuarioId },
      ],
    },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}