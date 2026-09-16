import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, UserCheck, UsersRound, FileCheck2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const [
    totalJugadores,
    totalTemporadas,
    totalEquipos,
    jugadoresSinTutor,
    jugadoresSinEquipo,
    totalPadres,
    recibosPendientes,
    pagosPorConfirmar,
    documentosPorRevisar,
    totalRecibos,
    ultimosJugadores,
    ultimosPadres,
  ] = await Promise.all([
    prisma.jugador.count({ where: { activo: true } }),
    prisma.temporada.count({ where: { activa: true } }),
    prisma.equipo.count({ where: { activo: true } }),
    prisma.jugador.count({
      where: { activo: true, tutorias: { none: {} } },
    }),
    prisma.jugador.count({
      where: { activo: true, asignaciones: { none: {} } },
    }),
    prisma.usuario.count({ where: { rol: "USUARIO" } }),
    prisma.reciboJugador.count({
      where: { estado: { in: ["PENDIENTE", "RECHAZADO"] } },
    }),
    prisma.reciboJugador.count({
      where: { estado: "PENDIENTE", pagoDeclaradoAt: { not: null } },
    }),
    prisma.solicitudDocumentoJugador.count({
      where: { estado: "SUBIDO", archivoKey: { not: null } },
    }),
    prisma.reciboJugador.count(),
    prisma.jugador.findMany({
      where: { activo: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.usuario.findMany({
      where: { rol: "USUARIO" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const temporadaActiva = await prisma.temporada.findFirst({
    where: { activa: true },
    orderBy: { fechaInicio: "desc" },
    include: {
      equipos: {
        where: { activo: true },
        include: { _count: { select: { asignaciones: true } } },
        orderBy: { nombre: "asc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Panel de administración</h1>
          <p className="text-sm text-muted-foreground">
            Bienvenido, {session.user.nombre} {session.user.apellidos}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/admin/jugadores/nuevo">Nuevo jugador</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/padres/nuevo">Nuevo padre</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/equipos/nuevo">Nuevo equipo</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/recibos/nuevo">Nuevo recibo</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jugadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalJugadores}</div>
            <p className="text-xs text-muted-foreground">Activos</p>
          </CardContent>
        </Card>

        <Card className={pagosPorConfirmar + documentosPorRevisar > 0 ? "border-amber-400" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por revisar</CardTitle>
            <FileCheck2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pagosPorConfirmar + documentosPorRevisar}
            </div>
            <p className="text-xs text-muted-foreground">
              {pagosPorConfirmar} pagos · {documentosPorRevisar} documentos
            </p>
            <Link
              href="/admin/pendientes"
              className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline"
            >
              Abrir revisiones
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Padres</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPadres}</div>
            <p className="text-xs text-muted-foreground">Con cuenta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin tutor</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jugadoresSinTutor}</div>
            <p className="text-xs text-muted-foreground">Necesitan tutor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipos</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEquipos}</div>
            <p className="text-xs text-muted-foreground">En {totalTemporadas} temp.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recibos pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recibosPendientes}</div>
            <p className="text-xs text-muted-foreground">de {totalRecibos} emitidos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Equipos de la temporada actual</CardTitle>
            <CardDescription>
              {temporadaActiva
                ? `Temporada ${temporadaActiva.nombre}`
                : "No hay temporada activa"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!temporadaActiva || temporadaActiva.equipos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay equipos en esta temporada.</p>
            ) : (
              <ul className="space-y-3">
                {temporadaActiva.equipos.map((equipo) => (
                  <li
                    key={equipo.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/equipos/${equipo.id}`}
                        className="font-medium hover:underline"
                      >
                        {equipo.nombre}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {equipo.categoria || "Sin categoría"}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
                      {equipo._count.asignaciones} jugadores
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Últimos jugadores</CardTitle>
            </CardHeader>
            <CardContent>
              {ultimosJugadores.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay jugadores registrados.</p>
              ) : (
                <ul className="space-y-3">
                  {ultimosJugadores.map((jugador) => (
                    <li
                      key={jugador.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <Link
                        href={`/admin/jugadores/${jugador.id}`}
                        className="font-medium hover:underline"
                      >
                        {jugador.nombre} {jugador.apellidos}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(jugador.fechaNacimiento).getFullYear()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimos padres</CardTitle>
            </CardHeader>
            <CardContent>
              {ultimosPadres.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay padres registrados.</p>
              ) : (
                <ul className="space-y-3">
                  {ultimosPadres.map((padre) => (
                    <li
                      key={padre.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <Link
                        href={`/admin/padres/${padre.id}`}
                        className="font-medium hover:underline"
                      >
                        {padre.nombre} {padre.apellidos}
                      </Link>
                      <span className="text-xs text-muted-foreground">{padre.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
