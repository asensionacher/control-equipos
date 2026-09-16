import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NuevoReciboForm } from "./form";
import { getConfiguracionClub } from "@/lib/club-utils";

export const dynamic = "force-dynamic";

export default async function NuevoReciboPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const [equipos, jugadores, club] = await Promise.all([
    prisma.equipo.findMany({
      where: { activo: true },
      include: {
        temporada: true,
        _count: { select: { asignaciones: true } },
      },
      orderBy: [{ temporada: { fechaInicio: "desc" } }, { nombre: "asc" }],
    }),
    prisma.jugador.findMany({
      where: { activo: true },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, apellidos: true },
    }),
    getConfiguracionClub(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nuevo recibo</h1>
        <p className="text-sm text-muted-foreground">
          Emite un recibo y asígnalo a un equipo entero o a jugadores concretos
        </p>
      </div>
      <NuevoReciboForm
        equipos={equipos.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          categoria: e.categoria,
          temporada: e.temporada.nombre,
          jugadoresCount: e._count.asignaciones,
        }))}
        jugadores={jugadores}
        ivaPorDefecto={Number(club.ivaPorDefecto)}
      />
    </div>
  );
}