import { EquipoForm } from "../form";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NuevoEquipoPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const temporadas = await prisma.temporada.findMany({
    where: { activa: true },
    orderBy: { fechaInicio: "desc" },
    select: { id: true, nombre: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Nuevo equipo</h1>
      <EquipoForm temporadas={temporadas} />
    </div>
  );
}
