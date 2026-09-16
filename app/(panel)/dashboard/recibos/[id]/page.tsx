import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { formatearFecha, formatearNumero, formatearNumeroRecibo } from "@/lib/utils";
import { SubirJustificante } from "./subir-justificante";
import { AccionesPago } from "./acciones-pago";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jugadorId?: string }>;
}

export const dynamic = "force-dynamic";

export default async function DetalleReciboUsuarioPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const reciboId = parseInt(id, 10);
  if (!Number.isFinite(reciboId)) notFound();
  const { jugadorId } = await searchParams;
  if (!jugadorId) redirect("/dashboard");

  // Verificar permiso: el usuario debe tener acceso a al menos un jugador asignado
  const recibo = await prisma.recibo.findUnique({
    where: { id: reciboId },
    include: {
      jugadores: {
        include: {
          equiposOrigen: {
            select: { id: true, nombre: true },
            orderBy: { nombre: "asc" },
          },
          jugador: {
            include: {
              asignaciones: { select: { equipoId: true } },
              tutorias: { where: { usuarioId: session.user.id }, select: { id: true } },
              usuario: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!recibo) notFound();

  // Filtrar solo los jugadores accesibles
  const misJugadores = recibo.jugadores.filter(
    (rj) =>
      (!jugadorId || rj.jugadorId === jugadorId) &&
      (rj.jugador.usuario?.id === session.user.id ||
        rj.jugador.tutorias.length > 0)
  );
  if (misJugadores.length === 0) notFound();

  const estaAnulado = recibo.estado === "ANULADO";
  const reciboJugadorPrincipal = misJugadores[0];
  const equiposDelJugador = new Set(
    reciboJugadorPrincipal.jugador.asignaciones.map(({ equipoId }) => equipoId)
  );
  const equiposAsignados = reciboJugadorPrincipal.equiposOrigen
    .filter(({ id: equipoId }) => equiposDelJugador.has(equipoId))
    .map(({ nombre }) => nombre);
  const formasAsignacion = [
    ...equiposAsignados,
    ...(reciboJugadorPrincipal.asignadoDirectamente
      ? ["Asignación directa al jugador"]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/dashboard/jugadores/${jugadorId}`} className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver al jugador
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Recibo {formatearNumeroRecibo(reciboJugadorPrincipal.numero)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Emitido el {formatearFecha(recibo.fechaEmision)}
          </p>
        </div>
        <Button asChild variant="outline">
          <a
            href={`/api/recibos/${recibo.id}/pdf?jugadorId=${reciboJugadorPrincipal.jugadorId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText className="h-4 w-4" />
            Descargar PDF
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{recibo.concepto}</CardTitle>
          {recibo.descripcion && (
            <CardDescription>{recibo.descripcion}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Campo label="Base imponible" valor={`${formatearNumero(recibo.baseImponible)} €`} />
            <Campo label={`IVA (${formatearNumero(recibo.tipoIva)}%)`} valor={`${formatearNumero(recibo.cuotaIva)} €`} />
            <Campo label="Total" valor={`${formatearNumero(recibo.total)} €`} className="col-span-2 text-xl font-bold" />
            <Campo
              label="Equipos"
              valor={
                formasAsignacion.length > 0
                  ? formasAsignacion.join(" · ")
                  : "Sin equipos actuales asociados"
              }
              className="col-span-2"
            />
            {recibo.fechaVencimiento && (
              <Campo label="Vencimiento" valor={formatearFecha(recibo.fechaVencimiento)} />
            )}
          </div>
        </CardContent>
      </Card>

      {misJugadores.map((rj) => (
        <Card key={rj.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="font-mono text-sm text-muted-foreground">
                {formatearNumeroRecibo(rj.numero)}
              </span>
              {rj.jugador.nombre} {rj.jugador.apellidos}
              {rj.estado === "PAGADO" && (
                <Badge variant="success">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Pagado
                </Badge>
              )}
              {rj.estado === "PENDIENTE" && !estaAnulado && (
                <Badge variant="warning">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  {rj.pagoDeclaradoAt ? "Pendiente de confirmar" : "Pendiente"}
                </Badge>
              )}
              {rj.estado === "RECHAZADO" && !estaAnulado && (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3 w-3" /> Pago rechazado
                </Badge>
              )}
              {estaAnulado && (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3 w-3" /> Anulado
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rj.estado === "PAGADO" && rj.fechaPago && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <strong>Pagado</strong> el {formatearFecha(rj.fechaPago)}
                  {rj.metodoPago && <> mediante {rj.metodoPago}</>}
                  {rj.referenciaPago && <> (Ref: {rj.referenciaPago})</>}
                  {rj.notasPago && <>. {rj.notasPago}</>}
                </AlertDescription>
              </Alert>
            )}

            {(rj.estado === "PENDIENTE" || rj.estado === "RECHAZADO") &&
              !estaAnulado && (
              <div className="space-y-3">
                {rj.estado === "RECHAZADO" && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription className="ml-2">
                      <strong>El pago ha sido rechazado.</strong>
                      {rj.ultimoMotivoRechazoPago &&
                        ` Motivo: ${rj.ultimoMotivoRechazoPago}.`}
                      {" "}Puedes subir un nuevo justificante y volver a marcarlo como pagado.
                    </AlertDescription>
                  </Alert>
                )}
                {rj.pagoDeclaradoAt && (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="ml-2">
                      Has marcado este recibo como pagado. Está pendiente de confirmación por el
                      administrador.
                    </AlertDescription>
                  </Alert>
                )}
                {rj.justificanteNombre ? (
                  <Alert variant="info">
                    <FileText className="h-4 w-4" />
                    <AlertDescription className="ml-2 flex items-center justify-between gap-2">
                      <span className="flex-1">
                        Has subido un justificante: <strong>{rj.justificanteNombre}</strong>
                        {rj.justificanteSubidoAt && (
                          <> el {formatearFecha(rj.justificanteSubidoAt)}</>
                        )}
                        . Está pendiente de validación por el administrador.
                      </span>
                      <a
                        href={`/api/recibos/jugador/${rj.id}/justificante`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver
                      </a>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <SubirJustificante reciboJugadorId={rj.id} />
                )}
                <AccionesPago
                  reciboJugadorId={rj.id}
                  tieneJustificante={Boolean(rj.justificanteKey)}
                  pagoDeclarado={Boolean(rj.pagoDeclaradoAt)}
                />
              </div>
              )}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/recibos/${recibo.id}/pdf?jugadorId=${rj.jugadorId}`} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4" />
                  PDF personalizado
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
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