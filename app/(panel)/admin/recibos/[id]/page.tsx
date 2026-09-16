import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink, Users, AlertCircle } from "lucide-react";
import { formatearFecha, formatearNumero } from "@/lib/utils";
import { JugadorReciboRow } from "./jugador-row";
import { formatearEquiposAsignados } from "@/lib/asignacion-equipos";
import { AnularReciboButton } from "./anular-button";
import { EliminarReciboButton } from "./eliminar-button";
import { AsignacionesEditor } from "@/components/asignaciones-editor";
import { obtenerEquiposAsignados } from "@/lib/asignacion-equipos";
import { PagosMasivos } from "./pagos-masivos";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function DetalleReciboAdminPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const reciboId = parseInt(id, 10);
  if (!Number.isFinite(reciboId)) notFound();

  const [recibo, equiposDisponibles, jugadoresDisponibles] = await Promise.all([
    prisma.recibo.findUnique({
      where: { id: reciboId },
      include: {
        equipo: { include: { temporada: true } },
        equipos: { include: { temporada: true } },
        jugadores: {
          include: {
            equiposOrigen: { select: { id: true } },
            jugador: {
              include: {
                asignaciones: { select: { equipoId: true } },
                tutorias: { include: { usuario: true } },
                usuario: { select: { id: true, nombre: true, apellidos: true, email: true } },
              },
            },
          },
          orderBy: [{ jugador: { apellidos: "asc" } }, { jugador: { nombre: "asc" } }],
        },
        creadoPor: { select: { nombre: true, apellidos: true } },
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

  if (!recibo) notFound();

  const totalPagados = recibo.jugadores.filter((j) => j.estado === "PAGADO").length;
  const totalPendientes = recibo.jugadores.filter(
    (j) => j.estado === "PENDIENTE" || j.estado === "RECHAZADO"
  ).length;
  const totalPorConfirmar = recibo.jugadores.filter(
    (j) => j.estado === "PENDIENTE" && Boolean(j.pagoDeclaradoAt)
  ).length;
  const equipos = formatearEquiposAsignados(recibo, true);
  const equiposAsignados = obtenerEquiposAsignados(recibo);
  const asignacionesIniciales = recibo.jugadores.map((asignacion) => ({
    jugadorId: asignacion.jugadorId,
    asignadoDirectamente: asignacion.asignadoDirectamente,
    equiposOrigenIds: asignacion.equiposOrigen.map(({ id }) => id),
  }));

  return (
    <div className="space-y-6">
      <Link href="/admin/recibos" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a recibos
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Emisión de recibos
            </h1>
            <EstadoBadge estado={recibo.estado} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <strong>{recibo.concepto}</strong> · Emitido el {formatearFecha(recibo.fechaEmision)}
            {recibo.creadoPor && (
              <> · Creado por {recibo.creadoPor.nombre} {recibo.creadoPor.apellidos}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/api/recibos/${recibo.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4" />
              Ver resumen PDF
            </a>
          </Button>
          {recibo.estado !== "ANULADO" && (
            <AnularReciboButton reciboId={recibo.id} />
          )}
          <EliminarReciboButton reciboId={recibo.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo label="Concepto" valor={recibo.concepto} />
            <Campo
              label="Asignación"
              valor={
                equipos || "Individual"
              }
            />
            <Campo
              label="Emisión"
              valor={formatearFecha(recibo.fechaEmision)}
            />
            <Campo
              label="Vencimiento"
              valor={recibo.fechaVencimiento ? formatearFecha(recibo.fechaVencimiento) : null}
            />
            <Campo label="Base imponible" valor={`${formatearNumero(recibo.baseImponible)} €`} />
            <Campo
              label={`IVA (${formatearNumero(recibo.tipoIva)}%)`}
              valor={`${formatearNumero(recibo.cuotaIva)} €`}
            />
            <Campo label="TOTAL" valor={`${formatearNumero(recibo.total)} €`} className="sm:col-span-2 text-lg font-bold" />
            {recibo.descripcion && (
              <Campo
                label="Descripción"
                valor={recibo.descripcion}
                className="sm:col-span-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Resumen de pagos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Asignados</span>
              <span className="text-lg font-bold">{recibo.jugadores.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pagados</span>
              <Badge variant="success">{totalPagados}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pendientes</span>
              <Badge variant="warning">{totalPendientes}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pendientes de confirmar</span>
              <Badge variant="secondary">{totalPorConfirmar}</Badge>
            </div>
            {totalPendientes > 0 && (
              <Alert variant="info" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2 text-xs">
                  Los jugadores con recibos pendientes pueden descargar el PDF y subir el justificante
                  desde su panel.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {recibo.estado !== "ANULADO" && (
        <Card>
          <CardHeader>
            <CardTitle>Modificar asignaciones</CardTitle>
            <CardDescription>
              Añade o retira equipos y jugadores. Solo recibirán email los jugadores nuevos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AsignacionesEditor
              key={recibo.updatedAt.toISOString()}
              tipo="recibo"
              entidadId={recibo.id}
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
      )}

      {totalPendientes > 0 && recibo.estado !== "ANULADO" && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar varios pagos</CardTitle>
            <CardDescription>
              Selecciona varios jugadores pendientes y aplica los mismos datos de pago.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PagosMasivos
              reciboId={recibo.id}
              jugadores={recibo.jugadores
                .filter(({ estado }) => estado === "PENDIENTE")
                .map(({ id, numero, jugador }) => ({
                  id,
                  numero,
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
          <CardDescription>
            Marca cada jugador como pagado y registra los datos del pago. Si el jugador subió un
            justificante, lo verás aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recibo.jugadores.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay jugadores asignados.</p>
          ) : (
            <div className="space-y-3">
              {recibo.jugadores.map((rj) => (
                <div key={rj.id} id={`recibo-jugador-${rj.id}`} className="scroll-mt-24">
                  <JugadorReciboRow
                    reciboJugadorId={rj.id}
                    numero={rj.numero}
                    reciboId={recibo.id}
                    jugador={{
                      id: rj.jugador.id,
                      nombre: rj.jugador.nombre,
                      apellidos: rj.jugador.apellidos,
                      dniNie: rj.jugador.dniNie,
                    }}
                    estado={rj.estado}
                    fechaPago={rj.fechaPago}
                    metodoPago={rj.metodoPago}
                    referenciaPago={rj.referenciaPago}
                    notasPago={rj.notasPago}
                    justificanteNombre={rj.justificanteNombre}
                    justificanteSubidoAt={rj.justificanteSubidoAt}
                    pagoDeclaradoAt={rj.pagoDeclaradoAt}
                    pagoDeclaradoPorNombre={rj.pagoDeclaradoPorNombre}
                    pagoDeclaradoPorEsTutor={rj.pagoDeclaradoPorEsTutor}
                    pagoRechazadoAt={rj.pagoRechazadoAt}
                    ultimoMotivoRechazoPago={rj.ultimoMotivoRechazoPago}
                    reciboAnulado={recibo.estado === "ANULADO"}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <a href={`/api/recibos/${recibo.id}/pdf`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
          <ExternalLink className="h-3 w-3" />
          Ver / descargar el resumen PDF de la emisión
        </a>
      </p>
    </div>
  );
}

function Campo({ label, valor, className }: { label: string; valor: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div>{valor || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    PENDIENTE: { label: "Pendiente", variant: "warning" },
    PAGADO: { label: "Pagado", variant: "success" },
    ANULADO: { label: "Anulado", variant: "destructive" },
  };
  const m = map[estado] ?? { label: estado, variant: "secondary" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}