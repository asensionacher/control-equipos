"use server";

import { render } from "@react-email/render";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";
import { activarCuentaSchema } from "@/lib/validaciones";
import { PlantillaActivacionCuenta } from "@/emails/plantilla-activacion-cuenta";

const APP_URL = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";
const DIAS_EXPIRACION = 7;

interface CrearPendingPadreParams {
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string | null;
  telefonoAlternativo?: string | null;
  jugadorParaVincularId?: string;
  jugadorParaVincularNombre?: string;
}

/**
 * Crea un Usuario (padre/tutor) sin passwordHash y un PendingRegistration
 * con un token. Envía email para que active su cuenta.
 */
export async function crearPadreConActivacion(
  params: CrearPendingPadreParams
): Promise<{ error?: string; success?: string; usuarioId?: string; devLink?: string }> {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") {
    return { error: "No autorizado" };
  }

  // Verificar que el admin de la sesión realmente existe en la BD.
  // Si el JWT contiene un id obsoleto (por ejemplo, porque la BD se reseteó),
  // debemos informar al usuario para que vuelva a iniciar sesión.
  const adminExiste = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true },
  });
  if (!adminExiste || adminExiste.rol !== "ADMIN") {
    return {
      error:
        "Tu sesión ha caducado o tu cuenta ya no existe. Cierra sesión e inicia sesión de nuevo.",
    };
  }

  const emailNorm = params.email.toLowerCase().trim();

  const existeUsuario = await prisma.usuario.findUnique({ where: { email: emailNorm } });
  if (existeUsuario) return { error: "Ya existe un usuario con ese email" };

  const existePendiente = await prisma.pendingRegistration.findUnique({ where: { email: emailNorm } });
  if (existePendiente && !existePendiente.usado && existePendiente.expiresAt > new Date()) {
    return {
      error:
        "Ya hay una activación pendiente para este email. Reenvía el email desde la ficha del padre.",
    };
  }

  // Limpiar pendientes caducados o usados con este email
  if (existePendiente) {
    await prisma.pendingRegistration.delete({ where: { id: existePendiente.id } });
  }

  // Crear el Usuario (sin passwordHash).
  const usuario = await prisma.usuario.create({
    data: {
      email: emailNorm,
      nombre: params.nombre,
      apellidos: params.apellidos,
      telefono: params.telefono ?? null,
      telefonoAlternativo: params.telefonoAlternativo ?? null,
      passwordHash: null,
      rol: "USUARIO",
      emailVerificado: false,
    },
  });

  let pending;
  try {
    pending = await prisma.pendingRegistration.create({
      data: {
        email: emailNorm,
        nombre: params.nombre,
        apellidos: params.apellidos,
        telefono: params.telefono ?? null,
        jugadorParaVincular: params.jugadorParaVincularId ?? null,
        creadoPorId: session.user.id,
        expiresAt: new Date(Date.now() + DIAS_EXPIRACION * 24 * 60 * 60 * 1000),
      },
    });
  } catch (err) {
    await prisma.usuario.delete({ where: { id: usuario.id } });
    throw err;
  }

  // Si hay jugadorParaVincularId, creamos ya la tutoría principal.
  if (params.jugadorParaVincularId) {
    try {
      await prisma.tutoria.create({
        data: {
          jugadorId: params.jugadorParaVincularId,
          usuarioId: usuario.id,
          parentesco: null,
          esPrincipal: true,
        },
      });
    } catch (err) {
      console.warn("No se pudo vincular jugador al crear padre:", err);
    }
  }

  const urlActivacion = `${APP_URL}/activar-cuenta/${pending.token}`;

  const html = await render(
    PlantillaActivacionCuenta({
      nombreDestino: params.nombre,
      urlActivacion,
      diasExpiracion: DIAS_EXPIRACION,
      nombreClub: APP_NAME,
      motivo: "padre",
      nombreJugadorVinculado: params.jugadorParaVincularNombre,
    })
  );

  const result = await enviarEmail({
    to: emailNorm,
    subject: `Activa tu cuenta en ${APP_NAME}`,
    html,
  });

  revalidatePath("/admin/padres");
  revalidatePath(`/admin/padres/${usuario.id}`);

  if (!result.ok) {
    return {
      success: "Padre creado. Email no enviado (servicio no configurado).",
      usuarioId: usuario.id,
      devLink: urlActivacion,
    };
  }

  return {
    success: `Padre creado. Se ha enviado un email de activación a ${emailNorm}.`,
    usuarioId: usuario.id,
  };
}

