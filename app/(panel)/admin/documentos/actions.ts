"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/s3";
import {
  enviarNotificacionAJugadores,
  getAppUrl,
} from "@/lib/notificaciones-jugador";
import {
  rechazoDocumentoSchema,
  solicitudDocumentoSchema,
} from "@/lib/validaciones";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true },
  });
  if (!usuario || usuario.rol !== "ADMIN") throw new Error("Sesión no válida");
  return session;
}

export async function crearSolicitudDocumento(
  formData: FormData
): Promise<{ error?: string; success?: string; solicitudId?: string }> {
  const session = await requireAdmin();
  const parsed = solicitudDocumentoSchema.safeParse({
    nombre: formData.get("nombre"),
    descripcion: formData.get("descripcion") || "",
    modoAsignacion: formData.get("modoAsignacion"),
    equiposIds: formData.getAll("equiposIds").map(String).filter(Boolean),
    jugadoresIds: formData.getAll("jugadoresIds").map(String).filter(Boolean),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;
  let equiposIds: string[] = [];
  if (data.modoAsignacion === "equipo") {
    const equipos = await prisma.equipo.findMany({
      where: { id: { in: data.equiposIds }, activo: true },
      select: { id: true },
    });
    equiposIds = equipos.map(({ id }) => id);
    if (equiposIds.length !== new Set(data.equiposIds).size) {
      return { error: "Alguno de los equipos seleccionados no existe o no está activo" };
    }
  }
  const jugadores = await prisma.jugador.findMany({
    where:
      data.modoAsignacion === "equipo"
        ? { activo: true, asignaciones: { some: { equipoId: { in: equiposIds } } } }
        : { activo: true, id: { in: data.jugadoresIds } },
    select: {
      id: true,
      asignaciones: {
        where: { equipoId: { in: equiposIds } },
        select: { equipoId: true },
      },
    },
  });
  const jugadoresIds = jugadores.map(({ id }) => id);
  if (jugadoresIds.length === 0) {
    return { error: "No hay jugadores activos a los que solicitar el documento" };
  }

  const solicitud = await prisma.solicitudDocumento.create({
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion || null,
      equipos: {
        connect:
          data.modoAsignacion === "equipo"
            ? equiposIds.map((id) => ({ id }))
            : [],
      },
      creadoPorId: session.user.id,
      jugadores: {
        create: jugadores.map((jugador) => ({
          jugadorId: jugador.id,
          asignadoDirectamente: data.modoAsignacion === "jugadores",
          equiposOrigen: {
            connect: jugador.asignaciones.map(({ equipoId }) => ({ id: equipoId })),
          },
        })),
      },
    },
  });

  await enviarNotificacionAJugadores({
    jugadoresIds,
    crearNotificacion: (jugador) => ({
      titulo: `Nuevo documento requerido: ${solicitud.nombre}`,
      detalle: `${jugador.nombre} ${jugador.apellidos}${
        solicitud.descripcion ? ` · ${solicitud.descripcion}` : ""
      }. Debe subirse en formato PDF.`,
      url: `${getAppUrl()}/dashboard/jugadores/${jugador.id}`,
    }),
  });

  revalidatePath("/admin/documentos");
  revalidatePath("/dashboard/documentos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return {
    success: "Solicitud de documento creada correctamente",
    solicitudId: solicitud.id,
  };
}

export async function actualizarAsignacionesDocumento(
  solicitudId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const equiposIdsSolicitados = Array.from(
    new Set(formData.getAll("equiposIds").map(String).filter(Boolean))
  );
  const jugadoresDirectosIds = Array.from(
    new Set(formData.getAll("jugadoresIds").map(String).filter(Boolean))
  );
  const completarEquiposIds = Array.from(
    new Set(formData.getAll("completarEquiposIds").map(String).filter(Boolean))
  );
  const solicitud = await prisma.solicitudDocumento.findUnique({
    where: { id: solicitudId },
    include: {
      equipos: { select: { id: true } },
      jugadores: {
        include: {
          equiposOrigen: { select: { id: true } },
          jugador: { include: { asignaciones: { select: { equipoId: true } } } },
        },
      },
    },
  });
  if (!solicitud) return { error: "Solicitud no encontrada" };

  const equiposActualesIds = new Set([
    ...(solicitud.equipoId ? [solicitud.equipoId] : []),
    ...solicitud.equipos.map(({ id }) => id),
  ]);
  const equiposNuevosIds = equiposIdsSolicitados.filter(
    (id) => !equiposActualesIds.has(id)
  );
  const equiposParaExpandirIds = Array.from(
    new Set([
      ...equiposNuevosIds,
      ...completarEquiposIds.filter((id) => equiposIdsSolicitados.includes(id)),
    ])
  );
  const [equipos, jugadoresDirectos, asignacionesNuevas] = await Promise.all([
    prisma.equipo.findMany({
      where: { id: { in: equiposIdsSolicitados }, activo: true },
      select: { id: true },
    }),
    prisma.jugador.findMany({
      where: { id: { in: jugadoresDirectosIds }, activo: true },
      select: { id: true },
    }),
    prisma.asignacionEquipo.findMany({
      where: { equipoId: { in: equiposParaExpandirIds }, jugador: { activo: true } },
      select: { equipoId: true, jugadorId: true },
    }),
  ]);
  if (equipos.length !== equiposIdsSolicitados.length) {
    return { error: "Alguno de los equipos seleccionados no existe o no está activo" };
  }
  if (jugadoresDirectos.length !== jugadoresDirectosIds.length) {
    return { error: "Alguno de los jugadores seleccionados no existe o no está activo" };
  }

  const equiposPorJugador = new Map<string, Set<string>>();
  solicitud.jugadores.forEach((asignacion) => {
    const origenes =
      asignacion.equiposOrigen.length > 0
        ? asignacion.equiposOrigen.map(({ id }) => id)
        : !asignacion.asignadoDirectamente
          ? asignacion.jugador.asignaciones
            .map(({ equipoId }) => equipoId)
            .filter((equipoId) => equiposActualesIds.has(equipoId))
          : [];
    origenes
      .filter((equipoId) => equiposIdsSolicitados.includes(equipoId))
      .forEach((equipoId) => {
        const ids = equiposPorJugador.get(asignacion.jugadorId) ?? new Set<string>();
        ids.add(equipoId);
        equiposPorJugador.set(asignacion.jugadorId, ids);
      });
  });
  asignacionesNuevas.forEach(({ jugadorId, equipoId }) => {
    const ids = equiposPorJugador.get(jugadorId) ?? new Set<string>();
    ids.add(equipoId);
    equiposPorJugador.set(jugadorId, ids);
  });
  const jugadoresDeseados = new Set([
    ...jugadoresDirectosIds,
    ...equiposPorJugador.keys(),
  ]);
  if (jugadoresDeseados.size === 0) {
    return { error: "La solicitud debe conservar al menos un jugador asignado" };
  }

  const existentes = new Map(
    solicitud.jugadores.map((asignacion) => [asignacion.jugadorId, asignacion])
  );
  const nuevosIds = Array.from(jugadoresDeseados).filter((id) => !existentes.has(id));
  const eliminados = solicitud.jugadores.filter(
    (asignacion) => !jugadoresDeseados.has(asignacion.jugadorId)
  );
  for (const asignacion of eliminados) {
    if (asignacion.archivoKey) {
      try {
        await deleteObject(asignacion.archivoKey);
      } catch (error) {
        console.error("[documento] No se pudo eliminar el PDF al desasignar:", error);
        return { error: "No se pudo eliminar un PDF de la asignación retirada" };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.solicitudDocumento.update({
      where: { id: solicitudId },
      data: {
        equipoId: null,
        equipos: { set: equipos.map(({ id }) => ({ id })) },
      },
    });
    if (eliminados.length > 0) {
      await tx.solicitudDocumentoJugador.deleteMany({
        where: { id: { in: eliminados.map(({ id }) => id) } },
      });
    }
    for (const jugadorId of jugadoresDeseados) {
      const equiposOrigen = Array.from(equiposPorJugador.get(jugadorId) ?? []);
      const existente = existentes.get(jugadorId);
      if (existente) {
        await tx.solicitudDocumentoJugador.update({
          where: { id: existente.id },
          data: {
            asignadoDirectamente: jugadoresDirectosIds.includes(jugadorId),
            equiposOrigen: { set: equiposOrigen.map((id) => ({ id })) },
          },
        });
      } else {
        await tx.solicitudDocumentoJugador.create({
          data: {
            solicitudId,
            jugadorId,
            asignadoDirectamente: jugadoresDirectosIds.includes(jugadorId),
            equiposOrigen: { connect: equiposOrigen.map((id) => ({ id })) },
          },
        });
      }
    }
  });

  if (nuevosIds.length > 0) {
    await enviarNotificacionAJugadores({
      jugadoresIds: nuevosIds,
      crearNotificacion: (jugador) => ({
        titulo: `Nuevo documento requerido: ${solicitud.nombre}`,
        detalle: `${jugador.nombre} ${jugador.apellidos}. Debe subirse en formato PDF.`,
        url: `${getAppUrl()}/dashboard/jugadores/${jugador.id}`,
      }),
    });
  }
  revalidatePath(`/admin/documentos/${solicitudId}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/dashboard/documentos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Asignaciones actualizadas" };
}

export async function validarDocumentos(
  solicitudId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const documentosIds = Array.from(
    new Set(formData.getAll("documentosIds").map(String).filter(Boolean))
  );
  if (documentosIds.length === 0) return { error: "Selecciona al menos un documento" };

  const documentos = await prisma.solicitudDocumentoJugador.findMany({
    where: {
      id: { in: documentosIds },
      solicitudId,
      estado: "SUBIDO",
      archivoKey: { not: null },
    },
    select: { id: true },
  });
  if (documentos.length !== documentosIds.length) {
    return { error: "Solo se pueden marcar como recibidos documentos subidos" };
  }
  await prisma.solicitudDocumentoJugador.updateMany({
    where: { id: { in: documentosIds }, solicitudId },
    data: {
      estado: "VALIDADO",
      validadoAt: new Date(),
      rechazadoAt: null,
      ultimoMotivoRechazo: null,
    },
  });
  revalidatePath(`/admin/documentos/${solicitudId}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/dashboard/documentos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: `${documentos.length} documentos marcados como recibidos` };
}

export async function desasignarJugadorDocumento(
  documentoJugadorId: string
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const asignacion = await prisma.solicitudDocumentoJugador.findUnique({
    where: { id: documentoJugadorId },
  });
  if (!asignacion) return { error: "Asignación no encontrada" };
  const total = await prisma.solicitudDocumentoJugador.count({
    where: { solicitudId: asignacion.solicitudId },
  });
  if (total <= 1) return { error: "La solicitud debe conservar al menos un jugador" };

  if (asignacion.archivoKey) {
    try {
      await deleteObject(asignacion.archivoKey);
    } catch (error) {
      console.error("[documento] No se pudo eliminar el PDF al desasignar:", error);
      return { error: "No se pudo eliminar el PDF del jugador" };
    }
  }
  await prisma.solicitudDocumentoJugador.delete({
    where: { id: documentoJugadorId },
  });
  revalidatePath(`/admin/documentos/${asignacion.solicitudId}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/dashboard/documentos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Jugador desasignado de la solicitud" };
}

export async function validarDocumento(
  solicitudJugadorId: string
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const documento = await prisma.solicitudDocumentoJugador.findUnique({
    where: { id: solicitudJugadorId },
  });
  if (!documento) return { error: "Solicitud no encontrada" };
  if (documento.estado !== "SUBIDO" || !documento.archivoKey) {
    return { error: "No hay un documento pendiente de validar" };
  }

  await prisma.solicitudDocumentoJugador.update({
    where: { id: solicitudJugadorId },
    data: {
      estado: "VALIDADO",
      validadoAt: new Date(),
      rechazadoAt: null,
      ultimoMotivoRechazo: null,
    },
  });
  revalidatePath(`/admin/documentos/${documento.solicitudId}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/dashboard/documentos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Documento validado" };
}

export async function rechazarDocumento(
  solicitudJugadorId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const parsed = rechazoDocumentoSchema.safeParse({ motivo: formData.get("motivo") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Motivo inválido" };
  }

  const documento = await prisma.solicitudDocumentoJugador.findUnique({
    where: { id: solicitudJugadorId },
    include: {
      solicitud: { select: { nombre: true } },
      jugador: { select: { id: true, nombre: true, apellidos: true } },
    },
  });
  if (!documento) return { error: "Solicitud no encontrada" };
  if (documento.estado !== "SUBIDO" || !documento.archivoKey) {
    return { error: "No hay un documento pendiente de revisar" };
  }

  try {
    await deleteObject(documento.archivoKey);
  } catch (error) {
    console.error("[documento] No se pudo eliminar el archivo rechazado:", error);
    return { error: "No se pudo eliminar el archivo. No se ha rechazado el documento." };
  }

  await prisma.solicitudDocumentoJugador.update({
    where: { id: solicitudJugadorId },
    data: {
      estado: "PENDIENTE",
      archivoKey: null,
      archivoNombre: null,
      archivoMime: null,
      archivoSubidoAt: null,
      archivoSubidoPorNombre: null,
      archivoSubidoPorEmail: null,
      archivoSubidoPorEsTutor: null,
      validadoAt: null,
      rechazadoAt: new Date(),
      ultimoMotivoRechazo: parsed.data.motivo,
    },
  });

  await enviarNotificacionAJugadores({
    jugadoresIds: [documento.jugador.id],
    crearNotificacion: (jugador) => ({
      titulo: `Debes volver a subir: ${documento.solicitud.nombre}`,
      detalle: `${jugador.nombre} ${jugador.apellidos} · Motivo: ${parsed.data.motivo}. El archivo anterior se ha eliminado.`,
      url: `${getAppUrl()}/dashboard/jugadores/${jugador.id}`,
    }),
  });

  revalidatePath(`/admin/documentos/${documento.solicitudId}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/dashboard/documentos");
  revalidatePath(`/dashboard/jugadores/${documento.jugador.id}`);
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Documento rechazado, eliminado y notificado" };
}
