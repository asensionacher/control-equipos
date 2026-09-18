"use server";

import { render } from "@react-email/render";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { wizardUsuarioSchema } from "@/lib/validaciones";
import { enviarEmail } from "@/lib/email";
import { PlantillaActivacionCuenta } from "@/emails/plantilla-activacion-cuenta";

const APP_URL =
  process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";
const DIAS_EXPIRACION = 7;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  return session;
}

interface CrearUsuarioParams {
  formData: FormData;
}

function parseFlags(formData: FormData) {
  return {
    esPadre: formData.get("esPadre") === "on",
    esJugador: formData.get("esJugador") === "on",
    esEntrenador: formData.get("esEntrenador") === "on",
    crearPerfilJugador: formData.get("crearPerfilJugador") !== "off",
    emailVerificado: formData.get("emailVerificado") === "on",
  };
}

function parseList(formData: FormData, key: string): string[] {
  const v = formData.getAll(key);
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export async function crearUsuarioWizard({
  formData,
}: CrearUsuarioParams): Promise<{ error?: string; usuarioId?: string }> {
  const session = await requireAdmin();
  const flags = parseFlags(formData);

  const emailRaw = ((formData.get("email") as string) || "").toLowerCase().trim();
  const fechaNacimientoRaw = ((formData.get("fechaNacimiento") as string) || "").trim();
  const dniNie = ((formData.get("dniNie") as string) || "").trim();

  const payload = {
    nombre: (formData.get("nombre") as string) || "",
    apellidos: (formData.get("apellidos") as string) || "",
    email: emailRaw,
    fechaNacimiento: fechaNacimientoRaw,
    dniNie,
    telefono: (formData.get("telefono") as string) || "",
    telefonoAlternativo: (formData.get("telefonoAlternativo") as string) || "",
    rol: ((formData.get("rol") as string) || "USUARIO") as "ADMIN" | "USUARIO",
    emailVerificado: flags.emailVerificado,
    esPadre: flags.esPadre,
    esJugador: flags.esJugador,
    esEntrenador: flags.esEntrenador,
    crearPerfilJugador: flags.crearPerfilJugador,
    jugadorExistenteId: (formData.get("jugadorExistenteId") as string) || "",
    jugadoresACargoIds: parseList(formData, "jugadoresACargoIds"),
    equiposComoJugadorIds: parseList(formData, "equiposComoJugadorIds"),
    equiposComoEntrenadorIds: parseList(formData, "equiposComoEntrenadorIds"),
  };

  const parsed = wizardUsuarioSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  if (data.rol === "ADMIN" && !data.emailVerificado) {
    // Para administradores seguimos requiriendo verificación manual antes de crearlo.
  }

  const existe = await prisma.usuario.findUnique({ where: { email: data.email } });
  if (existe) {
    return { error: "Ya existe un usuario con ese email" };
  }
  if (data.dniNie) {
    const dniDuplicadoUsuario = await prisma.usuario.findUnique({
      where: { dniNie: data.dniNie },
    });
    if (dniDuplicadoUsuario) {
      return { error: "Ya existe un usuario con ese DNI/NIE" };
    }
    const dniDuplicadoJugador = await prisma.jugador.findUnique({
      where: { dniNie: data.dniNie },
    });
    if (dniDuplicadoJugador) {
      return { error: "Ya existe un jugador con ese DNI/NIE" };
    }
  }

  // Si va a crear perfil de jugador y pidió DNI, validar unicidad ya cubierta arriba.
  // Si va a vincular Jugador existente y pidió DNI, copiarlo al Jugador si el Jugador no tiene.
  // (Ver abajo)

  const usuario = await prisma.usuario.create({
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      email: data.email || null,
      telefono: data.telefono || null,
      telefonoAlternativo: data.telefonoAlternativo || null,
      fechaNacimiento: data.fechaNacimiento || null,
      dniNie: data.dniNie || null,
      rol: data.rol,
      // No generamos password aquí: el usuario fija la suya vía email.
      passwordHash: null,
      // Si el admin marcó emailVerificado explícitamente, respetamos.
      // Si no y hay email, lo dejamos pendiente.
      // Si NO hay email, queda false (sin verificación posible).
      emailVerificado:
        data.emailVerificado ?? (data.email ? false : data.rol === "ADMIN"),
    },
  });

  // === Rol: PADRE ===
  if (data.esPadre) {
    for (const jugadorId of data.jugadoresACargoIds) {
      const yaTutela = await prisma.tutoria.findUnique({
        where: { jugadorId_usuarioId: { jugadorId, usuarioId: usuario.id } },
      });
      if (yaTutela) continue;
      await prisma.tutoria.create({
        data: {
          jugadorId,
          usuarioId: usuario.id,
          parentesco: "Padre/Madre",
          esPrincipal: true,
        },
      });
    }
  }

  // === Rol: JUGADOR ===
  if (data.esJugador) {
if (data.crearPerfilJugador) {
        const existente = await prisma.jugador.findUnique({
          where: { usuarioId: usuario.id },
        });
        if (!existente) {
          await prisma.jugador.create({
            data: {
              nombre: data.nombre,
              apellidos: data.apellidos,
              fechaNacimiento: new Date(data.fechaNacimiento!),
              dniNie: data.dniNie || null,
              email: data.email || null,
              telefono: data.telefono || null,
              telefonoAlternativo: data.telefonoAlternativo || null,
              usuarioId: usuario.id,
            },
          });
        }
    } else if (data.jugadorExistenteId) {
      const target = await prisma.jugador.findUnique({
        where: { id: data.jugadorExistenteId },
      });
      if (target && !target.usuarioId) {
        // Si el Usuario lleva DNI y el Jugador no, copiarlo.
        await prisma.jugador.update({
          where: { id: target.id },
          data: {
            usuarioId: usuario.id,
            ...(data.dniNie && !target.dniNie ? { dniNie: data.dniNie } : {}),
            ...(data.fechaNacimiento && !target.fechaNacimiento
              ? { fechaNacimiento: new Date(data.fechaNacimiento) }
              : {}),
          },
        });
      }
    }
  }

  // === Asignaciones de equipo como jugador ===
  if (data.equiposComoJugadorIds.length > 0) {
    const jugador = await prisma.jugador.findUnique({
      where: { usuarioId: usuario.id },
    });
    if (jugador) {
      for (const equipoId of data.equiposComoJugadorIds) {
        await prisma.asignacionEquipo.upsert({
          where: { jugadorId_equipoId: { jugadorId: jugador.id, equipoId } },
          update: {},
          create: { jugadorId: jugador.id, equipoId },
        });
      }
    }
  }

  // === Rol: ENTRENADOR ===
  if (data.esEntrenador) {
    const entrenadorExistente = await prisma.entrenador.findUnique({
      where: { usuarioId: usuario.id },
    });
    let entrenadorId: string;
    if (entrenadorExistente) {
      entrenadorId = entrenadorExistente.id;
    } else {
      const creado = await prisma.entrenador.create({
        data: {
          nombre: data.nombre,
          apellidos: data.apellidos,
          email: data.email || null,
          telefono: data.telefono || null,
          telefonoAlternativo: data.telefonoAlternativo || null,
          usuarioId: usuario.id,
          creadoPorId: session.user.id,
        },
      });
      entrenadorId = creado.id;
    }
    const temporadaActiva = await prisma.temporada.findFirst({
      where: { activa: true },
      select: { id: true },
    });
    for (const equipoId of data.equiposComoEntrenadorIds) {
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
  }

  // === Activación por email ===
  // Solo enviamos activación si hay email y NO está verificado.
  // Si el admin marcó emailVerificado=true, el Usuario ya queda activo sin contraseña.
  // Si NO hay email, no podemos enviar activación (caso menor sin acceso al portal).
  if (usuario.email && !data.emailVerificado) {
    await crearPendingYEnviarEmail({
      email: usuario.email,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      telefono: usuario.telefono,
      creadoPorId: session.user.id,
      motivo: data.rol === "ADMIN" ? "admin" : "usuario",
    });
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/padres");
  revalidatePath("/admin/entrenadores");
  revalidatePath("/admin/jugadores");

  redirect(`/admin/usuarios/${usuario.id}`);
}

/**
 * Crea un PendingRegistration con token nuevo y envía el email de activación.
 * Reutilizable para creación inicial, reenvío, o cambio de email.
 *
 * Elimina cualquier pendiente previo del mismo email antes de crear el nuevo,
 * ya que `PendingRegistration.email` es `@unique` global (no parcial por `usado`).
 */
export async function crearPendingYEnviarEmail(params: {
  email: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  creadoPorId?: string | null;
  motivo?: "admin" | "padre" | "jugador" | "usuario";
}) {
  const { email, nombre, apellidos, telefono } = params;

  // Limpiar pendientes anteriores del mismo email.
  // El constraint es global sobre `email`, no sobre (email, usado: false),
  // así que marcar como usado no libera el slot único.
  await prisma.pendingRegistration.deleteMany({ where: { email } });

  const pending = await prisma.pendingRegistration.create({
    data: {
      email,
      nombre,
      apellidos,
      telefono: telefono ?? null,
      creadoPorId: params.creadoPorId ?? null,
      expiresAt: new Date(Date.now() + DIAS_EXPIRACION * 24 * 60 * 60 * 1000),
    },
  });

  const urlActivacion = `${APP_URL}/activar-cuenta/${pending.token}`;
  const html = await render(
    PlantillaActivacionCuenta({
      nombreDestino: nombre,
      urlActivacion,
      diasExpiracion: DIAS_EXPIRACION,
      nombreClub: APP_NAME,
      motivo: params.motivo ?? "usuario",
    })
  );

  const result = await enviarEmail({
    to: email,
    subject: `Activa tu cuenta en ${APP_NAME}`,
    html,
  });

  if (!result.ok) {
    // Dev mode sin Resend: el link se imprimirá en logs del servidor.
    console.warn(
      `[usuarios] No se pudo enviar email de activación a ${email}. Link: ${urlActivacion}`
    );
  }

  return { pendingId: pending.id, urlActivacion };
}
