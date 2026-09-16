"use server";

import { revalidatePath } from "next/cache";
import { configuracionClubSchema } from "@/lib/validaciones";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validarImagenSubida } from "@/lib/imagen-upload";
import { deleteObject, logoClubKey, putObject } from "@/lib/s3";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  return session;
}

export async function guardarConfiguracionClub(formData: FormData): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  const parsed = configuracionClubSchema.safeParse({
    nombre: formData.get("nombre"),
    colorPrimario: formData.get("colorPrimario") || "#1d4ed8",
    nif: formData.get("nif") || "",
    direccion: formData.get("direccion") || "",
    codigoPostal: formData.get("codigoPostal") || "",
    ciudad: formData.get("ciudad") || "",
    provincia: formData.get("provincia") || "",
    pais: formData.get("pais") || "España",
    telefono: formData.get("telefono") || "",
    email: formData.get("email") || "",
    web: formData.get("web") || "",
    ivaPorDefecto: formData.get("ivaPorDefecto"),
    prefijoRecibo: formData.get("prefijoRecibo") || "R",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;
  const actual = await prisma.configuracionClub.findUnique({
    where: { id: 1 },
    select: { logoKey: true },
  });
  const logo = formData.get("logo");
  const eliminarLogo = formData.get("eliminarLogo") === "on";
  let nuevoLogoKey: string | null | undefined;

  if (logo instanceof File && logo.size > 0) {
    try {
      const imagen = await validarImagenSubida(logo);
      if (imagen.extension === "webp") {
        return { error: "El escudo debe estar en formato JPG o PNG para poder incluirlo en los PDFs" };
      }
      nuevoLogoKey = logoClubKey(imagen.extension);
      await putObject(nuevoLogoKey, imagen.buffer, imagen.contentType);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "No se pudo subir el escudo" };
    }
  } else if (eliminarLogo) {
    nuevoLogoKey = null;
  }

  const valores = {
    nombre: data.nombre,
    colorPrimario: data.colorPrimario,
    nif: data.nif || null,
    direccion: data.direccion || null,
    codigoPostal: data.codigoPostal || null,
    ciudad: data.ciudad || null,
    provincia: data.provincia || null,
    pais: data.pais || "España",
    telefono: data.telefono || null,
    email: data.email || null,
    web: data.web || null,
    ivaPorDefecto: data.ivaPorDefecto,
    prefijoRecibo: data.prefijoRecibo,
    ...(nuevoLogoKey !== undefined ? { logoKey: nuevoLogoKey } : {}),
  };

  try {
    await prisma.configuracionClub.upsert({
      where: { id: 1 },
      update: valores,
      create: { id: 1, ...valores },
    });
  } catch (error) {
    if (nuevoLogoKey) await deleteObject(nuevoLogoKey).catch(() => undefined);
    console.error("[club] No se pudo guardar la configuración:", error);
    return { error: "No se pudo guardar la configuración" };
  }

  if (
    actual?.logoKey &&
    nuevoLogoKey !== undefined &&
    actual.logoKey !== nuevoLogoKey
  ) {
    await deleteObject(actual.logoKey).catch((error) => {
      console.error("[club] No se pudo eliminar el escudo anterior:", error);
    });
  }

  revalidatePath("/admin/configuracion");
  revalidatePath("/login");
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/recibos");
  revalidatePath("/admin/recibos/nuevo");
  return { success: "Configuración guardada" };
}