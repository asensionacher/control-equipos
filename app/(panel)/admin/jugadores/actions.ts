"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { jugadorSchema, jugadorEditTutorSchema } from "@/lib/validaciones";
import { sincronizarAsignacionesJugador } from "@/lib/sincronizar-asignaciones-jugador";
import { encolarNotificacion } from "@/lib/notificaciones-jugador";
import {
  actualizarFotoJugador,
  validarFotoFormulario,
} from "@/lib/foto-jugador";
import { calcularEdad } from "@/lib/utils";
import { deleteObject } from "@/lib/s3";

const APP_URL = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  return session;
}

interface CrearJugadorParams {
  jugador: {
    nombre: string;
    apellidos: string;
    fechaNacimiento: string;
    dniNie: string | null;
    email: string | null;
    telefono: string | null;
    telefonoAlternativo: string | null;
    direccion: string | null;
    sexo: "MASCULINO" | "FEMENINO" | "OTRO" | null;
    tutorUsuarioId: string | null;
    parentescoTutor: string | null;
    emailContactoTutor: string | null;
    telefonoContactoTutor: string | null;
  };
  mensajeInvitacion?: string;
}

export async function crearJugador(
  datos: CrearJugadorParams,
  fotoFormData?: FormData
): Promise<{ error?: string; success?: string; jugadorId?: string }> {
  await requireAdmin();

  const parsed = jugadorSchema.safeParse({
    nombre: datos.jugador.nombre,
    apellidos: datos.jugador.apellidos,
    fechaNacimiento: datos.jugador.fechaNacimiento,
    dniNie: datos.jugador.dniNie ?? "",
    email: datos.jugador.email ?? "",
    telefono: datos.jugador.telefono ?? "",
    telefonoAlternativo: datos.jugador.telefonoAlternativo ?? "",
    direccion: datos.jugador.direccion ?? "",
    sexo: datos.jugador.sexo,
    tutorUsuarioId: datos.jugador.tutorUsuarioId ?? "",
    parentescoTutor: datos.jugador.parentescoTutor ?? "",
    emailContactoTutor: datos.jugador.emailContactoTutor ?? "",
    telefonoContactoTutor: datos.jugador.telefonoContactoTutor ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const errorFoto = await validarFotoFormulario(fotoFormData);
  if (errorFoto) return { error: errorFoto };

  const data = parsed.data;
  const esMayorDeEdad = calcularEdad(data.fechaNacimiento) >= 18;
  const dni = data.dniNie || null;
  if (dni) {
    const existe = await prisma.jugador.findUnique({ where: { dniNie: dni } });
    if (existe) return { error: "Ya existe un jugador con ese DNI/NIE" };
  }

  // Determinar el tutor:
  // 1) Si se especifica tutorUsuarioId directamente
  // 2) Si no, intentar auto-vincular por email del jugador o email de contacto del tutor
  let tutorUsuarioId = esMayorDeEdad ? null : data.tutorUsuarioId || null;
  let parentescoTutor = esMayorDeEdad ? null : data.parentescoTutor || null;

  if (!esMayorDeEdad && !tutorUsuarioId) {
    const emailCandidato = (data.email || data.emailContactoTutor || "").toLowerCase().trim();
    if (emailCandidato) {
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email: emailCandidato },
      });
      if (usuarioExistente && usuarioExistente.rol === "USUARIO") {
        tutorUsuarioId = usuarioExistente.id;
        if (!parentescoTutor) parentescoTutor = "Padre/Madre";
      }
    }
  }

  // Si se especifica tutorUsuarioId, verificar que existe
  if (tutorUsuarioId) {
    const usuario = await prisma.usuario.findUnique({ where: { id: tutorUsuarioId } });
    if (!usuario) return { error: "El tutor seleccionado no existe" };
  }

  const jugador = await prisma.jugador.create({
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      fechaNacimiento: new Date(data.fechaNacimiento),
      dniNie: dni,
      email: data.email || null,
      telefono: data.telefono || null,
      telefonoAlternativo: data.telefonoAlternativo || null,
      direccion: data.direccion || null,
      sexo: data.sexo,
    },
  });

  let avisoVinculacion: string | null = null;

  if (tutorUsuarioId) {
    await prisma.tutoria.create({
      data: {
        jugadorId: jugador.id,
        usuarioId: tutorUsuarioId,
        parentesco: parentescoTutor,
        esPrincipal: true,
      },
    });

    // Enviar email notificando al padre/tutor
    const tutor = await prisma.usuario.findUnique({ where: { id: tutorUsuarioId } });
    if (tutor && tutor.email) {
      await encolarNotificacion({
        destinatario: tutor.email,
        titulo: "Nuevo jugador añadido a tu cuenta",
        detalle:
          datos.mensajeInvitacion ??
          `${jugador.nombre} ${jugador.apellidos} se ha añadido a tu cuenta.`,
        url: `${APP_URL}/dashboard`,
      });
    }

    // Si fue auto-vinculado por email, avisamos al admin
    const fueAutoVinculado = !datos.jugador.tutorUsuarioId && tutorUsuarioId;
    if (fueAutoVinculado) {
      avisoVinculacion = `Se vinculó automáticamente al usuario existente con email ${data.email || data.emailContactoTutor}.`;
    }
  }

  const errorSubidaFoto = await actualizarFotoJugador(jugador.id, fotoFormData);
  if (errorSubidaFoto) {
    return {
      error: `${errorSubidaFoto}. El jugador se ha creado sin foto.`,
      jugadorId: jugador.id,
    };
  }
  await sincronizarAsignacionesJugador(jugador.id);

  revalidatePath("/admin/jugadores");
  revalidatePath("/admin/padres");
  return {
    success: avisoVinculacion
      ? `Jugador creado. ${avisoVinculacion}`
      : "Jugador creado correctamente",
    jugadorId: jugador.id,
  };
}

