import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calcularEdad, formatearFecha, iniciales } from "@/lib/utils";
import { ArrowLeft, Pencil, ExternalLink } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function FichaJugadorUsuarioPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const jugador = await prisma.jugador.findUnique({
    where: { id },
    include: {
      tutorias: {
        where: { usuarioId: session.user.id },
      },
      asignaciones: {
        include: { equipo: { include: { temporada: true } } },
      },
    },
  });

  // Solo puede ver la ficha si es tutor del jugador o si es su propia ficha
  const esPropia = jugador?.usuarioId === session.user.id;
  const esTutor = jugador?.tutorias && jugador.tutorias.length > 0;
  if (!jugador || (!esTutor && !esPropia)) notFound();

  // Agrupar asignaciones por temporada para mostrar historial
  const asignacionesPorTemporada = new Map<
    string,
    { temporadaId: string; temporadaNombre: string; asignaciones: typeof jugador.asignaciones }
  >();
  for (const a of jugador.asignaciones) {
    const key = a.equipo.temporadaId;
    if (!asignacionesPorTemporada.has(key)) {
      asignacionesPorTemporada.set(key, {
        temporadaId: a.equipo.temporadaId,
        temporadaNombre: a.equipo.temporada.nombre,
        asignaciones: [],
      });
    }
    asignacionesPorTemporada.get(key)!.asignaciones.push(a);
  }
  const historialTemporadas = Array.from(asignacionesPorTemporada.values()).sort((a, b) =>
    b.temporadaNombre.localeCompare(a.temporadaNombre)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {jugador.fotoUrl ? <AvatarImage src={jugador.fotoUrl} alt={jugador.nombre} /> : null}
                <AvatarFallback className="text-lg">{iniciales(jugador.nombre, jugador.apellidos)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">
                  {jugador.nombre} {jugador.apellidos}
                </CardTitle>
                <CardDescription>
                  {calcularEdad(jugador.fechaNacimiento)} años · Nacido el {formatearFecha(jugador.fechaNacimiento)}
                </CardDescription>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href={`/dashboard/jugadores/${jugador.id}/editar`}>
                <Pencil className="h-4 w-4" />
                Editar datos
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>
            Puedes editar todos los datos de la ficha del jugador desde el botón Editar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre completo" valor={`${jugador.nombre} ${jugador.apellidos}`} />
          <Campo label="Fecha de nacimiento" valor={formatearFecha(jugador.fechaNacimiento)} />
          <Campo label="Edad" valor={`${calcularEdad(jugador.fechaNacimiento)} años`} />
          <Campo label="Sexo" valor={jugador.sexo ? jugador.sexo.toLowerCase() : null} />
          <Campo label="DNI/NIE" valor={jugador.dniNie} />
          <Campo label="Email del jugador" valor={jugador.email} />
          <Campo label="Teléfono del jugador" valor={jugador.telefono} />
          <Campo label="Dirección" valor={jugador.direccion} className="sm:col-span-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de equipos</CardTitle>
          <CardDescription>
            Equipos en los que el jugador ha estado inscrito, por temporada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historialTemporadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              El jugador aún no está asignado a ningún equipo.
            </p>
          ) : (
            <div className="space-y-4">
              {historialTemporadas.map((h) => (
                <div key={h.temporadaId} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold">Temporada {h.temporadaNombre}</h4>
                    <Badge variant="outline">{h.asignaciones.length} equipo{h.asignaciones.length === 1 ? "" : "s"}</Badge>
                  </div>
                  <ul className="space-y-1">
                    {h.asignaciones.map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-sm">
                        <div>
                          {a.equipo.nombre}
                          {a.equipo.categoria && (
                            <span className="ml-1 text-xs text-muted-foreground">({a.equipo.categoria})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            Asignado el {formatearFecha(a.fechaAsignacion)}
                          </span>
                          {a.equipo.urlLiga && (
                            <a
                              href={a.equipo.urlLiga}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver liga
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        El tutor asignado sólo lo puede cambiar el administrador del club.
      </p>
    </div>
  );
}

function Campo({ label, valor, className }: { label: string; valor: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{valor || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
