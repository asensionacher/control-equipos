"use server";

import { render } from "@react-email/render";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jugadorEditTutorSchema } from "@/lib/validaciones";
import { enviarEmail } from "@/lib/email";
import { getLogoClubEmailUrl } from "@/lib/email-branding";
import { PlantillaActivacionCuenta } from "@/emails/plantilla-activacion-cuenta";
import { calcularEdad } from "@/lib/utils";
import {
  actualizarFotoJugador,
  validarFotoFormulario,
} from "@/lib/foto-jugador";

const APP_URL =
  process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";
const DIAS_EXPIRACION = 7;

export async function editarJugadorTutor(
  jugadorId: string,
  formData: FormData
): Promise<{ error?: string; success?: string; devLink?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  // Verificar que el usuario es tutor del jugador O es su propia ficha
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

  // El sexo se envía como hidden input. Si no viene, undefined.
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const errorFoto = await validarFotoFormulario(formData);
  if (errorFoto) return { error: errorFoto };

  const data = parsed.data;
  const emailNorm = data.email?.toLowerCase().trim() || null;
  const esMayorEdad = calcularEdad(new Date(data.fechaNacimiento)) >= 18;
  let tieneActivacionExistente = false;

  // Comprobar que el DNI no esté en uso por OTRO jugador
  if (data.dniNie) {
    const dniEnUso = await prisma.jugador.findFirst({
      where: { dniNie: data.dniNie, NOT: { id: jugadorId } },
    });
    if (dniEnUso) return { error: "Ya existe otro jugador con ese DNI/NIE" };
  }

  if (esTutor && esMayorEdad && emailNorm && !jugador.usuarioId) {
    const [usuarioConEmail, pendingConEmail] = await Promise.all([
      prisma.usuario.findUnique({
        where: { email: emailNorm },
        select: { id: true },
      }),
      prisma.pendingRegistration.findUnique({
        where: { email: emailNorm },
      }),
    ]);
    if (usuarioConEmail) {
      return {
        error:
          "Ese email ya pertenece a otra cuenta. Introduce el correo personal del jugador.",
      };
    }
    if (
      pendingConEmail &&
      !pendingConEmail.usado &&
      pendingConEmail.expiresAt > new Date() &&
      pendingConEmail.jugadorId !== jugadorId
    ) {
      return { error: "Ese email ya tiene otra activación pendiente" };
    }
    tieneActivacionExistente = Boolean(
      pendingConEmail &&
      !pendingConEmail.usado &&
      pendingConEmail.expiresAt > new Date() &&
      pendingConEmail.jugadorId === jugadorId
    );
  }

  await prisma.jugador.update({
    where: { id: jugadorId },
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      fechaNacimiento: new Date(data.fechaNacimiento),
      dniNie: data.dniNie || null,
      email: emailNorm,
      telefono: data.telefono || null,
      telefonoAlternativo: data.telefonoAlternativo || null,
      direccion: data.direccion || null,
      sexo: sexoValido,
    },
  });

  const errorSubidaFoto = await actualizarFotoJugador(jugadorId, formData);
  if (errorSubidaFoto) return { error: errorSubidaFoto };

  let devLink: string | undefined;
  let mensajeActivacion = "";
  if (
    esTutor &&
    esMayorEdad &&
    emailNorm &&
    !jugador.usuarioId &&
    !tieneActivacionExistente
  ) {
    try {
      await prisma.pendingRegistration.updateMany({
        where: { jugadorId, usado: false },
        data: { usado: true, fechaUso: new Date() },
      });
      const pendingConEmail = await prisma.pendingRegistration.findUnique({
        where: { email: emailNorm },
      });
      if (pendingConEmail) {
        await prisma.pendingRegistration.delete({ where: { id: pendingConEmail.id } });
      }

      const pending = await prisma.pendingRegistration.create({
        data: {
          email: emailNorm,
          nombre: data.nombre,
          apellidos: data.apellidos,
          telefono: data.telefono || null,
          jugadorId,
          expiresAt: new Date(
            Date.now() + DIAS_EXPIRACION * 24 * 60 * 60 * 1000
          ),
        },
      });
      const urlActivacion = `${APP_URL}/activar-cuenta/${pending.token}`;
      const html = await render(
        PlantillaActivacionCuenta({
          nombreDestino: data.nombre,
          urlActivacion,
          diasExpiracion: DIAS_EXPIRACION,
          nombreClub: APP_NAME,
          motivo: "jugador",
          logoUrl: await getLogoClubEmailUrl(),
        })
      );
      const resultadoEmail = await enviarEmail({
        to: emailNorm,
        subject: `Confirma tu email y activa tu cuenta en ${APP_NAME}`,
        html,
      });
      if (resultadoEmail.ok) {
        mensajeActivacion = ` Se ha enviado un email de confirmación a ${emailNorm}.`;
      } else {
        mensajeActivacion =
          " El email no pudo enviarse porque el servicio no está configurado.";
        devLink = urlActivacion;
      }
    } catch (error) {
      console.error("[jugador] Error creando la activación del jugador adulto:", error);
      return {
        error:
          "Los datos se han guardado, pero no se pudo generar el email de confirmación.",
      };
    }
  }

  revalidatePath(`/dashboard/jugadores/${jugadorId}`);
  revalidatePath("/dashboard");
  revalidatePath(`/admin/jugadores/${jugadorId}`);
  return {
    success: `Datos del jugador actualizados correctamente.${mensajeActivacion}`,
    devLink,
  };
}

export async function desvincularJugadorAdulto(
  jugadorId: string
): Promise<{ error?: string; success?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const jugador = await prisma.jugador.findUnique({
    where: { id: jugadorId },
    include: {
      tutorias: { where: { usuarioId: session.user.id }, select: { id: true } },
      pendingRegistrations: {
        where: { usado: false, expiresAt: { gt: new Date() } },
        select: { id: true, email: true },
      },
    },
  });
  if (!jugador || jugador.tutorias.length === 0) {
    return { error: "No eres tutor de este jugador" };
  }
  if (calcularEdad(jugador.fechaNacimiento) < 18) {
    return { error: "Solo se puede desvincular a jugadores mayores de edad" };
  }
  const email = jugador.email?.toLowerCase().trim();
  if (!email) {
    return { error: "Asigna primero un correo personal al jugador" };
  }
  const tieneCuentaOConfirmacion =
    Boolean(jugador.usuarioId) ||
    jugador.pendingRegistrations.some(
      (pending) => pending.email.toLowerCase() === email
    );
  if (!tieneCuentaOConfirmacion) {
    return {
      error:
        "Guarda primero el correo personal del jugador para enviarle la confirmación.",
    };
  }

  await prisma.tutoria.delete({
    where: {
      jugadorId_usuarioId: {
        jugadorId,
        usuarioId: session.user.id,
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/jugadores/${jugadorId}`);
  revalidatePath(`/admin/jugadores/${jugadorId}`);
  return { success: "Jugador desvinculado correctamente" };
}