export async function editarJugador(
  id: string,
  datos: CrearJugadorParams["jugador"],
  fotoFormData?: FormData
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  const parsed = jugadorSchema.safeParse({
    nombre: datos.nombre,
    apellidos: datos.apellidos,
    fechaNacimiento: datos.fechaNacimiento,
    dniNie: datos.dniNie ?? "",
    email: datos.email ?? "",
    telefono: datos.telefono ?? "",
    telefonoAlternativo: datos.telefonoAlternativo ?? "",
    direccion: datos.direccion ?? "",
    sexo: datos.sexo,
    tutorUsuarioId: datos.tutorUsuarioId ?? "",
    parentescoTutor: datos.parentescoTutor ?? "",
    emailContactoTutor: datos.emailContactoTutor ?? "",
    telefonoContactoTutor: datos.telefonoContactoTutor ?? "",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const errorFoto = await validarFotoFormulario(fotoFormData);
  if (errorFoto) return { error: errorFoto };

  const data = parsed.data;
  const esMayorDeEdad = calcularEdad(data.fechaNacimiento) >= 18;
  const dni = data.dniNie || null;
  if (dni) {
    const existe = await prisma.jugador.findFirst({ where: { dniNie: dni, NOT: { id } } });
    if (existe) return { error: "Ya existe otro jugador con ese DNI/NIE" };
  }

  await prisma.jugador.update({
    where: { id },
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      fechaNacimiento: new Date(data.fechaNacimiento),
      dniNie: dni,
      email: data.email || null,
      telefono: data.telefono || null,
      telefonoAlternativo: data.telefonoAlternativo || null,
      direccion: data.direccion || null,
      sexo: data.sexo,
    },
  });

  // Sincronizar datos personales con el Usuario vinculado (si tiene)
  const jugadorActualizado = await prisma.jugador.findUnique({
    where: { id },
    select: { usuarioId: true },
  });
  if (jugadorActualizado?.usuarioId) {
    await prisma.usuario.update({
      where: { id: jugadorActualizado.usuarioId },
      data: {
        nombre: data.nombre,
        apellidos: data.apellidos,
        email: data.email || undefined,
        telefono: data.telefono || null,
        telefonoAlternativo: data.telefonoAlternativo || null,
      },
    });
    // Sincronizar también al Jugador desde Usuario (por si el helper debe prevalecer)
    await prisma.jugador.update({
      where: { id },
      data: {
        email: data.email || null,
        telefono: data.telefono || null,
        telefonoAlternativo: data.telefonoAlternativo || null,
      },
    });
  }

  // Actualizar tutor (relación Tutoria)
  const nuevaTutoriaId = esMayorDeEdad ? null : data.tutorUsuarioId || null;
  const tutoriaActual = await prisma.tutoria.findFirst({
    where: { jugadorId: id, esPrincipal: true },
  });

  if (nuevaTutoriaId && (!tutoriaActual || tutoriaActual.usuarioId !== nuevaTutoriaId)) {
    // Crear o actualizar tutoría
    if (tutoriaActual) {
      await prisma.tutoria.update({
        where: { id: tutoriaActual.id },
        data: { usuarioId: nuevaTutoriaId, parentesco: data.parentescoTutor || tutoriaActual.parentesco },
      });
    } else {
      await prisma.tutoria.create({
        data: {
          jugadorId: id,
          usuarioId: nuevaTutoriaId,
          parentesco: data.parentescoTutor || null,
          esPrincipal: true,
        },
      });
    }
  } else if (!nuevaTutoriaId && tutoriaActual) {
    await prisma.tutoria.deleteMany({ where: { jugadorId: id } });
  }

  const errorSubidaFoto = await actualizarFotoJugador(id, fotoFormData);
  if (errorSubidaFoto) return { error: errorSubidaFoto };

  revalidatePath("/admin/jugadores");
  revalidatePath(`/admin/jugadores/${id}`);
  redirect(`/admin/jugadores/${id}`);
}

export async function eliminarJugador(id: string) {
  await requireAdmin();
  await prisma.jugador.update({ where: { id }, data: { activo: false } });
  revalidatePath("/admin/jugadores");
  redirect("/admin/jugadores");
}

/**
 * Eliminación RGPD de un Jugador.
 *
 * Caso de uso: Jugadores SIN cuenta propia (típicamente menores cuyo tutor tiene
 * la cuenta de Usuario). Anonimiza la ficha del Jugador conservando la fila
 * para mantener las FKs de ReciboJugador, ConsentimientoJugador, etc.
 *
 * Reglas:
 *  - Si el Jugador tiene Usuario vinculado, rechazar y pedir usar
 *    `eliminarUsuarioRGPD` desde la ficha del Usuario.
 *  - Si el Jugador es menor de edad y tiene tutores, NO bloqueamos: la eliminación
 *    RGPD es un derecho del interesado (o sus padres). Las Tutorias del Jugador
 *    permanecen — son la prueba de quién era su tutor.
 *  - Consentimientos firmados: se marcan como revocados.
 *  - Si el Jugador está vinculado como Entrenador.jugadorId, se desvincula.
 *  - Si el Jugador es Entrenador (Entrenador.jugadorId), se desvincula.
 */
export async function eliminarJugadorRGPD(
  jugadorId: string
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  const jugador = await prisma.jugador.findUnique({
    where: { id: jugadorId },
    include: {
      usuario: { select: { id: true, email: true } },
    },
  });
  if (!jugador) return { error: "Jugador no encontrado" };
  if (jugador.usuarioId) {
    return {
      error:
        "Este jugador tiene cuenta de Usuario vinculada. Elimínalo desde la ficha del Usuario para anonimizar todo en una sola operación.",
    };
  }

  const fotoKey = jugador.fotoUrl;

  const [
    consentimientosFirmadosCount,
    recibosCount,
    solicitudesCount,
  ] = await Promise.all([
    prisma.consentimientoJugador.count({
      where: { jugadorId, firmadoPorId: { not: null } },
    }),
    prisma.reciboJugador.count({ where: { jugadorId } }),
    prisma.solicitudDocumentoJugador.count({ where: { jugadorId } }),
  ]);

  await prisma.$transaction(async (tx) => {
    // Desvincular si algún Entrenador usaba este Jugador.
    await tx.entrenador.updateMany({
      where: { jugadorId },
      data: { jugadorId: null },
    });

    // Eliminar asignaciones a equipos.
    await tx.asignacionEquipo.deleteMany({ where: { jugadorId } });

    // Revocar consentimientos firmados (no eliminamos el PDF, conservamos prueba).
    await tx.consentimientoJugador.updateMany({
      where: { jugadorId },
      data: {
        revocadoAt: new Date(),
        revocadoMotivo: "ELIMINACION_RGPD",
      },
    });

    // Anonimizar la ficha del Jugador.
    await tx.jugador.update({
      where: { id: jugadorId },
      data: {
        nombre: "[Eliminado RGPD]",
        apellidos: "",
        email: null,
        telefono: null,
        telefonoAlternativo: null,
        dniNie: null,
        direccion: null,
        fotoUrl: null,
        activo: false,
      },
    });

    // Auditoría.
    await tx.auditoriaRGPD.create({
      data: {
        sujetoTipo: "JUGADOR",
        sujetoAfectadoId: jugadorId,
        sujetoAfectadoEmail: jugador.email,
        sujetoAfectadoNombre: `${jugador.nombre} ${jugador.apellidos}`.trim(),
        ejecutadoPorId: session.user.id,
        accion: "ELIMINACION_JUGADOR_RGPD",
        detalle: {
          edadAlEliminar: calcularEdad(jugador.fechaNacimiento),
          consentimientosRevocados: consentimientosFirmadosCount,
          recibosPreservados: recibosCount,
          solicitudesPreservadas: solicitudesCount,
        },
      },
    });
  });

  if (fotoKey) {
    try {
      await deleteObject(fotoKey);
    } catch (err) {
      console.warn(
        `[rgpd] No se pudo borrar la foto en S3 (${fotoKey}). La anonimización de BD se completó correctamente.`,
        err
      );
    }
  }

  revalidatePath("/admin/jugadores");
  revalidatePath(`/admin/jugadores/${jugadorId}`);
  redirect("/admin/jugadores");
}

export async function editarJugadorTutor(
  jugadorId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  // Verificar que el usuario es tutor del jugador o es el propio jugador
  const jugador = await prisma.jugador.findUnique({
    where: { id: jugadorId },
    include: {
      tutorias: { where: { usuarioId: session.user.id } },
    },
  });
  if (!jugador) return { error: "Jugador no encontrado" };

  const esPropia = jugador.usuarioId === session.user.id;
  const esTutor = jugador.tutorias.length > 0;
  if (!esTutor && !esPropia) return { error: "No autorizado" };

  // Sexo (campo hidden desde el Select)
  const sexoRaw = formData.get("sexo");
  const sexoValido = ["MASCULINO", "FEMENINO", "OTRO"].includes(sexoRaw as string)
    ? (sexoRaw as "MASCULINO" | "FEMENINO" | "OTRO")
    : undefined;

  const parsed = jugadorEditTutorSchema.safeParse({
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    fechaNacimiento: formData.get("fechaNacimiento"),
    dniNie: formData.get("dniNie") || "",
    email: formData.get("email") || "",
    telefono: formData.get("telefono") || "",
    telefonoAlternativo: formData.get("telefonoAlternativo") || "",
    direccion: formData.get("direccion") || "",
    sexo: sexoValido,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Validar DNI único
  if (parsed.data.dniNie) {
    const dniEnUso = await prisma.jugador.findFirst({
      where: { dniNie: parsed.data.dniNie, NOT: { id: jugadorId } },
    });
    if (dniEnUso) return { error: "Ya existe otro jugador con ese DNI/NIE" };
  }

  await prisma.jugador.update({
    where: { id: jugadorId },
    data: {
      nombre: parsed.data.nombre,
      apellidos: parsed.data.apellidos,
      fechaNacimiento: new Date(parsed.data.fechaNacimiento),
      dniNie: parsed.data.dniNie || null,
      email: parsed.data.email || null,
      telefono: parsed.data.telefono || null,
      telefonoAlternativo: parsed.data.telefonoAlternativo || null,
      direccion: parsed.data.direccion || null,
      sexo: parsed.data.sexo,
    },
  });

  // Si el jugador tiene Usuario propio, sincronizar los datos personales con ese Usuario
  if (jugador.usuarioId) {
      await prisma.usuario.update({
        where: { id: jugador.usuarioId },
        data: {
          nombre: parsed.data.nombre,
          apellidos: parsed.data.apellidos,
          telefono: parsed.data.telefono || null,
          telefonoAlternativo: parsed.data.telefonoAlternativo || null,
          // Email NO se sincroniza desde aquí (lo gestiona admin)
        },
      });
    }

  revalidatePath(`/dashboard/jugadores/${jugadorId}`);
  revalidatePath("/dashboard");
  revalidatePath(`/admin/jugadores/${jugadorId}`);
  return { success: "Datos del jugador actualizados correctamente" };
}

// ============================================
// INVITACIONES (LEGACY)
// ============================================

export async function reenviarInvitacion(jugadorId: string): Promise<{ error?: string; success?: string }> {
  return { error: "Función deprecada. El sistema ahora usa cuentas de Usuario directas." };
}
