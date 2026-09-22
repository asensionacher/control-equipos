"use server";

import bcrypt from "bcryptjs";
import { render } from "@react-email/render";
import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";
import { recuperarPasswordSchema, resetPasswordSchema } from "@/lib/validaciones";
import { PlantillaResetPassword } from "../../../emails/plantilla-reset-password";
import { notificarCambioSeguridad } from "@/lib/security-notification";

const APP_URL = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";
const MINUTOS_EXPIRACION = 60;

export async function solicitarResetPassword(
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const parsed = recuperarPasswordSchema.safeParse({
    email: (formData.get("email") as string | null)?.trim().toLowerCase(),
  });

  if (!parsed.success) {
    return { error: "Email inválido" };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: parsed.data.email },
  });

  // Por seguridad, no revelamos si el email existe o no.
  // Pero si no hay servicio de email configurado, no podemos hacer nada útil.
  if (!resend_configured() && !usuario) {
    return { error: "Servicio de email no configurado. Contacta con el administrador." };
  }

  if (!usuario) {
    // Mensaje neutro para no filtrar información
    return {
      success: "Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.",
    };
  }

  // Si el usuario no tiene email (caso menor sin acceso al portal), no hay nada que enviar.
  if (!usuario.email) {
    return {
      success: "Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.",
    };
  }

  // Invalidar tokens previos no usados del usuario
  await prisma.passwordResetToken.updateMany({
    where: { usuarioId: usuario.id, usado: false },
    data: { usado: true, fechaUso: new Date() },
  });

  const tokenRecord = await prisma.passwordResetToken.create({
    data: {
      usuarioId: usuario.id,
      expiresAt: new Date(Date.now() + MINUTOS_EXPIRACION * 60 * 1000),
    },
  });

  const urlReset = `${APP_URL}/reset-password/${tokenRecord.token}`;

  const html = await render(
    PlantillaResetPassword({
      nombreDestino: usuario.nombre,
      urlReset,
      minutosExpiracion: MINUTOS_EXPIRACION,
      nombreClub: APP_NAME,
    })
  );

  const result = await enviarEmail({
    to: usuario.email,
    subject: `Restablece tu contraseña - ${APP_NAME}`,
    html,
  });

  if (!result.ok) {
    // Si falla el envío pero hay token creado, lo devolvemos en consola para desarrollo
    console.warn(`[reset] Email no enviado a ${usuario.email}. Link: ${urlReset}`);
    return {
      success: `Email no enviado (servicio no configurado). En desarrollo, usa este enlace: ${urlReset}`,
    };
  }

  return {
    success: "Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.",
  };
}

export async function resetearPassword(
  token: string,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmarPassword: formData.get("confirmarPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { usuario: true },
  });

  if (!tokenRecord || tokenRecord.usado || tokenRecord.expiresAt < new Date()) {
    return { error: "El enlace no es válido o ha caducado" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: tokenRecord.usuarioId },
      data: { passwordHash, authVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usado: true, fechaUso: new Date() },
    }),
    prisma.auditoriaSeguridad.create({
      data: {
        accion: "PASSWORD_RESTABLECIDA",
        usuarioAfectadoId: tokenRecord.usuarioId,
      },
    }),
  ]);
  await notificarCambioSeguridad({
    email: tokenRecord.usuario.email,
    nombre: tokenRecord.usuario.nombre,
    descripcion: "Se ha restablecido la contraseña de tu cuenta.",
  });

  return {};
}

function resend_configured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
