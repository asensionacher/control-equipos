"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  reciboSchema,
  reciboPagoSchema,
  rechazoPagoSchema,
} from "@/lib/validaciones";
import { calcularIvaYTotal } from "@/lib/recibo-utils";
import { getConfiguracionClub } from "@/lib/club-utils";
import { generarPdfRecibo } from "@/lib/pdf-recibo";
import { reciboPdfKey, putObject, deleteObject } from "@/lib/s3";
import {
  enviarNotificacionAJugadores,
  getAppUrl,
} from "@/lib/notificaciones-jugador";
import { formatearNumeroRecibo } from "@/lib/utils";

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

// === CREAR RECIBO ===

export async function crearRecibo(formData: FormData): Promise<{ error?: string; success?: string; reciboId?: number }> {
  const session = await requireAdmin();

  const jugadoresIdsRaw = formData.getAll("jugadoresIds").map(String).filter(Boolean);

  const parsed = reciboSchema.safeParse({
    concepto: formData.get("concepto"),
    descripcion: formData.get("descripcion") || "",
    baseImponible: formData.get("baseImponible"),
    tipoIva: formData.get("tipoIva"),
    fechaVencimiento: formData.get("fechaVencimiento") || "",
    modoAsignacion: formData.get("modoAsignacion"),
    equiposIds: formData.getAll("equiposIds").map(String).filter(Boolean),
    jugadoresIds: jugadoresIdsRaw,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;
  const { cuotaIva, total } = calcularIvaYTotal(data.baseImponible, data.tipoIva);

  // Resolver jugadores objetivo según el modo
  let jugadoresIdsFinal: string[] = [];
  let equiposIdsFinal: string[] = [];
  let asignacionesEquipos: Array<{ jugadorId: string; equipoId: string }> = [];

  if (data.modoAsignacion === "equipo") {
    const equipos = await prisma.equipo.findMany({
      where: { id: { in: data.equiposIds }, activo: true },
      select: { id: true },
    });
    equiposIdsFinal = equipos.map(({ id }) => id);
    if (equiposIdsFinal.length !== new Set(data.equiposIds).size) {
      return { error: "Alguno de los equipos seleccionados no existe o no está activo" };
    }
    asignacionesEquipos = await prisma.asignacionEquipo.findMany({
      where: { equipoId: { in: equiposIdsFinal } },
      select: { jugadorId: true, equipoId: true },
    });
    jugadoresIdsFinal = Array.from(
      new Set(asignacionesEquipos.map((asignacion) => asignacion.jugadorId))
    );
  } else {
    jugadoresIdsFinal = Array.from(new Set(data.jugadoresIds ?? []));
  }

  if (jugadoresIdsFinal.length === 0) {
    return { error: "No hay jugadores a los que asignar el recibo" };
  }

  const recibo = await prisma.recibo.create({
    data: {
      concepto: data.concepto,
      descripcion: data.descripcion || null,
      baseImponible: new Prisma.Decimal(data.baseImponible),
      tipoIva: new Prisma.Decimal(data.tipoIva),
      cuotaIva: new Prisma.Decimal(cuotaIva),
      total: new Prisma.Decimal(total),
      fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
      equipos: {
        connect: equiposIdsFinal.map((id) => ({ id })),
      },
      creadoPorId: session.user.id,
      jugadores: {
        create: jugadoresIdsFinal.map((jugadorId) => ({
          jugadorId,
          estado: "PENDIENTE",
          asignadoDirectamente: data.modoAsignacion === "jugadores",
          equiposOrigen: {
            connect: asignacionesEquipos
              .filter((asignacion) => asignacion.jugadorId === jugadorId)
              .map((asignacion) => ({ id: asignacion.equipoId })),
          },
        })),
      },
    },
  });

  // Generar PDF resumen y guardarlo en S3
  try {
    const club = await getConfiguracionClub();
    const reciboCompleto = await prisma.recibo.findUnique({
      where: { id: recibo.id },
      include: {
        equipo: { include: { temporada: true } },
        equipos: { include: { temporada: true } },
        jugadores: { include: { jugador: true } },
      },
    });
    if (reciboCompleto) {
      const pdf = await generarPdfRecibo({ recibo: reciboCompleto as any, club });
      const key = reciboPdfKey(recibo.id);
      await putObject(key, pdf, "application/pdf");
      await prisma.recibo.update({ where: { id: recibo.id }, data: { pdfKey: key } });
    }
  } catch (err) {
    console.error("[recibo] Error generando PDF inicial:", err);
  }

  const url = `${getAppUrl()}/dashboard/recibos/${recibo.id}`;
  const recibosIndividuales = await prisma.reciboJugador.findMany({
    where: { reciboId: recibo.id },
    select: { jugadorId: true, numero: true },
    orderBy: { numero: "asc" },
  });
  await Promise.all(
    recibosIndividuales.map((reciboJugador) =>
      enviarNotificacionAJugadores({
        jugadoresIds: [reciboJugador.jugadorId],
        crearNotificacion: (jugador) => ({
          titulo: `Nuevo recibo ${formatearNumeroRecibo(reciboJugador.numero)}`,
          detalle: `${jugador.nombre} ${jugador.apellidos} · ${recibo.concepto} · ${Number(
            recibo.total
          ).toFixed(2)} €`,
          url: `${url}?jugadorId=${reciboJugador.jugadorId}`,
        }),
      })
    )
  );

    revalidatePath("/admin/recibos");
  revalidatePath("/dashboard/recibos");
  return {
    success: `${recibosIndividuales.length} recibo${
      recibosIndividuales.length === 1 ? "" : "s"
    } creado${recibosIndividuales.length === 1 ? "" : "s"} correctamente`,
    reciboId: recibo.id,
  };
}

export async function actualizarAsignacionesRecibo(
  reciboId: number,
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

  const recibo = await prisma.recibo.findUnique({
    where: { id: reciboId },
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
  if (!recibo) return { error: "Recibo no encontrado" };
  if (recibo.estado === "ANULADO") return { error: "No se puede modificar un recibo anulado" };

  const equiposActualesIds = new Set([
    ...(recibo.equipoId ? [recibo.equipoId] : []),
    ...recibo.equipos.map(({ id }) => id),
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
  recibo.jugadores.forEach((asignacion) => {
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
    return { error: "El recibo debe conservar al menos un jugador asignado" };
  }

  const existentesPorJugador = new Map(
    recibo.jugadores.map((asignacion) => [asignacion.jugadorId, asignacion])
  );
  const nuevosIds = Array.from(jugadoresDeseados).filter(
    (jugadorId) => !existentesPorJugador.has(jugadorId)
  );
  const eliminados = recibo.jugadores.filter(
    (asignacion) => !jugadoresDeseados.has(asignacion.jugadorId)
  );

  for (const asignacion of eliminados) {
    if (asignacion.justificanteKey) {
      try {
        await deleteObject(asignacion.justificanteKey);
      } catch (error) {
        console.error("[recibo] No se pudo eliminar el justificante al desasignar:", error);
        return { error: "No se pudo eliminar un justificante de la asignación retirada" };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.recibo.update({
      where: { id: reciboId },
      data: {
        equipoId: null,
        equipos: { set: equipos.map(({ id }) => ({ id })) },
      },
    });
    if (eliminados.length > 0) {
      await tx.reciboJugador.deleteMany({
        where: { id: { in: eliminados.map(({ id }) => id) } },
      });
    }

    for (const jugadorId of jugadoresDeseados) {
      const equiposOrigen = Array.from(equiposPorJugador.get(jugadorId) ?? []);
      const existente = existentesPorJugador.get(jugadorId);
      if (existente) {
        await tx.reciboJugador.update({
          where: { id: existente.id },
          data: {
            asignadoDirectamente: jugadoresDirectosIds.includes(jugadorId),
            equiposOrigen: { set: equiposOrigen.map((id) => ({ id })) },
          },
        });
      } else {
        await tx.reciboJugador.create({
          data: {
            reciboId,
            jugadorId,
            asignadoDirectamente: jugadoresDirectosIds.includes(jugadorId),
            equiposOrigen: { connect: equiposOrigen.map((id) => ({ id })) },
          },
        });
      }
    }
  });

  await recalcularEstadoRecibo(reciboId);
  await invalidarPdfRecibo(reciboId);
  if (nuevosIds.length > 0) {
    const url = `${getAppUrl()}/dashboard/recibos/${reciboId}`;
    const nuevosRecibos = await prisma.reciboJugador.findMany({
      where: { reciboId, jugadorId: { in: nuevosIds } },
      select: { jugadorId: true, numero: true },
    });
    await Promise.all(
      nuevosRecibos.map((reciboJugador) =>
        enviarNotificacionAJugadores({
          jugadoresIds: [reciboJugador.jugadorId],
          crearNotificacion: (jugador) => ({
            titulo: `Nuevo recibo ${formatearNumeroRecibo(reciboJugador.numero)}`,
            detalle: `${jugador.nombre} ${jugador.apellidos} · ${recibo.concepto} · ${Number(
              recibo.total
            ).toFixed(2)} €`,
            url: `${url}?jugadorId=${reciboJugador.jugadorId}`,
          }),
        })
      )
    );
  }

  revalidatePath(`/admin/recibos/${reciboId}`);
  revalidatePath("/admin/recibos");
  revalidatePath(`/dashboard/recibos/${reciboId}`);
  revalidatePath("/dashboard/recibos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Asignaciones actualizadas" };
}

export async function marcarJugadoresPagados(
  reciboId: number,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const recibosJugadoresIds = Array.from(
    new Set(formData.getAll("recibosJugadoresIds").map(String).filter(Boolean))
  );
  if (recibosJugadoresIds.length === 0) return { error: "Selecciona al menos un jugador" };

  const parsed = reciboPagoSchema.safeParse({
    metodoPago: formData.get("metodoPago"),
    fechaPago: formData.get("fechaPago"),
    referenciaPago: formData.get("referenciaPago") || "",
    notasPago: formData.get("notasPago") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const asignaciones = await prisma.reciboJugador.findMany({
    where: {
      id: { in: recibosJugadoresIds },
      reciboId,
      estado: { not: "ANULADO" },
    },
    select: { id: true },
  });
  if (asignaciones.length !== recibosJugadoresIds.length) {
    return { error: "Alguna asignación seleccionada no es válida" };
  }

  await prisma.reciboJugador.updateMany({
    where: { id: { in: recibosJugadoresIds }, reciboId },
    data: {
      estado: "PAGADO",
      fechaPago: new Date(parsed.data.fechaPago),
      metodoPago: parsed.data.metodoPago,
      referenciaPago: parsed.data.referenciaPago || null,
      notasPago: parsed.data.notasPago || null,
      pagoRechazadoAt: null,
      ultimoMotivoRechazoPago: null,
    },
  });
  await recalcularEstadoRecibo(reciboId);
  await invalidarPdfRecibo(reciboId);
  revalidatePath(`/admin/recibos/${reciboId}`);
  revalidatePath("/admin/recibos");
  revalidatePath(`/dashboard/recibos/${reciboId}`);
  revalidatePath("/dashboard/recibos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: `${asignaciones.length} pagos registrados` };
}

export async function desasignarJugadorRecibo(
  reciboJugadorId: string
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const asignacion = await prisma.reciboJugador.findUnique({
    where: { id: reciboJugadorId },
    include: { recibo: { select: { estado: true } } },
  });
  if (!asignacion) return { error: "Asignación no encontrada" };
  if (asignacion.recibo.estado === "ANULADO") {
    return { error: "No se puede modificar un recibo anulado" };
  }
  const total = await prisma.reciboJugador.count({
    where: { reciboId: asignacion.reciboId },
  });
  if (total <= 1) return { error: "El recibo debe conservar al menos un jugador" };

  if (asignacion.justificanteKey) {
    try {
      await deleteObject(asignacion.justificanteKey);
    } catch (error) {
      console.error("[recibo] No se pudo eliminar el justificante al desasignar:", error);
      return { error: "No se pudo eliminar el justificante del jugador" };
    }
  }
  await prisma.reciboJugador.delete({ where: { id: reciboJugadorId } });
  await recalcularEstadoRecibo(asignacion.reciboId);
  await invalidarPdfRecibo(asignacion.reciboId);
  revalidatePath(`/admin/recibos/${asignacion.reciboId}`);
  revalidatePath("/admin/recibos");
  revalidatePath(`/dashboard/recibos/${asignacion.reciboId}`);
  revalidatePath("/dashboard/recibos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Jugador desasignado del recibo" };
}

// === MARCAR PAGO (por jugador individual o todo el recibo) ===

export async function marcarJugadorPagado(
  reciboJugadorId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  const parsed = reciboPagoSchema.safeParse({
    metodoPago: formData.get("metodoPago"),
    fechaPago: formData.get("fechaPago"),
    referenciaPago: formData.get("referenciaPago") || "",
    notasPago: formData.get("notasPago") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const rj = await prisma.reciboJugador.findUnique({ where: { id: reciboJugadorId } });
  if (!rj) return { error: "Recibo no encontrado" };

  await prisma.reciboJugador.update({
    where: { id: reciboJugadorId },
    data: {
      estado: "PAGADO",
      fechaPago: new Date(parsed.data.fechaPago),
      metodoPago: parsed.data.metodoPago,
      referenciaPago: parsed.data.referenciaPago || null,
      notasPago: parsed.data.notasPago || null,
      pagoRechazadoAt: null,
      ultimoMotivoRechazoPago: null,
    },
  });

  // Recalcular estado global del recibo
  await recalcularEstadoRecibo(rj.reciboId);

  // Invalidar PDF cacheado (ha cambiado el estado de pago)
  await invalidarPdfRecibo(rj.reciboId);

  revalidatePath(`/admin/recibos/${rj.reciboId}`);
  revalidatePath("/admin/recibos");
  revalidatePath(`/dashboard/recibos/${rj.reciboId}`);
  revalidatePath("/dashboard/recibos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Pago registrado correctamente" };
}

export async function desmarcarJugadorPagado(
  reciboJugadorId: string
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  const rj = await prisma.reciboJugador.findUnique({ where: { id: reciboJugadorId } });
  if (!rj) return { error: "Recibo no encontrado" };

  await prisma.reciboJugador.update({
    where: { id: reciboJugadorId },
    data: {
      estado: "PENDIENTE",
      fechaPago: null,
      metodoPago: null,
      referenciaPago: null,
      notasPago: null,
      pagoDeclaradoAt: null,
      pagoDeclaradoPorNombre: null,
      pagoDeclaradoPorEmail: null,
      pagoDeclaradoPorEsTutor: null,
      pagoRechazadoAt: null,
      ultimoMotivoRechazoPago: null,
    },
  });

  await recalcularEstadoRecibo(rj.reciboId);
  await invalidarPdfRecibo(rj.reciboId);

  revalidatePath(`/admin/recibos/${rj.reciboId}`);
  revalidatePath("/admin/recibos");
  revalidatePath(`/dashboard/recibos/${rj.reciboId}`);
  revalidatePath("/dashboard/recibos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Pago deshecho" };
}

export async function rechazarPagoJugador(
  reciboJugadorId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const parsed = rechazoPagoSchema.safeParse({ motivo: formData.get("motivo") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Motivo inválido" };
  }

  const reciboJugador = await prisma.reciboJugador.findUnique({
    where: { id: reciboJugadorId },
    include: {
      recibo: { select: { concepto: true } },
      jugador: { select: { id: true, nombre: true, apellidos: true } },
    },
  });
  if (!reciboJugador) return { error: "Recibo del jugador no encontrado" };
  if (reciboJugador.estado !== "PENDIENTE" || !reciboJugador.pagoDeclaradoAt) {
    return { error: "El pago no está pendiente de confirmación" };
  }

  if (reciboJugador.justificanteKey) {
    try {
      await deleteObject(reciboJugador.justificanteKey);
    } catch (error) {
      console.error("[recibo] No se pudo eliminar el justificante rechazado:", error);
      return { error: "No se pudo eliminar el justificante. El pago no se ha rechazado." };
    }
  }

  await prisma.reciboJugador.update({
    where: { id: reciboJugador.id },
    data: {
      estado: "RECHAZADO",
      pagoDeclaradoAt: null,
      pagoDeclaradoPorNombre: null,
      pagoDeclaradoPorEmail: null,
      pagoDeclaradoPorEsTutor: null,
      pagoRechazadoAt: new Date(),
      ultimoMotivoRechazoPago: parsed.data.motivo,
      justificanteKey: null,
      justificanteNombre: null,
      justificanteMime: null,
      justificanteSubidoAt: null,
      justificanteSubidoPorNombre: null,
      justificanteSubidoPorEmail: null,
      justificanteSubidoPorEsTutor: null,
    },
  });

  await invalidarPdfRecibo(reciboJugador.reciboId);
  await enviarNotificacionAJugadores({
    jugadoresIds: [reciboJugador.jugador.id],
    crearNotificacion: (jugador) => ({
      titulo: `Pago rechazado: ${reciboJugador.recibo.concepto}`,
      detalle: `${jugador.nombre} ${jugador.apellidos} · Motivo: ${parsed.data.motivo}. Debe revisar el pago y volver a marcarlo como pagado.`,
      url: `${getAppUrl()}/dashboard/recibos/${reciboJugador.reciboId}?jugadorId=${jugador.id}`,
    }),
  });

  revalidatePath(`/admin/recibos/${reciboJugador.reciboId}`);
  revalidatePath("/admin/recibos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  revalidatePath(`/dashboard/recibos/${reciboJugador.reciboId}`);
  revalidatePath(`/dashboard/jugadores/${reciboJugador.jugador.id}`);
  return { success: "Pago rechazado y justificante eliminado" };
}

// === ANULAR / ELIMINAR RECIBO ===

export async function anularRecibo(reciboId: number): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  await prisma.recibo.update({
    where: { id: reciboId },
    data: { estado: "ANULADO", jugadores: { updateMany: { where: {}, data: { estado: "ANULADO" } } } },
  });

  await invalidarPdfRecibo(reciboId);

  revalidatePath("/admin/recibos");
  revalidatePath(`/admin/recibos/${reciboId}`);
  revalidatePath("/dashboard/recibos");
  return { success: "Recibo anulado" };
}

export async function eliminarRecibo(reciboId: number): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  const recibo = await prisma.recibo.findUnique({ where: { id: reciboId } });
  if (!recibo) return { error: "Recibo no encontrado" };

  // Eliminar PDF del bucket si existe
  if (recibo.pdfKey) {
    try {
      await deleteObject(recibo.pdfKey);
    } catch (err) {
      console.error("[recibo] Error eliminando PDF de S3:", err);
    }
  }

  // Eliminar justificantes de cada jugador
  const rjs = await prisma.reciboJugador.findMany({ where: { reciboId } });
  for (const rj of rjs) {
    if (rj.justificanteKey) {
      try {
        await deleteObject(rj.justificanteKey);
      } catch (err) {
        console.error("[recibo] Error eliminando justificante:", err);
      }
    }
  }

  await prisma.recibo.delete({ where: { id: reciboId } });

revalidatePath("/admin/recibos");
  revalidatePath("/dashboard/recibos");
  revalidatePath("/admin/pendientes");
  revalidatePath("/admin");
  return { success: "Recibo eliminado" };
}

// === CONFIGURACIÓN DEL CLUB ===
// (movido a /admin/configuracion/actions.ts)

async function recalcularEstadoRecibo(reciboId: number): Promise<void> {
  const rjs = await prisma.reciboJugador.findMany({
    where: { reciboId },
    select: { estado: true },
  });
  if (rjs.length === 0) return;

  const todosPagados = rjs.every((r) => r.estado === "PAGADO");
  const algunoNoAnulado = rjs.some((r) => r.estado !== "ANULADO");

  let nuevoEstado: "PENDIENTE" | "PAGADO" | "ANULADO" = "PENDIENTE";
  if (todosPagados && algunoNoAnulado) nuevoEstado = "PAGADO";
  if (rjs.every((r) => r.estado === "ANULADO")) nuevoEstado = "ANULADO";

  const data: any = { estado: nuevoEstado };
  if (nuevoEstado === "PAGADO") {
    data.fechaPago = new Date();
  } else {
    data.fechaPago = null;
    data.metodoPago = null;
    data.referenciaPago = null;
    data.notasPago = null;
  }

  await prisma.recibo.update({ where: { id: reciboId }, data });
}

async function invalidarPdfRecibo(reciboId: number): Promise<void> {
  const recibo = await prisma.recibo.findUnique({ where: { id: reciboId } });
  if (recibo?.pdfKey) {
    try {
      await deleteObject(recibo.pdfKey);
    } catch (err) {
      console.error("[recibo] Error eliminando PDF cacheado:", err);
    }
    await prisma.recibo.update({ where: { id: reciboId }, data: { pdfKey: null } });
  }
}