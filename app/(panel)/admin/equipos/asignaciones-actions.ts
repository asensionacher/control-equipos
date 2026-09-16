"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sincronizarAsignacionesJugador } from "@/lib/sincronizar-asignaciones-jugador";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
}

export interface ResumenHerenciaEquipo {
  recibos: Array<{ id: number; concepto: string; jugadoresPendientes: number }>;
  documentos: Array<{ id: string; nombre: string; jugadoresPendientes: number }>;
}

export interface SeleccionHerenciaEquipo {
  asignarRecibos: boolean;
  asignarDocumentos: boolean;
  recibosIds?: number[];
  documentosIds?: string[];
}

export async function obtenerAsignacionesHeredables(
  equipoId: string,
  jugadorIds: string[]
): Promise<ResumenHerenciaEquipo> {
  await requireAdmin();
  const ids = Array.from(new Set(jugadorIds.filter(Boolean)));
  if (!equipoId || ids.length === 0) return { recibos: [], documentos: [] };

  const [recibos, documentos] = await Promise.all([
    prisma.recibo.findMany({
      where: {
        estado: { not: "ANULADO" },
        equipos: { some: { id: equipoId } },
      },
      orderBy: { fechaEmision: "desc" },
      select: {
        id: true,
        concepto: true,
        jugadores: {
          where: { jugadorId: { in: ids } },
          select: { jugadorId: true },
        },
      },
    }),
    prisma.solicitudDocumento.findMany({
      where: { equipos: { some: { id: equipoId } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nombre: true,
        jugadores: {
          where: { jugadorId: { in: ids } },
          select: { jugadorId: true },
        },
      },
    }),
  ]);

  return {
    recibos: recibos
      .map((recibo) => ({
        id: recibo.id,
        concepto: recibo.concepto,
        jugadoresPendientes: ids.length - new Set(recibo.jugadores.map((j) => j.jugadorId)).size,
      }))
      .filter((recibo) => recibo.jugadoresPendientes > 0),
    documentos: documentos
      .map((documento) => ({
        id: documento.id,
        nombre: documento.nombre,
        jugadoresPendientes:
          ids.length - new Set(documento.jugadores.map((j) => j.jugadorId)).size,
      }))
      .filter((documento) => documento.jugadoresPendientes > 0),
  };
}

export async function toggleAsignacionEquipo(
  jugadorId: string,
  equipoId: string,
  asignar: boolean,
  herencia: SeleccionHerenciaEquipo = {
    asignarRecibos: true,
    asignarDocumentos: true,
  }
) {
  await requireAdmin();

  if (asignar) {
    await prisma.asignacionEquipo.upsert({
      where: { jugadorId_equipoId: { jugadorId, equipoId } },
      create: { jugadorId, equipoId },
      update: {},
    });
    await sincronizarAsignacionesJugador(jugadorId, [equipoId], herencia);
  } else {
    await prisma.asignacionEquipo.deleteMany({
      where: { jugadorId, equipoId },
    });
  }

  revalidatePath(`/admin/jugadores/${jugadorId}`);
}

export async function asignarJugadoresMasivo(
  equipoId: string,
  jugadorIds: string[],
  herencia: SeleccionHerenciaEquipo = {
    asignarRecibos: true,
    asignarDocumentos: true,
  }
) {
  await requireAdmin();

  if (!equipoId || jugadorIds.length === 0) return;

  const operaciones = jugadorIds.map((jugadorId) =>
    prisma.asignacionEquipo.upsert({
      where: { jugadorId_equipoId: { jugadorId, equipoId } },
      create: { jugadorId, equipoId },
      update: {},
    })
  );

  await Promise.all(operaciones);
  await Promise.all(
    jugadorIds.map((jugadorId) =>
      sincronizarAsignacionesJugador(jugadorId, [equipoId], herencia)
    )
  );

  revalidatePath(`/admin/equipos/${equipoId}`);
}

export async function desasignarJugadoresMasivo(equipoId: string, jugadorIds: string[]) {
  await requireAdmin();

  if (!equipoId || jugadorIds.length === 0) return;

  await prisma.asignacionEquipo.deleteMany({
    where: { equipoId, jugadorId: { in: jugadorIds } },
  });

  revalidatePath(`/admin/equipos/${equipoId}`);
}
