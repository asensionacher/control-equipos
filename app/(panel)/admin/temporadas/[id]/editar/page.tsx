import { TemporadaForm } from "../../form";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarTemporadaPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const temporada = await prisma.temporada.findUnique({ where: { id } });
  if (!temporada) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Editar temporada</h1>
      <TemporadaForm
        temporada={{
          id: temporada.id,
          nombre: temporada.nombre,
          fechaInicio: temporada.fechaInicio.toISOString().split("T")[0],
          fechaFin: temporada.fechaFin.toISOString().split("T")[0],
          activa: temporada.activa,
        }}
      />
    </div>
  );
}
