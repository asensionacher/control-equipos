"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth, authForMfaSetup } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { perfilUsuarioSchema, cambioPasswordSchema } from "@/lib/validaciones";
import { sincronizarDatosPersonalesUsuario } from "@/lib/jugador-sync";
import {
  cifrarSecret,
  descifrarSecret,
  generarSecret,
  generarQrDataUrl,
  generarOtpAuthUri,
  verificarTotp,
} from "@/lib/totp";
import {
  limpiarFallosAutenticacion,
  registrarAuditoriaSeguridad,
  registrarFalloAutenticacion,
} from "@/lib/auth-security";
import { notificarCambioSeguridad } from "@/lib/security-notification";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  return session;
}

async function requireMfaSetupUser() {
  const session = await authForMfaSetup();
  if (!session?.user) throw new Error("No autorizado");
  return session;
}

export async function actualizarPerfil(
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const session = await requireUser();

  const parsed = perfilUsuarioSchema.safeParse({
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    telefono: formData.get("telefono") || "",
    telefonoAlternativo: formData.get("telefonoAlternativo") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.usuario.update({
    where: { id: session.user.id },
    data: {
      nombre: parsed.data.nombre,
      apellidos: parsed.data.apellidos,
      telefono: parsed.data.telefono || null,
      telefonoAlternativo: parsed.data.telefonoAlternativo || null,
      // El email NO se puede cambiar desde aquí. Solo un admin puede hacerlo.
    },
  });

  // Sincronizar con el Jugador asociado (si existe) y con los Jugadores tutorados
  await sincronizarDatosPersonalesUsuario(session.user.id);

  revalidatePath("/perfil");
  revalidatePath("/admin");
  revalidatePath("/admin/padres");
  revalidatePath("/dashboard");
  return { success: "Perfil actualizado correctamente" };
}

export async function cambiarPassword(
  formData: FormData
): Promise<{ error?: string; success?: string; reauthenticate?: boolean }> {
  const session = await requireUser();

  const parsed = cambioPasswordSchema.safeParse({
    passwordActual: formData.get("passwordActual"),
    passwordNueva: formData.get("passwordNueva"),
    confirmarPassword: formData.get("confirmarPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id } });
  if (!usuario || !usuario.passwordHash) {
    return { error: "Usuario no encontrado" };
  }

  const actualValida = await bcrypt.compare(parsed.data.passwordActual, usuario.passwordHash);
  if (!actualValida) return { error: "La contraseña actual no es correcta" };

  const passwordHash = await bcrypt.hash(parsed.data.passwordNueva, 10);
  await prisma.usuario.update({
    where: { id: session.user.id },
    data: { passwordHash, authVersion: { increment: 1 } },
  });
  await registrarAuditoriaSeguridad({
    accion: "CAMBIO_PASSWORD_PROPIO",
    ejecutadoPorId: session.user.id,
    usuarioAfectadoId: session.user.id,
  });
  await notificarCambioSeguridad({
    email: usuario.email,
    nombre: usuario.nombre,
    descripcion: "Se ha cambiado la contraseña de tu cuenta.",
  });

  return {
    success: "Contraseña actualizada. Vuelve a iniciar sesión.",
    reauthenticate: true,
  };
}

// ============================================================================
// Verificación en dos pasos (TOTP)
// ============================================================================

interface TotpSetupResult {
  qrDataUrl: string;
  secret: string;
  otpauthUri: string;
}

/**
 * Genera un nuevo secret TOTP, lo guarda (cifrado) en Usuario.totpSecret en
 * estado "pendiente de confirmar" — totpEnabled sigue siendo false hasta que
 * el usuario verifique el primer código. Devuelve el QR y el secret en claro
 * para que la UI lo muestre UNA sola vez.
 */
export async function iniciarSetupTotp(formData: FormData): Promise<
  { error?: string; setup?: TotpSetupResult }
> {
  const session = await requireMfaSetupUser();
  const passwordActual = String(formData.get("passwordActual") ?? "");
  if (!passwordActual) return { error: "Introduce tu contraseña actual" };
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      authLockedUntil: true,
      totpEnabled: true,
      nombre: true,
      apellidos: true,
    },
  });
  if (!usuario) return { error: "Usuario no encontrado" };
  if (!usuario.email) return { error: "Tu usuario no tiene email asociado" };
  if (usuario.authLockedUntil && usuario.authLockedUntil > new Date()) {
    return { error: "Demasiados intentos. Espera 15 minutos antes de reintentarlo." };
  }
  if (
    !usuario.passwordHash ||
    !(await bcrypt.compare(passwordActual, usuario.passwordHash))
  ) {
    await registrarFalloAutenticacion(usuario.id);
    return { error: "La contraseña actual no es correcta" };
  }
  await limpiarFallosAutenticacion(usuario.id);
  if (usuario.totpEnabled) {
    return { error: "El segundo factor ya está activado" };
  }

  const secret = generarSecret();
  const otpauthUri = generarOtpAuthUri(
    secret,
    usuario.email,
    `${usuario.nombre} ${usuario.apellidos}`.trim()
  );
  const qrDataUrl = await generarQrDataUrl(otpauthUri);

  await prisma.usuario.update({
    where: { id: session.user.id },
    data: { totpSecret: cifrarSecret(secret), totpEnabled: false },
  });

  return {
    setup: { qrDataUrl, secret, otpauthUri },
  };
}

/**
 * Confirma el primer código TOTP. Si es válido, marca totpEnabled=true.
 * Si no, deja totpSecret intacto (el usuario puede seguir probando).
 */
export async function confirmarTotp(
  code: string
): Promise<{ error?: string; success?: string; reauthenticate?: boolean }> {
  const session = await requireMfaSetupUser();
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      totpSecret: true,
      totpEnabled: true,
      authVersion: true,
      authLockedUntil: true,
      email: true,
      nombre: true,
    },
  });
  if (!usuario || !usuario.totpSecret) {
    return { error: "Inicia primero el proceso de activación" };
  }
  if (usuario.authLockedUntil && usuario.authLockedUntil > new Date()) {
    return { error: "Demasiados intentos. Espera 15 minutos antes de reintentarlo." };
  }
  if (usuario.totpEnabled) {
    return { error: "El segundo factor ya está activado" };
  }
  const secret = descifrarSecret(usuario.totpSecret);
  const verification = verificarTotp(secret, code);
  if (!verification.valid || verification.timeStep == null) {
    await registrarFalloAutenticacion(session.user.id);
    return { error: "Código incorrecto. Comprueba la hora del dispositivo." };
  }
  const updated = await prisma.usuario.updateMany({
    where: {
      id: session.user.id,
      authVersion: usuario.authVersion,
      totpEnabled: false,
    },
    data: {
      totpEnabled: true,
      lastAcceptedTotpStep: verification.timeStep,
      authVersion: { increment: 1 },
      authFailedAttempts: 0,
      authLockedUntil: null,
    },
  });
  if (updated.count !== 1) {
    return { error: "La configuración cambió. Inicia el proceso de nuevo." };
  }
  await registrarAuditoriaSeguridad({
    accion: "MFA_ACTIVADO",
    ejecutadoPorId: session.user.id,
    usuarioAfectadoId: session.user.id,
  });
  await notificarCambioSeguridad({
    email: usuario.email,
    nombre: usuario.nombre,
    descripcion: "Se ha activado la verificación en dos pasos de tu cuenta.",
  });
  revalidatePath("/perfil");
  return {
    success: "Verificación en dos pasos activada. Vuelve a iniciar sesión.",
    reauthenticate: true,
  };
}

