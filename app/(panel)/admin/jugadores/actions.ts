"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { render } from "@react-email/render";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { jugadorSchema, jugadorEditTutorSchema } from "@/lib/validaciones";
import { enviarEmail } from "@/lib/email";
import { PlantillaInvitacion } from "../../../../emails/plantilla-invitacion";

const APP_URL = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";

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
    direccion: string | null;
    fotoUrl: string | null;
    sexo: "MASCULINO" | "FEMENINO" | "OTRO" | null;
    tutorUsuarioId: string | null;
    parentescoTutor: string | null;
    emailContactoTutor: string | null;
    telefonoContactoTutor: string | null;
  };
  mensajeInvitacion?: string;
}

export async function crearJugador(datos: CrearJugadorParams): Promise<{ error?: string; success?: string; jugadorId?: string }> {
  const session = await requireAdmin();

  const parsed = jugadorSchema.safeParse({
    nombre: datos.jugador.nombre,
    apellidos: datos.jugador.apellidos,
    fechaNacimiento: datos.jugador.fechaNacimiento,
    dniNie: datos.jugador.dniNie ?? "",
    email: datos.jugador.email ?? "",
    telefono: datos.jugador.telefono ?? "",
    direccion: datos.jugador.direccion ?? "",
    fotoUrl: datos.jugador.fotoUrl ?? "",
    sexo: datos.jugador.sexo,
    tutorUsuarioId: datos.jugador.tutorUsuarioId ?? "",
    parentescoTutor: datos.jugador.parentescoTutor ?? "",
    emailContactoTutor: datos.jugador.emailContactoTutor ?? "",
    telefonoContactoTutor: datos.jugador.telefonoContactoTutor ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;
  const dni = data.dniNie || null;
  if (dni) {
    const existe = await prisma.jugador.findUnique({ where: { dniNie: dni } });
    if (existe) return { error: "Ya existe un jugador con ese DNI/NIE" };
  }

  // Determinar el tutor:
  // 1) Si se especifica tutorUsuarioId directamente
  // 2) Si no, intentar auto-vincular por email del jugador o email de contacto del tutor
  let tutorUsuarioId = data.tutorUsuarioId || null;
  let parentescoTutor = data.parentescoTutor || null;

  if (!tutorUsuarioId) {
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
      direccion: data.direccion || null,
      fotoUrl: data.fotoUrl || null,
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
    if (tutor) {
      const html = await render(
        PlantillaInvitacion({
          nombreDestino: tutor.nombre,
          nombreJugador: `${jugador.nombre} ${jugador.apellidos}`,
          tipoInvitacion: "VINCULACION",
          nombreAdmin: `${session.user.nombre} ${session.user.apellidos}`,
          nombreClub: APP_NAME,
          urlInvitacion: `${APP_URL}/dashboard`,
          mensaje: datos.mensajeInvitacion ?? "Se ha añadido un nuevo jugador a tu cuenta. Inicia sesión para verlo.",
        })
      );
      await enviarEmail({
        to: tutor.email,
        subject: `Nuevo jugador añadido a tu cuenta - ${APP_NAME}`,
        html,
      });
    }

    // Si fue auto-vinculado por email, avisamos al admin
    const fueAutoVinculado = !datos.jugador.tutorUsuarioId && tutorUsuarioId;
    if (fueAutoVinculado) {
      avisoVinculacion = `Se vinculó automáticamente al usuario existente con email ${data.email || data.emailContactoTutor}.`;
    }
  }

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
  datos: CrearJugadorParams["jugador"]
): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  const parsed = jugadorSchema.safeParse({
    nombre: datos.nombre,
    apellidos: datos.apellidos,
    fechaNacimiento: datos.fechaNacimiento,
    dniNie: datos.dniNie ?? "",
    email: datos.email ?? "",
    telefono: datos.telefono ?? "",
    direccion: datos.direccion ?? "",
    fotoUrl: datos.fotoUrl ?? "",
    sexo: datos.sexo,
    tutorUsuarioId: datos.tutorUsuarioId ?? "",
    parentescoTutor: datos.parentescoTutor ?? "",
    emailContactoTutor: datos.emailContactoTutor ?? "",
    telefonoContactoTutor: datos.telefonoContactoTutor ?? "",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const data = parsed.data;
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
      direccion: data.direccion || null,
      fotoUrl: data.fotoUrl || null,
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
      },
    });
    // Sincronizar también al Jugador desde Usuario (por si el helper debe prevalecer)
    await prisma.jugador.update({
      where: { id },
      data: {
        email: data.email || null,
        telefono: data.telefono || null,
      },
    });
  }

  // Actualizar tutor (relación Tutoria)
  const nuevaTutoriaId = data.tutorUsuarioId || null;
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
    // Quitar tutor principal
    await prisma.tutoria.delete({ where: { id: tutoriaActual.id } });
  }

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
    direccion: formData.get("direccion") || "",
    fotoUrl: formData.get("fotoUrl") || "",
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
      direccion: parsed.data.direccion || null,
      fotoUrl: parsed.data.fotoUrl || null,
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
