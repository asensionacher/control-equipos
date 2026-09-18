"use server";

import bcrypt from "bcryptjs";
import { render } from "@react-email/render";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PlantillaPasswordCambiadaAdmin } from "@/emails/plantilla-password-cambiada-admin";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";
import { cambioPasswordAdminSchema } from "@/lib/validaciones";
import { calcularEdad } from "@/lib/utils";
import { deleteObject } from "@/lib/s3";
import { crearPendingYEnviarEmail } from "../nuevo/actions";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  return session;
}

export async function actualizarDatosUsuario(
  usuarioId: string,
  formData: FormData
): Promise<{ error?: string; success?: string; emailCambiado?: boolean }> {
  await requireAdmin();

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, email: true },
  });
  if (!usuarioActual) return { error: "Usuario no encontrado" };

  const nombre = ((formData.get("nombre") as string) || "").trim();
  const apellidos = ((formData.get("apellidos") as string) || "").trim();
  const emailRaw = ((formData.get("email") as string) || "").toLowerCase().trim();
  const telefono = ((formData.get("telefono") as string) || "").trim() || null;
  const telefonoAlternativo =
    ((formData.get("telefonoAlternativo") as string) || "").trim() || null;
  const fechaNacimientoRaw = ((formData.get("fechaNacimiento") as string) || "").trim();
  const dniNie = ((formData.get("dniNie") as string) || "").trim() || null;
  const rol = ((formData.get("rol") as string) || "USUARIO") as "ADMIN" | "USUARIO";

  if (!nombre || !apellidos) {
    return { error: "Nombre y apellidos son obligatorios" };
  }

  // El email puede estar vacío (menores sin acceso al portal). Si se rellena, validar formato.
  if (emailRaw && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
    return { error: "Email inválido" };
  }

  // Validar unicidad de email solo si se rellena
  if (emailRaw && emailRaw !== (usuarioActual.email ?? "")) {
    const existe = await prisma.usuario.findFirst({
      where: { email: emailRaw, NOT: { id: usuarioId } },
    });
    if (existe) return { error: "Ya existe otro usuario con ese email" };
  }

  // Validar unicidad de DNI si cambia
  if (dniNie) {
    const dupeUsuario = await prisma.usuario.findFirst({
      where: { dniNie, NOT: { id: usuarioId } },
    });
    if (dupeUsuario) return { error: "Ya existe otro usuario con ese DNI/NIE" };
    const dupeJugador = await prisma.jugador.findFirst({
      where: { dniNie },
    });
    if (dupeJugador) return { error: "Ya existe un jugador con ese DNI/NIE" };
  }

  const emailCambiado = emailRaw !== (usuarioActual.email ?? "");
  const seHaAnadidoEmail = !!emailRaw && !!usuarioActual.email === false;

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      nombre,
      apellidos,
      email: emailRaw || null,
      telefono,
      telefonoAlternativo,
      fechaNacimiento: fechaNacimientoRaw || null,
      dniNie,
      rol,
      // Si el email cambia o se añade, forzamos re-activación: passwordHash=null, emailVerificado=false.
      // Si se borra (pasa de tener email a null), también lo limpiamos.
      ...(emailCambiado
        ? { passwordHash: null, emailVerificado: false }
        : {}),
    },
  });

  // Si el email se modificó o añadió, enviar activación al nuevo email.
  if (emailCambiado && emailRaw) {
    const session = await auth();
    await crearPendingYEnviarEmail({
      email: emailRaw,
      nombre,
      apellidos,
      telefono,
      creadoPorId: session!.user.id,
      motivo: rol === "ADMIN" ? "admin" : "usuario",
    });
  }

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/padres");
  return {
    success: emailCambiado
      ? seHaAnadidoEmail
        ? "Datos actualizados. Se ha enviado un email de activación para que configure su contraseña."
        : "Datos actualizados. Se ha enviado un email de activación al nuevo correo."
      : "Datos actualizados",
    emailCambiado,
  };
}

export async function reenviarActivacionUsuario(
  usuarioId: string
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, email: true, nombre: true, apellidos: true, telefono: true, rol: true },
  });
  if (!usuario) return { error: "Usuario no encontrado" };
  if (!usuario.email) {
    return { error: "Este usuario no tiene email. Asígnale uno primero." };
  }

  const session = await auth();
  await crearPendingYEnviarEmail({
    email: usuario.email,
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    telefono: usuario.telefono,
    creadoPorId: session!.user.id,
    motivo: usuario.rol === "ADMIN" ? "admin" : "usuario",
  });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return { success: "Email de activación reenviado." };
}

