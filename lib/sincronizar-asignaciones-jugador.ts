import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/s3";
import {
  enviarNotificacionAJugadores,
  getAppUrl,
} from "@/lib/notificaciones-jugador";
import { formatearNumeroRecibo } from "@/lib/utils";

export async function sincronizarAsignacionesJugador(
  jugadorId: string,
  equiposIds: string[] = [],
  opciones: {
    asignarRecibos?: boolean;
    asignarDocumentos?: boolean;
    asignarConsentimientos?: boolean;
    recibosIds?: number[];
    documentosIds?: string[];
  } = {}
): Promise<void> {
  const {
    asignarRecibos = true,
    asignarDocumentos = true,
    asignarConsentimientos = true,
    recibosIds,
    documentosIds,
  } = opciones;
  const [recibos, documentos, consentimientos] = await Promise.all([
    asignarRecibos && equiposIds.length > 0
      ? prisma.recibo.findMany({
          where: {
            ...(recibosIds ? { id: { in: recibosIds } } : {}),
            estado: { not: "ANULADO" },
            equipos: { some: { id: { in: equiposIds } } },
          },
          select: {
            id: true,
            concepto: true,
            total: true,
            pdfKey: true,
            equipos: {
              where: { id: { in: equiposIds } },
              select: { id: true },
            },
            jugadores: {
              where: { jugadorId },
              select: { id: true },
            },
          },
        })
      : [],
    asignarDocumentos && equiposIds.length > 0
      ? prisma.solicitudDocumento.findMany({
          where: {
            ...(documentosIds ? { id: { in: documentosIds } } : {}),
            equipos: { some: { id: { in: equiposIds } } },
          },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            equipos: {
              where: { id: { in: equiposIds } },
              select: { id: true },
            },
            jugadores: {
              where: { jugadorId },
              select: { id: true },
            },
          },
        })
      : [],
    asignarConsentimientos
      ? prisma.consentimiento.findMany({
          select: {
            id: true,
            titulo: true,
            jugadores: {
              where: { jugadorId },
              select: { id: true },
            },
          },
        })
      : [],
  ]);

  const recibosNuevos = recibos.filter(({ jugadores }) => jugadores.length === 0);
  const documentosNuevos = documentos.filter(({ jugadores }) => jugadores.length === 0);
  const consentimientosNuevos = consentimientos.filter(
    ({ jugadores }) => jugadores.length === 0
  );

  await prisma.$transaction(async (tx) => {
    for (const recibo of recibos) {
      await tx.reciboJugador.upsert({
        where: { reciboId_jugadorId: { reciboId: recibo.id, jugadorId } },
        create: {
          reciboId: recibo.id,
          jugadorId,
          asignadoDirectamente: false,
          equiposOrigen: { connect: recibo.equipos.map(({ id }) => ({ id })) },
        },
        update: {
          equiposOrigen: { connect: recibo.equipos.map(({ id }) => ({ id })) },
        },
      });
    }
    for (const documento of documentos) {
      await tx.solicitudDocumentoJugador.upsert({
        where: {
          solicitudId_jugadorId: {
            solicitudId: documento.id,
            jugadorId,
          },
        },
        create: {
          solicitudId: documento.id,
          jugadorId,
          asignadoDirectamente: false,
          equiposOrigen: { connect: documento.equipos.map(({ id }) => ({ id })) },
        },
        update: {
          equiposOrigen: { connect: documento.equipos.map(({ id }) => ({ id })) },
        },
      });
    }
    for (const consentimiento of consentimientosNuevos) {
      await tx.consentimientoJugador.create({
        data: {
          consentimientoId: consentimiento.id,
          jugadorId,
          asignadoDirectamente: true,
        },
      });
    }
  });

  for (const recibo of recibosNuevos) {
    if (recibo.pdfKey) {
      try {
        await deleteObject(recibo.pdfKey);
      } catch (error) {
        console.error("[recibo] No se pudo eliminar el PDF cacheado:", error);
      }
      await prisma.recibo.update({
        where: { id: recibo.id },
        data: { pdfKey: null },
      });
    }
  }

  const recibosIndividuales = await prisma.reciboJugador.findMany({
    where: {
      jugadorId,
      reciboId: { in: recibosNuevos.map(({ id }) => id) },
    },
    include: { recibo: { select: { concepto: true, total: true } } },
  });
  await Promise.all([
    ...recibosIndividuales.map((reciboJugador) =>
      enviarNotificacionAJugadores({
        jugadoresIds: [jugadorId],
        crearNotificacion: (jugador) => ({
          titulo: `Nuevo recibo ${formatearNumeroRecibo(reciboJugador.numero)}`,
          detalle: `${jugador.nombre} ${jugador.apellidos} · ${reciboJugador.recibo.concepto} · ${Number(
            reciboJugador.recibo.total
          ).toFixed(2)} €`,
          url: `${getAppUrl()}/dashboard/recibos/${reciboJugador.reciboId}?jugadorId=${jugadorId}`,
        }),
      })
    ),
    ...documentosNuevos.map((documento) =>
      enviarNotificacionAJugadores({
        jugadoresIds: [jugadorId],
        crearNotificacion: (jugador) => ({
          titulo: `Nuevo documento requerido: ${documento.nombre}`,
          detalle: `${jugador.nombre} ${jugador.apellidos}${
            documento.descripcion ? ` · ${documento.descripcion}` : ""
          }. Debe subirse en formato PDF.`,
          url: `${getAppUrl()}/dashboard/jugadores/${jugadorId}`,
        }),
      })
    ),
    ...consentimientosNuevos.map((consentimiento) =>
      enviarNotificacionAJugadores({
        jugadoresIds: [jugadorId],
        crearNotificacion: (jugador) => ({
          titulo: `Consentimiento pendiente: ${consentimiento.titulo}`,
          detalle: `${jugador.nombre} ${jugador.apellidos} debe revisar y firmar este consentimiento.`,
          url: `${getAppUrl()}/dashboard/jugadores/${jugadorId}`,
        }),
      })
    ),
  ]);
}
