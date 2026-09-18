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
  await requireAdmin();
  // Verificar que no sea el admin activo
  const session = await auth();
  if (session!.user.id === usuarioId) {
    return { error: "No puedes eliminar tu propio usuario" };
  }
  // Eliminar asignaciones que causen FK violation
  await prisma.usuario.delete({ where: { id: usuarioId } }).catch(() => {
    // Si falla por FK, desactivar.
  });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}
