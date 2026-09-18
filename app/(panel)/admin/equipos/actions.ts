"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { asegurarEntrenadoresFicticios } from "@/lib/entrenadores-fcf";
import { obtenerEquiposFcf } from "@/lib/fcf";
import { prisma } from "@/lib/prisma";
import { formatearFechaHora } from "@/lib/utils";
import { equipoSchema, horariosEquipoSchema } from "@/lib/validaciones";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  return session;
}

function parseForm(formData: FormData) {
  return {
    nombre: (formData.get("nombre") as string | null)?.trim() ?? "",
    codigoFcf: (formData.get("codigoFcf") as string | null)?.trim() ?? "",
    categoria: (formData.get("categoria") as string | null)?.trim() ?? "",
    descripcion: (formData.get("descripcion") as string | null)?.trim() ?? "",
    urlLiga: (formData.get("urlLiga") as string | null)?.trim() ?? "",
    temporadaId: (formData.get("temporadaId") as string | null)?.trim() ?? "",
  };
}

function parseHorarios(formData: FormData) {
  const valor = formData.get("horarios");
  if (typeof valor !== "string") {
    return { error: "Los horarios de entrenamiento no son válidos" } as const;
  }

  try {
    const parsed = horariosEquipoSchema.safeParse(JSON.parse(valor));
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Los horarios de entrenamiento no son válidos",
      } as const;
    }
    return { data: parsed.data } as const;
  } catch {
    return { error: "Los horarios de entrenamiento no son válidos" } as const;
  }
}

export async function crearEquipo(formData: FormData) {
  await requireAdmin();
  const parsed = equipoSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const horarios = parseHorarios(formData);
  if ("error" in horarios) return { error: horarios.error };

  const existe = await prisma.equipo.findFirst({
    where: { nombre: parsed.data.nombre, temporadaId: parsed.data.temporadaId },
  });
  if (existe) return { error: "Ya existe un equipo con ese nombre en esa temporada" };

  const existeCodigoFcf = parsed.data.codigoFcf
    ? await prisma.equipo.findUnique({
        where: { codigoFcf: parsed.data.codigoFcf },
      })
    : null;
  if (existeCodigoFcf) return { error: "Ya existe un equipo con ese Código FCF" };

  const temporada = await prisma.temporada.findUnique({ where: { id: parsed.data.temporadaId } });
  if (!temporada) return { error: "Temporada no encontrada" };

  await prisma.equipo.create({
    data: {
      nombre: parsed.data.nombre,
      codigoFcf: parsed.data.codigoFcf || null,
      categoria: parsed.data.categoria || null,
      descripcion: parsed.data.descripcion || null,
      urlLiga: parsed.data.urlLiga || null,
      temporadaId: parsed.data.temporadaId,
      horariosEntrenamiento: {
        create: horarios.data,
      },
    },
  });

  revalidatePath("/admin/equipos");
  revalidatePath("/dashboard");
  redirect("/admin/equipos");
}

export async function editarEquipo(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = equipoSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const horarios = parseHorarios(formData);
  if ("error" in horarios) return { error: horarios.error };

  const existe = await prisma.equipo.findFirst({
    where: { nombre: parsed.data.nombre, temporadaId: parsed.data.temporadaId, NOT: { id } },
  });
  if (existe) return { error: "Ya existe otro equipo con ese nombre en esa temporada" };

  const existeCodigoFcf = parsed.data.codigoFcf
    ? await prisma.equipo.findFirst({
        where: { codigoFcf: parsed.data.codigoFcf, NOT: { id } },
      })
    : null;
  if (existeCodigoFcf) return { error: "Ya existe otro equipo con ese Código FCF" };

  await prisma.$transaction(async (tx) => {
    await tx.equipo.update({
      where: { id },
      data: {
        nombre: parsed.data.nombre,
        codigoFcf: parsed.data.codigoFcf || null,
        categoria: parsed.data.categoria || null,
        descripcion: parsed.data.descripcion || null,
        urlLiga: parsed.data.urlLiga || null,
        temporadaId: parsed.data.temporadaId,
      },
    });
    await tx.horarioEntrenamiento.deleteMany({ where: { equipoId: id } });
    if (horarios.data.length > 0) {
      await tx.horarioEntrenamiento.createMany({
        data: horarios.data.map((horario) => ({ ...horario, equipoId: id })),
      });
    }
  });

  revalidatePath("/admin/equipos");
  revalidatePath(`/admin/equipos/${id}`);
  revalidatePath("/dashboard");
  redirect(`/admin/equipos/${id}`);
}

export async function eliminarEquipo(id: string) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.asignacionEquipo.deleteMany({ where: { equipoId: id } }),
    prisma.equipo.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/equipos");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin/equipos");
}

