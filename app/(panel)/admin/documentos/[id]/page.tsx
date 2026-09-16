import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatearFecha } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevisionDocumento } from "./revision-documento";
import { formatearEquiposAsignados } from "@/lib/asignacion-equipos";
import { obtenerEquiposAsignados } from "@/lib/asignacion-equipos";
import { AsignacionesEditor } from "@/components/asignaciones-editor";
import { RecepcionMasiva } from "./recepcion-masiva";
import { DesasignarJugadorButton } from "@/components/desasignar-jugador-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DetalleSolicitudDocumentoPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const [solicitud, equiposDisponibles, jugadoresDisponibles] = await Promise.all([
    prisma.solicitudDocumento.findUnique({
      where: { id },
      include: {
        equipo: { include: { temporada: true } },
        equipos: { include: { temporada: true } },
        creadoPor: { select: { nombre: true, apellidos: true } },
        jugadores: {
          include: {
            equiposOrigen: { select: { id: true } },
            jugador: {
              include: { asignaciones: { select: { equipoId: true } } },
            },
          },
          orderBy: [{ jugador: { apellidos: "asc" } }, { jugador: { nombre: "asc" } }],
        },
      },
    }),
    prisma.equipo.findMany({
      where: { activo: true },
      include: {
        temporada: true,
        asignaciones: {
          where: { jugador: { activo: true } },
          select: { jugadorId: true },
        },
      },
      orderBy: [{ temporada: { fechaInicio: "desc" } }, { nombre: "asc" }],
    }),
    prisma.jugador.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, apellidos: true },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    }),
  ]);
  if (!solicitud) notFound();
  const equipos = formatearEquiposAsignados(solicitud, true);
  const equiposAsignados = obtenerEquiposAsignados(solicitud);
  const asignacionesIniciales = solicitud.jugadores.map((asignacion) => ({
    jugadorId: asignacion.jugadorId,
    asignadoDirectamente: asignacion.asignadoDirectamente,
    equiposOrigenIds: asignacion.equiposOrigen.map(({ id }) => id),
  }));
  const documentosPorRecibir = solicitud.jugadores.filter(
    ({ estado, archivoKey }) => estado === "SUBIDO" && Boolean(archivoKey)
  );

  return (
    <div className="space-y-6">
      <Link href="/admin/documentos" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a documentos
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{solicitud.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          Solicitado el {formatearFecha(solicitud.createdAt)}
          {equipos && ` · ${equipos}`}
          {solicitud.creadoPor && ` · ${solicitud.creadoPor.nombre} ${solicitud.creadoPor.apellidos}`}
        </p>
      </div>

      {solicitud.descripcion && (
        <Card><CardContent className="p-4 text-sm">{solicitud.descripcion}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Modificar asignaciones</CardTitle>
          <CardDescription>
            Añade o retira equipos y jugadores. Solo recibirán email los jugadores nuevos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AsignacionesEditor
            key={solicitud.updatedAt.toISOString()}
            tipo="documento"
            entidadId={solicitud.id}
            equipos={equiposDisponibles.map((equipo) => ({
              id: equipo.id,
              nombre: equipo.nombre,
              temporada: equipo.temporada.nombre,
              jugadoresIds: equipo.asignaciones.map(({ jugadorId }) => jugadorId),
            }))}
            jugadores={jugadoresDisponibles}
            equiposIniciales={equiposAsignados.map(({ id }) => id)}
            asignacionesIniciales={asignacionesIniciales}
          />
        </CardContent>
      </Card>

      {documentosPorRecibir.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Marcar varios como recibidos</CardTitle>
            <CardDescription>
              Selecciona varios PDFs pendientes de revisión para validarlos a la vez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecepcionMasiva
              solicitudId={solicitud.id}
              documentos={documentosPorRecibir.map(({ id, jugador }) => ({
                id,
                nombre: jugador.nombre,
                apellidos: jugador.apellidos,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Jugadores asignados</CardTitle>
          <CardDescription>Revisa cada PDF subido y confírmalo o recházalo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {solicitud.jugadores.map((documento) => (
            <div
              key={documento.id}
              id={`documento-${documento.id}`}
              className="scroll-mt-24 rounded-lg border p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-medium">
                    {documento.jugador.nombre} {documento.jugador.apellidos}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {documento.archivoSubidoAt
                      ? `Subido el ${formatearFecha(documento.archivoSubidoAt)}`
                      : "Todavía no ha subido el documento"}
                  </div>
                </div>
                <Badge
                  variant={
                    documento.estado === "VALIDADO"
                      ? "success"
                      : documento.estado === "SUBIDO"
                        ? "secondary"
                        : "warning"
                  }
                >
                  {documento.estado === "VALIDADO"
                    ? "Validado"
                    : documento.estado === "SUBIDO"
                      ? "Por revisar"
                      : "Pendiente"}
                </Badge>
              </div>
              <RevisionDocumento
                documentoId={documento.id}
                estado={documento.estado}
                archivoNombre={documento.archivoNombre}
              />
              <div className="mt-3 flex justify-end border-t pt-3">
                <DesasignarJugadorButton tipo="documento" asignacionId={documento.id} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
