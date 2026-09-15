"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jugadorEditTutorSchema } from "@/lib/validaciones";

export async function editarJugadorTutor(
  jugadorId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
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
    direccion: formData.get("direccion") || "",
    fotoUrl: formData.get("fotoUrl") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;

  // Comprobar que el DNI no esté en uso por OTRO jugador
  if (data.dniNie) {
    const dniEnUso = await prisma.jugador.findFirst({
      where: { dniNie: data.dniNie, NOT: { id: jugadorId } },
    });
    if (dniEnUso) return { error: "Ya existe otro jugador con ese DNI/NIE" };
  }

  await prisma.jugador.update({
    where: { id: jugadorId },
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      fechaNacimiento: new Date(data.fechaNacimiento),
      dniNie: data.dniNie || null,
      email: data.email || null,
      telefono: data.telefono || null,
      direccion: data.direccion || null,
      fotoUrl: data.fotoUrl || null,
      sexo: sexoValido,
    },
  });

  revalidatePath(`/dashboard/jugadores/${jugadorId}`);
  revalidatePath("/dashboard");
  revalidatePath(`/admin/jugadores/${jugadorId}`);
  return { success: "Datos del jugador actualizados correctamente" };
}
