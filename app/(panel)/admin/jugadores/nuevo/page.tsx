import { JugadorForm } from "../form";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NuevoJugadorPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const tutores = await prisma.usuario.findMany({
    where: { rol: "USUARIO" },
    orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, apellidos: true, email: true },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Nuevo jugador</h1>
      <JugadorForm tutores={tutores} />
    </div>
  );
}
