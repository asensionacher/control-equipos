"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { equipoSchema } from "@/lib/validaciones";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
}

function parseForm(formData: FormData) {
  return {
    nombre: (formData.get("nombre") as string | null)?.trim() ?? "",
    categoria: (formData.get("categoria") as string | null)?.trim() ?? "",
    descripcion: (formData.get("descripcion") as string | null)?.trim() ?? "",
    urlLiga: (formData.get("urlLiga") as string | null)?.trim() ?? "",
    temporadaId: (formData.get("temporadaId") as string | null)?.trim() ?? "",
  };
}

export async function crearEquipo(formData: FormData) {
  await requireAdmin();
  const parsed = equipoSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const existe = await prisma.equipo.findFirst({
    where: { nombre: parsed.data.nombre, temporadaId: parsed.data.temporadaId },
  });
  if (existe) return { error: "Ya existe un equipo con ese nombre en esa temporada" };

  const temporada = await prisma.temporada.findUnique({ where: { id: parsed.data.temporadaId } });
  if (!temporada) return { error: "Temporada no encontrada" };

  await prisma.equipo.create({
    data: {
      nombre: parsed.data.nombre,
      categoria: parsed.data.categoria || null,
      descripcion: parsed.data.descripcion || null,
      urlLiga: parsed.data.urlLiga || null,
      temporadaId: parsed.data.temporadaId,
    },
  });

  revalidatePath("/admin/equipos");
  redirect("/admin/equipos");
}

export async function editarEquipo(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = equipoSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const existe = await prisma.equipo.findFirst({
    where: { nombre: parsed.data.nombre, temporadaId: parsed.data.temporadaId, NOT: { id } },
  });
  if (existe) return { error: "Ya existe otro equipo con ese nombre en esa temporada" };

  await prisma.equipo.update({
    where: { id },
    data: {
      nombre: parsed.data.nombre,
      categoria: parsed.data.categoria || null,
      descripcion: parsed.data.descripcion || null,
      urlLiga: parsed.data.urlLiga || null,
      temporadaId: parsed.data.temporadaId,
    },
  });

  revalidatePath("/admin/equipos");
  revalidatePath(`/admin/equipos/${id}`);
  redirect(`/admin/equipos/${id}`);
}

export async function eliminarEquipo(id: string) {
  await requireAdmin();
  await prisma.equipo.update({ where: { id }, data: { activo: false } });
  revalidatePath("/admin/equipos");
  redirect("/admin/equipos");
}
