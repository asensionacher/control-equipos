import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Pencil, ExternalLink } from "lucide-react";
import { calcularEdad, iniciales } from "@/lib/utils";
import { AsignacionMasiva } from "./asignacion-masiva";
import { obtenerFotoJugadorSrc } from "@/lib/imagen-upload";
import { HorariosEntrenamiento } from "@/components/horarios-entrenamiento";
import { UserCog } from "lucide-react";
import { AsignarEntrenadorModal } from "./asignar-entrenador-modal";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FichaEquipoPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const equipo = await prisma.equipo.findUnique({
    where: { id },
    include: {
      temporada: true,
      horariosEntrenamiento: {
        orderBy: [{ diaSemana: "asc" }, { minutoInicio: "asc" }],
      },
      asignaciones: {
        include: {
          jugador: true,
        },
        orderBy: { jugador: { apellidos: "asc" } },
      },
      entrenadoresAsignaciones: {
        include: {
          entrenador: true,
        },
      },
    },
  });

  if (!equipo) notFound();

  const jugadoresAsignadosIds = new Set(equipo.asignaciones.map((a) => a.jugadorId));
  const entrenadoresAsignadosIds = new Set(
    equipo.entrenadoresAsignaciones.flatMap(({ entrenador }) =>
      entrenador.usuarioId ? [entrenador.usuarioId] : []
    )
  );

  const [jugadoresDisponibles, usuariosDisponibles] = await Promise.all([
    prisma.jugador.findMany({
      where: {
        activo: true,
        NOT: { id: { in: Array.from(jugadoresAsignadosIds) } },
      },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        fechaNacimiento: true,
        fotoUrl: true,
      },
    }),
    prisma.usuario.findMany({
      where: { id: { notIn: Array.from(entrenadoresAsignadosIds) } },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        entrenadorComoUsuario: { select: { id: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/equipos" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a equipos
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{equipo.nombre}</h1>
              <Badge variant="secondary">{equipo.temporada.nombre}</Badge>
            </div>
            {equipo.categoria && (
              <p className="mt-1 text-sm text-muted-foreground">Categoría: {equipo.categoria}</p>
            )}
            {equipo.codigoFcf && (
              <p className="mt-1 text-sm text-muted-foreground">Código FCF: {equipo.codigoFcf}</p>
            )}
            {equipo.descripcion && <p className="mt-2 text-sm">{equipo.descripcion}</p>}
            {equipo.urlLiga && (
              <a
                href={equipo.urlLiga}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver página oficial de la liga
              </a>
            )}
          </div>
          <Button asChild variant="outline">
            <Link href={`/admin/equipos/${equipo.id}/editar`}>
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horarios de entrenamiento</CardTitle>
          <CardDescription>Intervalos semanales configurados para este equipo</CardDescription>
        </CardHeader>
        <CardContent>
          <HorariosEntrenamiento equipos={[equipo]} soloActivos={false} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Cuerpo técnico
            </CardTitle>
            <CardDescription>
              Entrenadores asignados a este equipo.
            </CardDescription>
          </div>
          <AsignarEntrenadorModal
            equipoId={equipo.id}
            usuarios={usuariosDisponibles.map((usuario) => ({
              id: usuario.id,
              nombre: usuario.nombre,
              apellidos: usuario.apellidos,
              email: usuario.email,
              tienePerfilEntrenador: Boolean(usuario.entrenadorComoUsuario),
            }))}
          />
        </CardHeader>
        <CardContent>
          {equipo.entrenadoresAsignaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este equipo aún no tiene entrenadores asignados.
            </p>
          ) : (
            <ul className="space-y-2">
              {equipo.entrenadoresAsignaciones.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <Link
                    href={`/admin/entrenadores/${a.entrenador.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.entrenador.nombre} {a.entrenador.apellidos}
                  </Link>
                  {a.entrenador.telefono && (
                    <span className="text-xs text-muted-foreground">{a.entrenador.telefono}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jugadores asignados</CardTitle>
          <CardDescription>
            {equipo.asignaciones.length} jugador{equipo.asignaciones.length === 1 ? "" : "es"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {equipo.asignaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este equipo aún no tiene jugadores asignados.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {equipo.asignaciones.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/jugadores/${a.jugador.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={obtenerFotoJugadorSrc(a.jugador)}
                      alt={a.jugador.nombre}
                    />
                    <AvatarFallback>{iniciales(a.jugador.nombre, a.jugador.apellidos)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {a.jugador.nombre} {a.jugador.apellidos}
                    </div>
                    <div className="text-xs text-muted-foreground">{calcularEdad(a.jugador.fechaNacimiento)} años</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asignación masiva de jugadores</CardTitle>
          <CardDescription>
            Selecciona varios jugadores y asígnalos a este equipo de una sola vez
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AsignacionMasiva
            equipoId={equipo.id}
            jugadoresDisponibles={jugadoresDisponibles}
          />
        </CardContent>
      </Card>
    </div>
  );
}