export async function cambiarPasswordUsuarioAdmin(
  usuarioId: string,
  formData: FormData
): Promise<{ error?: string; success?: string; warning?: string }> {
  await requireAdmin();

  const parsed = cambioPasswordAdminSchema.safeParse({
    passwordNueva: formData.get("passwordNueva"),
    confirmarPassword: formData.get("confirmarPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nombre: true, email: true },
  });
  if (!usuario) return { error: "Usuario no encontrado" };
  if (!usuario.email) {
    return { error: "El usuario necesita un email para poder notificar el cambio" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.passwordNueva, 10);
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.updateMany({
      where: { usuarioId: usuario.id, usado: false },
      data: { usado: true, fechaUso: new Date() },
    }),
  ]);

  const html = await render(
    PlantillaPasswordCambiadaAdmin({
      nombreDestino: usuario.nombre,
      nombreClub: APP_NAME,
    })
  );
  const resultadoEmail = await enviarEmail({
    to: usuario.email,
    subject: `Un administrador ha cambiado tu contraseña en ${APP_NAME}`,
    html,
  });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return resultadoEmail.ok
    ? {
        success:
          "Contraseña actualizada. El usuario ha recibido una notificación de seguridad.",
      }
    : {
        success: "Contraseña actualizada.",
        warning: `No se pudo enviar la notificación: ${resultadoEmail.error ?? "error desconocido"}`,
      };
}

export async function cambiarRolUsuario(
  usuarioId: string,
  rol: "ADMIN" | "USUARIO"
) {
  await requireAdmin();
  await prisma.usuario.update({ where: { id: usuarioId }, data: { rol } });
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/usuarios");
}

/**
 * Resetea el segundo factor (TOTP) de un usuario desde el panel admin.
 * Caso de uso: el usuario perdió su dispositivo autenticador.
 */
export async function resetearTotpUsuario(
  usuarioId: string
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, totpEnabled: true, email: true, nombre: true, apellidos: true },
  });
  if (!usuario) return { error: "Usuario no encontrado" };
  if (!usuario.totpEnabled) {
    return { error: "Este usuario no tiene segundo factor activado" };
  }
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { totpEnabled: false, totpSecret: null },
  });
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return {
    success: `Segundo factor reseteado para ${usuario.nombre} ${usuario.apellidos}`,
  };
}

// === Rol Padre ===
export async function asignarTutorias(
  usuarioId: string,
  jugadoresIds: string[]
): Promise<{ error?: string }> {
  await requireAdmin();
  if (jugadoresIds.length === 0) return {};
  for (const jugadorId of jugadoresIds) {
    await prisma.tutoria.upsert({
      where: { jugadorId_usuarioId: { jugadorId, usuarioId } },
      update: { esPrincipal: true },
      create: {
        jugadorId,
        usuarioId,
        parentesco: "Padre/Madre",
        esPrincipal: true,
      },
    });
  }
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/padres");
  return {};
}

export async function quitarTutoria(
  usuarioId: string,
  tutoriaId: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const tutoria = await prisma.tutoria.findUnique({
    where: { id: tutoriaId },
    select: { usuarioId: true },
  });
  if (!tutoria || tutoria.usuarioId !== usuarioId) {
    return { error: "Tutoría no encontrada" };
  }
  await prisma.tutoria.delete({ where: { id: tutoriaId } });
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/padres");
  return {};
}

// === Rol Jugador ===
export async function crearPerfilJugadorParaUsuario(
  usuarioId: string,
  formData: FormData
): Promise<{ error?: string; jugadorId?: string }> {
  await requireAdmin();
  const fechaNacimiento = (formData.get("fechaNacimiento") as string) || "";
  const dniNie = ((formData.get("dniNie") as string) || "").trim() || null;
  if (!fechaNacimiento || isNaN(Date.parse(fechaNacimiento))) {
    return { error: "Fecha de nacimiento inválida" };
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nombre: true, apellidos: true, email: true, telefono: true, telefonoAlternativo: true },
  });
  if (!usuario) return { error: "Usuario no encontrado" };

  if (dniNie) {
    const enUso = await prisma.jugador.findUnique({ where: { dniNie } });
    if (enUso) return { error: "Ya existe otro jugador con ese DNI/NIE" };
  }

  const existente = await prisma.jugador.findUnique({
    where: { usuarioId },
  });
  if (existente) return { error: "Este usuario ya tiene ficha de jugador" };

  const jugador = await prisma.jugador.create({
    data: {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      fechaNacimiento: new Date(fechaNacimiento),
      dniNie,
      email: usuario.email,
      telefono: usuario.telefono,
      telefonoAlternativo: usuario.telefonoAlternativo,
      usuarioId: usuario.id,
    },
  });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath(`/admin/jugadores/${jugador.id}`);
  return { jugadorId: jugador.id };
}

