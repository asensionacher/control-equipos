import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NuevaSolicitudDocumentoForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NuevaSolicitudDocumentoPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const [equipos, jugadores] = await Promise.all([
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
      select: { id: true, nombre: true, apellidos: true },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Solicitar documento
        </h1>
        <p className="text-sm text-muted-foreground">
          Los jugadores o sus tutores recibirán un correo y podrán subir un PDF.
        </p>
      </div>
      <NuevaSolicitudDocumentoForm
        equipos={equipos.map((equipo) => ({
          id: equipo.id,
          nombre: equipo.nombre,
          temporada: equipo.temporada.nombre,
          jugadoresCount: equipo._count.asignaciones,
        }))}
        jugadores={jugadores}
      />
    </div>
  );
}
