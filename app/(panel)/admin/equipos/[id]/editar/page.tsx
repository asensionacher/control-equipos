import { EquipoForm } from "../../form";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarEquipoPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const equipo = await prisma.equipo.findUnique({
    where: { id },
    include: {
      horariosEntrenamiento: {
        orderBy: [{ diaSemana: "asc" }, { minutoInicio: "asc" }],
      },
    },
  });
  if (!equipo) notFound();

  const temporadas = await prisma.temporada.findMany({
    orderBy: { fechaInicio: "desc" },
    select: { id: true, nombre: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Editar equipo</h1>
      <EquipoForm
        equipo={{
          id: equipo.id,
          nombre: equipo.nombre,
          categoria: equipo.categoria,
          descripcion: equipo.descripcion,
          urlLiga: equipo.urlLiga,
          temporadaId: equipo.temporadaId,
          horarios: equipo.horariosEntrenamiento,
        }}
        temporadas={temporadas}
      />
    </div>
  );
}