export async function vincularJugadorExistente(
  usuarioId: string,
  jugadorId: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const jugador = await prisma.jugador.findUnique({ where: { id: jugadorId } });
  if (!jugador) return { error: "Jugador no encontrado" };
  if (jugador.usuarioId) {
    return { error: "Ese jugador ya tiene cuenta asociada" };
  }
  await prisma.jugador.update({
    where: { id: jugadorId },
    data: { usuarioId },
  });
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath(`/admin/jugadores/${jugadorId}`);
  return {};
}

export async function asignarEquiposAJugador(
  jugadorId: string,
  equipoIds: string[]
): Promise<{ error?: string }> {
  await requireAdmin();
  for (const equipoId of equipoIds) {
    await prisma.asignacionEquipo.upsert({
      where: { jugadorId_equipoId: { jugadorId, equipoId } },
      update: {},
      create: { jugadorId, equipoId },
    });
  }
  revalidatePath(`/admin/jugadores/${jugadorId}`);
  return {};
}

export async function quitarEquipoAJugador(
  jugadorId: string,
  equipoId: string
): Promise<{ error?: string }> {
  await requireAdmin();
  await prisma.asignacionEquipo.deleteMany({
    where: { jugadorId, equipoId },
  });
  revalidatePath(`/admin/jugadores/${jugadorId}`);
  return {};
}

// === Rol Entrenador ===
export async function crearPerfilEntrenador(
  usuarioId: string
): Promise<{ error?: string; entrenadorId?: string }> {
  await requireAdmin();
  const existe = await prisma.entrenador.findUnique({
    where: { usuarioId },
  });
  if (existe) return { error: "Este usuario ya tiene perfil de entrenador" };
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nombre: true, apellidos: true, email: true, telefono: true, telefonoAlternativo: true },
  });
  if (!usuario) return { error: "Usuario no encontrado" };
  const session = await auth();
  const entrenador = await prisma.entrenador.create({
    data: {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      email: usuario.email,
      telefono: usuario.telefono,
      telefonoAlternativo: usuario.telefonoAlternativo,
      usuarioId,
      creadoPorId: session!.user.id,
    },
  });
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath(`/admin/entrenadores/${entrenador.id}`);
  return { entrenadorId: entrenador.id };
}

export async function asignarEquiposAEntrenador(
  entrenadorId: string,
  equipoIds: string[]
): Promise<{ error?: string }> {
  await requireAdmin();
  const temporadaActiva = await prisma.temporada.findFirst({
    where: { activa: true },
    select: { id: true },
  });
  for (const equipoId of equipoIds) {
    await prisma.entrenadorEquipo.upsert({
      where: {
        entrenadorId_equipoId_rol: {
          entrenadorId,
          equipoId,
          rol: "ENTRENADOR_PRINCIPAL",
        },
      },
      update: {},
      create: {
        entrenadorId,
        equipoId,
        rol: "ENTRENADOR_PRINCIPAL",
        temporadaId: temporadaActiva?.id ?? null,
      },
    });
  }
  revalidatePath(`/admin/entrenadores/${entrenadorId}`);
  return {};
}

export async function quitarEquipoAEntrenador(
  entrenadorId: string,
  asignacionId: string
): Promise<{ error?: string }> {
  await requireAdmin();
  await prisma.entrenadorEquipo.delete({ where: { id: asignacionId } });
  revalidatePath(`/admin/entrenadores/${entrenadorId}`);
  return {};
}

export async function eliminarUsuario(
  usuarioId: string
): Promise<{ error?: string }> {
  return eliminarUsuarioRGPD(usuarioId);
}