export async function importarEquiposFcf(): Promise<{
  error?: string;
  success?: string;
  warning?: string;
}> {
  const session = await requireAdmin();
  const fechaImportacion = formatearFechaHora(new Date(), { timeZone: "Europe/Madrid" });

  const [club, temporada] = await Promise.all([
    prisma.configuracionClub.findUnique({
      where: { id: 1 },
      select: { codigoFcf: true },
    }),
    prisma.temporada.findFirst({
      where: { activa: true },
      orderBy: { fechaInicio: "desc" },
      select: { id: true, nombre: true },
    }),
  ]);

  if (!club?.codigoFcf) {
    return { error: "Configura primero el Código FCF del club" };
  }
  if (!temporada) {
    return { error: "No hay ninguna temporada activa para importar los equipos" };
  }

  let resultadoFcf;
  try {
    resultadoFcf = await obtenerEquiposFcf(club.codigoFcf);
  } catch (error) {
    console.error("[fcf] No se pudieron consultar los equipos:", error);
    return {
      error: error instanceof Error ? error.message : "No se pudieron consultar los equipos de la FCF",
    };
  }

  if (resultadoFcf.equipos.length === 0) {
    return { error: "La FCF no devolvió ningún equipo para este club" };
  }

  const codigosFcf = resultadoFcf.equipos.map(({ codigoFcf }) => codigoFcf);
  const nombres = resultadoFcf.equipos.map(({ nombre }) => nombre);
  const existentes = await prisma.equipo.findMany({
    where: {
      OR: [
        { codigoFcf: { in: codigosFcf } },
        { temporadaId: temporada.id, nombre: { in: nombres } },
      ],
    },
    select: { codigoFcf: true, nombre: true, temporadaId: true },
  });

  const codigosExistentes = new Set(
    existentes.flatMap(({ codigoFcf }) => (codigoFcf ? [codigoFcf] : []))
  );
  const nombresExistentes = new Set(
    existentes
      .filter(({ temporadaId }) => temporadaId === temporada.id)
      .map(({ nombre }) => nombre)
  );
  const nuevos = resultadoFcf.equipos.filter(
    ({ codigoFcf, nombre }) =>
      !codigosExistentes.has(codigoFcf) && !nombresExistentes.has(nombre)
  );

  try {
    if (nuevos.length > 0) {
      await prisma.$transaction(
        nuevos.map((equipo) =>
          prisma.equipo.create({
            data: {
              nombre: equipo.nombre,
              codigoFcf: equipo.codigoFcf,
              categoria: equipo.categoria,
              descripcion: `Creado automáticamente desde la FCF el ${fechaImportacion}.`,
              urlLiga: equipo.urlLiga,
              temporadaId: temporada.id,
              horariosEntrenamiento: {
                create: equipo.horarios,
              },
            },
          })
        )
      );
    }
  } catch (error) {
    console.error("[fcf] No se pudieron guardar los equipos importados:", error);
    return { error: "No se pudieron guardar los equipos importados" };
  }

  let entrenadores;
  try {
    entrenadores = await asegurarEntrenadoresFicticios({
      temporadaId: temporada.id,
      creadoPorId: session.user.id,
    });
  } catch (error) {
    console.error("[fcf] No se pudieron crear los entrenadores ficticios:", error);
    return {
      error:
        error instanceof Error
          ? `Los equipos se importaron, pero sus entrenadores no: ${error.message}`
          : "Los equipos se importaron, pero no se pudieron crear sus entrenadores",
    };
  }

  revalidatePath("/admin/equipos");
  revalidatePath("/admin");
  revalidatePath("/dashboard");

  const omitidos = resultadoFcf.equipos.length - nuevos.length;
  const resumenOmitidos = omitidos > 0 ? `; ${omitidos} ya existían` : "";
  const warning =
    resultadoFcf.advertencias.length > 0
      ? `${resultadoFcf.advertencias.length} equipos se importaron sin horario completo. ${resultadoFcf.advertencias
          .slice(0, 3)
          .join(". ")}${resultadoFcf.advertencias.length > 3 ? "…" : ""}`
      : undefined;

  return {
    success: `Importación completada en ${temporada.nombre}: ${nuevos.length} equipos creados${resumenOmitidos}; ${entrenadores.equiposCubiertos} entrenadores asignados (${entrenadores.cuentasCreadas} cuentas nuevas).`,
    warning,
  };
}

export async function crearEntrenadoresFicticiosEquipos(): Promise<{
  error?: string;
  success?: string;
}> {
  const session = await requireAdmin();
  const temporada = await prisma.temporada.findFirst({
    where: { activa: true },
    orderBy: { fechaInicio: "desc" },
    select: { id: true, nombre: true },
  });
  if (!temporada) {
    return { error: "No hay ninguna temporada activa" };
  }

  try {
    const resultado = await asegurarEntrenadoresFicticios({
      temporadaId: temporada.id,
      creadoPorId: session.user.id,
    });
    revalidatePath("/admin/equipos");
    revalidatePath("/admin/entrenadores");
    revalidatePath("/admin/usuarios");
    return {
      success:
        resultado.equiposCubiertos === 0
          ? `Todos los equipos de ${temporada.nombre} ya tienen entrenador`
          : `Se han asignado entrenadores a ${resultado.equiposCubiertos} equipos de ${temporada.nombre} y creado ${resultado.cuentasCreadas} cuentas ficticias.`,
    };
  } catch (error) {
    console.error("[entrenadores] No se pudieron crear las cuentas ficticias:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron crear los entrenadores ficticios",
    };
  }
}