/**
 * Desactiva el 2FA del propio usuario. Requiere password actual como
 * protección contra robo de sesión.
 */
export async function desactivarTotpPropio(
  formData: FormData
): Promise<{ error?: string; success?: string; reauthenticate?: boolean }> {
  const session = await requireUser();
  const passwordActual = String(formData.get("passwordActual") ?? "");
  const codigoTotp = String(formData.get("codigoTotp") ?? "");
  if (!passwordActual) return { error: "Introduce tu contraseña actual" };
  if (!/^\d{6}$/.test(codigoTotp)) {
    return { error: "Introduce el código actual de tu app autenticadora" };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      lastAcceptedTotpStep: true,
      authVersion: true,
      authLockedUntil: true,
      email: true,
      nombre: true,
    },
  });
  if (!usuario || !usuario.passwordHash) return { error: "Usuario no encontrado" };
  if (!usuario.totpEnabled) return { error: "El segundo factor no está activado" };
  if (usuario.authLockedUntil && usuario.authLockedUntil > new Date()) {
    return { error: "Demasiados intentos. Espera 15 minutos antes de reintentarlo." };
  }

  const ok = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!ok) {
    await registrarFalloAutenticacion(session.user.id);
    return { error: "La contraseña actual no es correcta" };
  }
  if (!usuario.totpSecret) return { error: "Configuración TOTP incompleta" };

  const verification = verificarTotp(
    descifrarSecret(usuario.totpSecret),
    codigoTotp,
    usuario.lastAcceptedTotpStep
  );
  if (!verification.valid || verification.timeStep == null) {
    await registrarFalloAutenticacion(session.user.id);
    return { error: "El código TOTP es incorrecto o ya se ha utilizado" };
  }

  const updated = await prisma.usuario.updateMany({
    where: {
      id: session.user.id,
      authVersion: usuario.authVersion,
      totpEnabled: true,
      OR: [
        { lastAcceptedTotpStep: null },
        { lastAcceptedTotpStep: { lt: verification.timeStep } },
      ],
    },
    data: {
      totpEnabled: false,
      totpSecret: null,
      lastAcceptedTotpStep: null,
      authVersion: { increment: 1 },
      authFailedAttempts: 0,
      authLockedUntil: null,
    },
  });
  if (updated.count !== 1) {
    return { error: "El código TOTP es incorrecto o ya se ha utilizado" };
  }
  await registrarAuditoriaSeguridad({
    accion: "MFA_DESACTIVADO_PROPIO",
    ejecutadoPorId: session.user.id,
    usuarioAfectadoId: session.user.id,
  });
  await notificarCambioSeguridad({
    email: usuario.email,
    nombre: usuario.nombre,
    descripcion: "Se ha desactivado la verificación en dos pasos de tu cuenta.",
  });
  revalidatePath("/perfil");
  return {
    success: "Verificación en dos pasos desactivada. Vuelve a iniciar sesión.",
    reauthenticate: true,
  };
}