/**
 * Eliminación RGPD de un Usuario.
 *
 * La cuenta de acceso se anonimiza y se elimina. Los datos personales del Usuario
 * (y de su Jugador/Entrenador vinculados) se vacían. Las fichas de Jugador/
 * Entrenador se conservan como registros contenedores (necesarios para FKs de
 * ReciboJugador, ConsentimientoJugador, SolicitudDocumentoJugador, etc.) pero
 * totalmente anonimizadas.
 *
 * Preserva (no se eliminan):
 *  - Recibos y ReciboJugador (obligación contable).
 *  - Consentimientos firmados: el PDF original sigue accesible y se marca como
 *    revocado (`revocadoAt` + `revocadoMotivo = "ELIMINACION_RGPD"`).
 *  - Solicitudes de documentos y sus archivos.
 *  - AuditoriaRGPD con snapshot del sujeto eliminado.
 */
export async function eliminarUsuarioRGPD(
  usuarioId: string
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  if (session.user.id === usuarioId) {
    return { error: "No puedes eliminar tu propio usuario" };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      jugadorComoUsuario: { select: { id: true, fotoUrl: true } },
      entrenadorComoUsuario: { select: { id: true } },
    },
  });

  if (!usuario) return { error: "Usuario no encontrado" };

  // Si era admin, asegurar que queda al menos otro admin en el sistema.
  if (usuario.rol === "ADMIN") {
    const otrosAdmins = await prisma.usuario.count({
      where: { rol: "ADMIN", id: { not: usuarioId } },
    });
    if (otrosAdmins === 0) {
      return {
        error:
          "No se puede eliminar al último administrador del sistema. Asigna primero otro administrador.",
      };
    }
  }

  // Si el Usuario era tutor único de algún Jugador menor de edad, bloquear.
  // (El Jugador vinculado a su propia cuenta no cuenta aquí, porque su
  // eliminación ya está implícita en la propia anonimización del Usuario.)
  const tutorias = await prisma.tutoria.findMany({
    where: { usuarioId },
    include: {
      jugador: {
        include: {
          tutorias: { select: { usuarioId: true } },
        },
      },
    },
  });
  const jugadoresHuerfanos: string[] = [];
  for (const t of tutorias) {
    if (t.jugador.usuarioId === usuarioId) continue;
    const otrosTutores = t.jugador.tutorias.filter((ot) => ot.usuarioId !== usuarioId);
    if (otrosTutores.length === 0) {
      const edad = calcularEdad(t.jugador.fechaNacimiento);
      if (edad < 18) {
        jugadoresHuerfanos.push(
          `${t.jugador.nombre} ${t.jugador.apellidos} (${edad} años)`
        );
      }
    }
  }
  if (jugadoresHuerfanos.length > 0) {
    return {
      error:
        `No se puede eliminar: este usuario es tutor único de jugadores menores de edad sin cuenta propia. ` +
        `Asigna antes otro tutor a: ${jugadoresHuerfanos.join(", ")}.`,
    };
  }

  const emailOriginal = usuario.email;
  const fotoKey = usuario.jugadorComoUsuario?.fotoUrl ?? null;

  // Conteos para auditoría.
  const [
    recibosCreadosCount,
    solicitudesCreadasCount,
    consentimientosCreadosCount,
    consentimientosFirmadosCount,
    invitacionesCreadasCount,
    invitacionesAceptadasCount,
    entrenadoresCreadosCount,
  ] = await Promise.all([
    prisma.recibo.count({ where: { creadoPorId: usuarioId } }),
    prisma.solicitudDocumento.count({ where: { creadoPorId: usuarioId } }),
    prisma.consentimiento.count({ where: { creadoPorId: usuarioId } }),
    prisma.consentimientoJugador.count({ where: { firmadoPorId: usuarioId } }),
    prisma.invitacion.count({ where: { creadaPorId: usuarioId } }),
    prisma.invitacion.count({ where: { usuarioAceptaId: usuarioId } }),
    prisma.entrenador.count({ where: { creadoPorId: usuarioId } }),
  ]);

  // Transacción: todas las operaciones de BD de forma atómica.
  await prisma.$transaction(async (tx) => {
    // 1. Si tiene Jugador vinculado, anonimizarlo (conservando la fila como FK).
    if (usuario.jugadorComoUsuario) {
      const jugadorId = usuario.jugadorComoUsuario.id;
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
          usuarioId: null,
        },
      });
      // Si algún Entrenador usaba este Jugador, desvincular.
      await tx.entrenador.updateMany({
        where: { jugadorId },
        data: { jugadorId: null },
      });
    }

    // 2. Si tiene Entrenador vinculado, anonimizar y eliminar asignaciones.
    if (usuario.entrenadorComoUsuario) {
      const entrenadorId = usuario.entrenadorComoUsuario.id;
      await tx.entrenadorEquipo.deleteMany({ where: { entrenadorId } });
      await tx.entrenador.update({
        where: { id: entrenadorId },
        data: {
          nombre: "[Eliminado RGPD]",
          apellidos: "",
          email: null,
          telefono: null,
          telefonoAlternativo: null,
          observaciones: null,
          activo: false,
          usuarioId: null,
        },
      });
    }

    // 3. Eliminar Tutorias y PasswordResetTokens (también cascade, pero explícito).
    await tx.tutoria.deleteMany({ where: { usuarioId } });
    await tx.passwordResetToken.deleteMany({ where: { usuarioId } });

    // 4. Nulear todas las FKs autor.
    await tx.recibo.updateMany({
      where: { creadoPorId: usuarioId },
      data: { creadoPorId: null },
    });
    await tx.solicitudDocumento.updateMany({
      where: { creadoPorId: usuarioId },
      data: { creadoPorId: null },
    });
    await tx.consentimiento.updateMany({
      where: { creadoPorId: usuarioId },
      data: { creadoPorId: null },
    });
    await tx.entrenador.updateMany({
      where: { creadoPorId: usuarioId },
      data: { creadoPorId: null },
    });
    await tx.pendingRegistration.updateMany({
      where: { creadoPorId: usuarioId },
      data: { creadoPorId: null },
    });
    await tx.invitacion.updateMany({
      where: { creadaPorId: usuarioId },
      data: { creadaPorId: null },
    });
    await tx.invitacion.updateMany({
      where: { usuarioAceptaId: usuarioId },
      data: { usuarioAceptaId: null },
    });

    // 5. Consentimientos firmados: anonimizar firmante y revocar si estaban firmados.
    await tx.consentimientoJugador.updateMany({
      where: { firmadoPorId: usuarioId },
      data: {
        firmadoPorId: null,
        firmadoPorNombre: "[Eliminado RGPD]",
        firmadoPorEmail: null,
        revocadoAt: new Date(),
        revocadoMotivo: "ELIMINACION_RGPD",
      },
    });

    // 6. Anonimizar el propio Usuario antes de eliminarlo.
    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        nombre: "[Eliminado RGPD]",
        apellidos: "",
        email: null,
        telefono: null,
        telefonoAlternativo: null,
        fechaNacimiento: null,
        dniNie: null,
        passwordHash: null,
        emailVerificado: false,
      },
    });

    // 7. Auditoría con snapshot del sujeto afectado.
    await tx.auditoriaRGPD.create({
      data: {
        sujetoTipo: "USUARIO",
        sujetoAfectadoId: usuarioId,
        sujetoAfectadoEmail: emailOriginal,
        sujetoAfectadoNombre: `${usuario.nombre} ${usuario.apellidos}`.trim(),
        ejecutadoPorId: session.user.id,
        accion: "ELIMINACION_USUARIO_RGPD",
        detalle: {
          jugadorAnonimizadoId: usuario.jugadorComoUsuario?.id ?? null,
          entrenadorAnonimizadoId: usuario.entrenadorComoUsuario?.id ?? null,
          tutoriasEliminadas: tutorias.length,
          consentimientosRevocados: consentimientosFirmadosCount,
          fksNuleadas: {
            recibosCreados: recibosCreadosCount,
            solicitudesCreadas: solicitudesCreadasCount,
            consentimientosCreados: consentimientosCreadosCount,
            invitacionesCreadas: invitacionesCreadasCount,
            invitacionesAceptadas: invitacionesAceptadasCount,
            entrenadoresCreados: entrenadoresCreadosCount,
          },
        },
      },
    });

    // 8. Eliminar el Usuario anonimizado.
    await tx.usuario.delete({ where: { id: usuarioId } });
  });

  // Fuera de la transacción: borrar la foto del Jugador en S3 (best-effort).
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

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/padres");
  revalidatePath("/admin/jugadores");
  revalidatePath("/admin/entrenadores");
  redirect("/admin/usuarios");
}