/**
 * Si el jugador ya existe y no tiene tutor, le generamos una activación
 * (asumiendo que el admin conoce su email personal).
 */
export async function crearActivacionParaJugadorExistente(
  jugadorId: string,
  email: string
): Promise<{ error?: string; success?: string; devLink?: string }> {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") {
    return { error: "No autorizado" };
  }

  const emailNorm = email.toLowerCase().trim();

  const jugador = await prisma.jugador.findUnique({
    where: { id: jugadorId },
    include: { usuario: true },
  });
  if (!jugador) return { error: "Jugador no encontrado" };
  if (jugador.usuario) {
    return { error: "Este jugador ya tiene cuenta propia" };
  }

  // Verificar que el email no esté ya usado por un Usuario existente
  const existeUsuario = await prisma.usuario.findUnique({ where: { email: emailNorm } });
  if (existeUsuario) {
    if (existeUsuario.rol !== "USUARIO") {
      return { error: "Ya existe un usuario con ese email" };
    }
    await prisma.jugador.update({
      where: { id: jugadorId },
      data: { usuarioId: existeUsuario.id },
    });
    revalidatePath(`/admin/jugadores/${jugadorId}`);
    return {
      success: `El jugador ha sido vinculado a la cuenta existente con email ${emailNorm}.`,
    };
  }

  const existePendiente = await prisma.pendingRegistration.findUnique({ where: { email: emailNorm } });
  if (existePendiente && !existePendiente.usado && existePendiente.expiresAt > new Date()) {
    return { error: "Ya hay una activación pendiente para ese email" };
  }
  if (existePendiente) {
    await prisma.pendingRegistration.delete({ where: { id: existePendiente.id } });
  }

  // Verificar que el admin de la sesión existe en BD
  const adminExiste = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true },
  });
  if (!adminExiste || adminExiste.rol !== "ADMIN") {
    return {
      error:
        "Tu sesión ha caducado o tu cuenta ya no existe. Cierra sesión e inicia sesión de nuevo.",
    };
  }

  const pending = await prisma.pendingRegistration.create({
    data: {
      email: emailNorm,
      nombre: jugador.nombre,
      apellidos: jugador.apellidos,
      telefono: jugador.telefono,
      jugadorId,
      creadoPorId: session.user.id,
      expiresAt: new Date(Date.now() + DIAS_EXPIRACION * 24 * 60 * 60 * 1000),
    },
  });

  const urlActivacion = `${APP_URL}/activar-cuenta/${pending.token}`;

  const html = await render(
    PlantillaActivacionCuenta({
      nombreDestino: jugador.nombre,
      urlActivacion,
      diasExpiracion: DIAS_EXPIRACION,
      nombreClub: APP_NAME,
      motivo: "jugador",
    })
  );

  const result = await enviarEmail({
    to: emailNorm,
    subject: `Activa tu cuenta de jugador en ${APP_NAME}`,
    html,
  });

  revalidatePath(`/admin/jugadores/${jugadorId}`);

  if (!result.ok) {
    return {
      success: "Activación generada. Email no enviado (servicio no configurado).",
      devLink: urlActivacion,
    };
  }

  return {
    success: `Email de activación enviado a ${emailNorm}.`,
  };
}

/**
 * Acción ejecutada cuando el usuario hace clic en el enlace y rellena su contraseña.
 * Crea o actualiza el Usuario con la contraseña introducida, marca el pending como usado
 * y vincula al jugador si corresponde.
 */
