"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { perfilUsuarioSchema, cambioPasswordSchema } from "@/lib/validaciones";
import { sincronizarDatosPersonalesUsuario } from "@/lib/jugador-sync";

async function requireUser() {
  const session = await auth();
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
): Promise<{ error?: string; success?: string }> {
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
    data: { passwordHash },
  });

  return { success: "Contraseña actualizada correctamente" };
}
