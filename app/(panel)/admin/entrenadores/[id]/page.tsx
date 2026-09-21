import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Pencil, Users } from "lucide-react";
import { formatearFecha, iniciales } from "@/lib/utils";
import { ROLES_ENTRENADOR } from "@/lib/validaciones";
import { GestionEquiposEntrenador } from "./gestion-equipos";
import { EliminarEntrenadorButton } from "./eliminar-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function FichaEntrenadorPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const entrenador = await prisma.entrenador.findUnique({
    where: { id },
    include: {
      equipos: {
        include: {
          equipo: { include: { temporada: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      usuario: { select: { id: true, email: true } },
      jugador: {
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          fechaNacimiento: true,
        },
      },
    },
  });

  if (!entrenador) notFound();

  const idsAsignados = new Set(entrenador.equipos.map((a) => a.equipoId));
  const equiposDisponiblesRaw = await prisma.equipo.findMany({
    where: {
      activo: true,
      NOT: { id: { in: Array.from(idsAsignados) } },
    },
    orderBy: [{ temporada: { fechaInicio: "desc" } }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      categoria: true,
      temporada: { select: { nombre: true } },
    },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/entrenadores"
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a entrenadores
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 sm:h-20 sm:h-20">
            <AvatarFallback className="text-lg">{iniciales(entrenador.nombre, entrenador.apellidos)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {entrenador.nombre} {entrenador.apellidos}
            </h1>
            <p className="text-sm text-muted-foreground">{entrenador.email ?? "Sin email"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {entrenador.activo ? (
                <Badge variant="success">Activo</Badge>
              ) : (
                <Badge variant="warning">Inactivo</Badge>
              )}
              {entrenador.usuario && (
                <Badge variant="outline">Tiene acceso al portal</Badge>
              )}
              {entrenador.jugador && (
                <Badge variant="outline">También jugador</Badge>
              )}
              <span className="text-muted-foreground">
                Alta {formatearFecha(entrenador.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/entrenadores/${entrenador.id}/editar`}>
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          </Button>
          {entrenador.activo && <EliminarEntrenadorButton id={entrenador.id} nombre={`${entrenador.nombre} ${entrenador.apellidos}`} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Campo label="Nombre completo" valor={`${entrenador.nombre} ${entrenador.apellidos}`} />
            <Campo label="Email" valor={entrenador.email} />
            <Campo label="Teléfono" valor={entrenador.telefono} />
            <Campo label="Teléfono alternativo" valor={entrenador.telefonoAlternativo} />
            {entrenador.observaciones && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Observaciones</div>
                <div className="whitespace-pre-line">{entrenador.observaciones}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vinculaciones</CardTitle>
            <CardDescription>
              La misma persona puede tener cuenta de acceso al portal, ficha de jugador
              vinculada o ambas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {entrenador.usuario ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Cuenta de acceso</div>
                <Link
                  href={`/admin/padres/${entrenador.usuario.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {entrenador.usuario.email}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin cuenta vinculada.</p>
            )}
            {entrenador.jugador ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Ficha de jugador</div>
                <Link
                  href={`/admin/jugadores/${entrenador.jugador.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {entrenador.jugador.nombre} {entrenador.jugador.apellidos}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin ficha de jugador.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipos asignados</CardTitle>
          <CardDescription>
            Asigna o desvincula a este entrenador de los equipos del club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GestionEquiposEntrenador
            entrenadorId={entrenador.id}
            equiposAsignados={entrenador.equipos.map((a) => ({
              asignacionId: a.id,
              equipoId: a.equipo.id,
              nombre: a.equipo.nombre,
              categoria: a.equipo.categoria,
              temporada: a.equipo.temporada?.nombre ?? null,
              rol: a.rol,
            }))}
            equiposDisponibles={equiposDisponiblesRaw}
            roles={ROLES_ENTRENADOR}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div>{valor || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