export async function activarCuenta(
  token: string,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = activarCuentaSchema.safeParse({
    password: formData.get("password"),
    confirmarPassword: formData.get("confirmarPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const pending = await prisma.pendingRegistration.findUnique({ where: { token } });

  if (!pending || pending.usado || pending.expiresAt < new Date()) {
    return { error: "El enlace no es válido o ha caducado" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  // Crear el Usuario o reutilizar si ya existe
  let usuario;
  const existeUsuario = await prisma.usuario.findUnique({ where: { email: pending.email } });
  if (existeUsuario) {
    usuario = await prisma.usuario.update({
      where: { id: existeUsuario.id },
      data: { passwordHash, emailVerificado: true },
    });
  } else {
    usuario = await prisma.usuario.create({
      data: {
        email: pending.email,
        nombre: pending.nombre,
        apellidos: pending.apellidos,
        telefono: pending.telefono,
        passwordHash,
        rol: "USUARIO",
        emailVerificado: true,
      },
    });
  }

  // Si el pending trae jugadorId, vincular ese jugador al usuario (cuenta propia del jugador)
  if (pending.jugadorId) {
    await prisma.jugador.update({
      where: { id: pending.jugadorId },
      data: { usuarioId: usuario.id },
    });
  }

  await prisma.pendingRegistration.update({
    where: { id: pending.id },
    data: { usado: true, fechaUso: new Date() },
  });

  return {};
}

/**
 * Reenvía el email de activación al padre. Invalida tokens previos pendientes
 * y crea uno nuevo.
 */
export async function reenviarActivacionPadre(
  usuarioId: string
): Promise<{ error?: string; success?: string; devLink?: string }> {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") {
    return { error: "No autorizado" };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return { error: "Usuario no encontrado" };
  if (usuario.passwordHash) {
    return { error: "Este usuario ya tiene contraseña. No se puede reenviar activación." };
  }
  if (!usuario.email) {
    return { error: "Este usuario no tiene email. Asígnale uno primero." };
  }

  await prisma.pendingRegistration.updateMany({
    where: { email: usuario.email, usado: false },
    data: { usado: true, fechaUso: new Date() },
  });

  const tutoria = await prisma.tutoria.findFirst({
    where: { usuarioId: usuario.id, esPrincipal: true },
    include: { jugador: true },
  });

  // Verificar que el admin de la sesión existe en BD
  const adminExiste = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true },
  });
  if (!adminExiste || adminExiste.rol !== "ADMIN") {
    return {
      error:
        "Tu sesión ha caducado o tu cuenta ya no existe. Cierra sesión e inicia sesión de nuevo.",
    };
  }

  const pending = await prisma.pendingRegistration.create({
    data: {
      email: usuario.email,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      telefono: usuario.telefono,
      jugadorParaVincular: tutoria?.jugadorId ?? null,
      creadoPorId: session.user.id,
      expiresAt: new Date(Date.now() + DIAS_EXPIRACION * 24 * 60 * 60 * 1000),
    },
  });

  const urlActivacion = `${APP_URL}/activar-cuenta/${pending.token}`;

  const html = await render(
    PlantillaActivacionCuenta({
      nombreDestino: usuario.nombre,
      urlActivacion,
      diasExpiracion: DIAS_EXPIRACION,
      nombreClub: APP_NAME,
      motivo: "padre",
      nombreJugadorVinculado: tutoria ? `${tutoria.jugador.nombre} ${tutoria.jugador.apellidos}` : undefined,
    })
  );

  const result = await enviarEmail({
    to: usuario.email,
    subject: `Activa tu cuenta en ${APP_NAME}`,
    html,
  });

  if (!result.ok) {
    return {
      success: "Activación regenerada. Email no enviado (servicio no configurado).",
      devLink: urlActivacion,
    };
  }

  return { success: `Email de activación reenviado a ${usuario.email}` };
}

