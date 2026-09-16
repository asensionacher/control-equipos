import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generarPdfRecibo } from "@/lib/pdf-recibo";
import { getConfiguracionClub } from "@/lib/club-utils";
import { formatearNumeroRecibo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/recibos/zip?estado=PENDIENTE&equipoId=xxx
 *
 * Devuelve un ZIP con los PDFs de los recibos que coincidan con los filtros
 * (todos por defecto). Solo accesible por administradores.
 *
 * Si un recibo no tiene el PDF cacheado en BD (campo pdfKey), se regenera al
 * vuelo; el ZIP nunca debería estar vacío si hay resultados.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const estado = req.nextUrl.searchParams.get("estado");
  const equipoId = req.nextUrl.searchParams.get("equipoId");

  const where: any = {};
  if (estado && ["PENDIENTE", "RECHAZADO", "PAGADO", "ANULADO"].includes(estado)) {
    where.jugadores = { some: { estado } };
  }
  if (equipoId) {
    where.OR = [{ equipoId }, { equipos: { some: { id: equipoId } } }];
  }

  const recibos = await prisma.recibo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      equipo: { include: { temporada: true } },
      equipos: { include: { temporada: true } },
      jugadores: {
        include: {
          jugador: {
            include: {
              tutorias: {
                include: {
                  usuario: {
                    select: { id: true, nombre: true, apellidos: true, email: true },
                  },
                },
              },
              usuario: {
                select: { id: true, nombre: true, apellidos: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  if (recibos.length === 0) {
    return NextResponse.json(
      { error: "No hay recibos que coincidan con los filtros" },
      { status: 404 }
    );
  }

  const club = await getConfiguracionClub();

  const zip = new JSZip();
  const filenames = new Set<string>();

  for (const r of recibos) {
    const recibosIndividuales = estado
      ? r.jugadores.filter((reciboJugador) => reciboJugador.estado === estado)
      : r.jugadores;
    for (const reciboJugador of recibosIndividuales) {
      const pdfBuffer = await generarPdfRecibo({
        recibo: r as any,
        club,
        jugadorObjetivo: reciboJugador.jugador as any,
        numeroRecibo: reciboJugador.numero,
      });
      const baseName = `recibo-${formatearNumeroRecibo(reciboJugador.numero).replace("#", "")}`;
      let filename = `${baseName}.pdf`;
      let i = 1;
      while (filenames.has(filename)) {
        filename = `${baseName}-${i}.pdf`;
        i++;
      }
      filenames.add(filename);
      zip.file(filename, pdfBuffer);
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const filtroLabel = estado ? estado.toLowerCase() : "todos";
  const filenameZip = `recibos-${filtroLabel}.zip`;

  return new NextResponse(zipBuffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filenameZip}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}