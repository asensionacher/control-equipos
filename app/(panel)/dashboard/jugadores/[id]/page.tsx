import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calcularEdad,
  formatearFecha,
  formatearFechaHora,
  formatearNumero,
  formatearNumeroRecibo,
  iniciales,
} from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  ShieldCheck,
  Trophy,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { getDatosPersonales } from "@/lib/jugador-sync";
import { obtenerFotoJugadorSrc } from "@/lib/imagen-upload";
import { HorariosEntrenamiento } from "@/components/horarios-entrenamiento";
import { SelectorTemporadaJugador } from "@/components/selector-temporada-jugador";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubirDocumento } from "../../documentos/subir-documento";
import { FirmaConsentimiento } from "../../consentimientos/firma-consentimiento";
import { ContenidoConsentimiento } from "@/components/contenido-consentimiento";
import { DesvincularJugador } from "./desvincular-jugador";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ temporada?: string }>;
}

export const dynamic = "force-dynamic";

export default async function FichaJugadorUsuarioPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { temporada: temporadaSolicitada } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [jugador, temporadas] = await Promise.all([
    prisma.jugador.findUnique({
      where: { id },
      include: {
        tutorias: {
          where: { usuarioId: session.user.id },
        },
        pendingRegistrations: {
          where: { usado: false, expiresAt: { gt: new Date() } },
          select: { email: true },
        },
        asignaciones: {
          include: {
            equipo: {
              include: {
                temporada: true,
                horariosEntrenamiento: {
                  orderBy: [{ diaSemana: "asc" }, { minutoInicio: "asc" }],
                },
              },
            },
          },
          orderBy: { fechaAsignacion: "desc" },
        },
        recibosJugador: {
          include: {
            equiposOrigen: { include: { temporada: true } },
            recibo: true,
          },
          orderBy: { recibo: { fechaEmision: "desc" } },
        },
        documentosSolicitados: {
          include: {
            equiposOrigen: { include: { temporada: true } },
            solicitud: true,
          },
          orderBy: { createdAt: "desc" },
        },
        consentimientos: {
          include: {
            equiposOrigen: { include: { temporada: true } },
            consentimiento: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.temporada.findMany({
      orderBy: { fechaInicio: "desc" },
      select: {
        id: true,
        nombre: true,
        activa: true,
        fechaInicio: true,
        fechaFin: true,
      },
    }),
  ]);

  const esPropia = jugador?.usuarioId === session.user.id;
  const esTutor = Boolean(jugador?.tutorias.length);
  if (!jugador || (!esTutor && !esPropia)) notFound();

  // Regla: si el jugador tiene tutor asignado, el jugador propietario no
  // puede acceder por su cuenta: lo gestiona el tutor.
  const jugadorConTutor = esPropia && esTutor;
  if (jugadorConTutor) {
    redirect("/dashboard");
  }

  const temporadaSeleccionada =
    temporadas.find(({ id: temporadaId }) => temporadaId === temporadaSolicitada) ??
    temporadas.find(({ activa }) => activa) ??
    temporadas[0] ??
    null;
  const datosPersonales = await getDatosPersonales(jugador.id);
  const esMayorEdad = calcularEdad(jugador.fechaNacimiento) >= 18;
  const emailJugador = jugador.email?.toLowerCase().trim();
  const puedeDesvincular = Boolean(
    emailJugador &&
      (jugador.usuarioId ||
        jugador.pendingRegistrations.some(
          ({ email }) => email.toLowerCase() === emailJugador
        ))
  );

  const asignacionesTemporada = temporadaSeleccionada
    ? jugador.asignaciones.filter(
        ({ equipo }) => equipo.temporadaId === temporadaSeleccionada.id
      )
    : [];
  const recibosTemporada = temporadaSeleccionada
    ? jugador.recibosJugador.filter((asignacion) =>
        perteneceATemporada(
          asignacion.equiposOrigen,
          asignacion.recibo.fechaEmision,
          temporadaSeleccionada
        )
      )
    : [];
  const documentosTemporada = temporadaSeleccionada
    ? jugador.documentosSolicitados.filter((asignacion) =>
        perteneceATemporada(
          asignacion.equiposOrigen,
          asignacion.createdAt,
          temporadaSeleccionada
        )
      )
    : [];
  const consentimientosTemporada = temporadaSeleccionada
    ? jugador.consentimientos.filter((asignacion) =>
        perteneceATemporada(
          asignacion.equiposOrigen,
          asignacion.createdAt,
          temporadaSeleccionada
        )
      )
    : [];
  const equiposTemporadaIds = new Set(
    asignacionesTemporada.map(({ equipoId }) => equipoId)
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a mis jugadores
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={obtenerFotoJugadorSrc(jugador)} alt={datosPersonales.nombre} />
                <AvatarFallback className="text-lg">
                  {iniciales(datosPersonales.nombre, datosPersonales.apellidos)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">
                  {datosPersonales.nombre} {datosPersonales.apellidos}
                </CardTitle>
                <CardDescription>
                  {calcularEdad(jugador.fechaNacimiento)} años · Nacido el{" "}
                  {formatearFecha(jugador.fechaNacimiento)}
                </CardDescription>
                {esTutor && (
                  <Badge variant="secondary" className="mt-2">
                    Gestionado por su tutor
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Button asChild variant="outline">
                <Link href={`/dashboard/jugadores/${jugador.id}/editar`}>
                  <Pencil className="h-4 w-4" />
                  Editar datos
                </Link>
              </Button>
              {esTutor && esMayorEdad && (
                <DesvincularJugador
                  jugadorId={jugador.id}
                  puedeDesvincular={puedeDesvincular}
                />
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {temporadaSeleccionada ? (
        <SelectorTemporadaJugador
          temporadas={temporadas.map(({ id: temporadaId, nombre, activa }) => ({
            id: temporadaId,
            nombre,
            activa,
          }))}
          temporadaId={temporadaSeleccionada.id}
        />
      ) : (
        <Alert variant="info">
          <AlertDescription>No hay temporadas configuradas.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre completo" valor={`${datosPersonales.nombre} ${datosPersonales.apellidos}`} />
          <Campo label="Fecha de nacimiento" valor={formatearFecha(jugador.fechaNacimiento)} />
          <Campo label="Edad" valor={`${calcularEdad(jugador.fechaNacimiento)} años`} />
          <Campo label="Sexo" valor={jugador.sexo ? jugador.sexo.toLowerCase() : null} />
          <Campo label="DNI/NIE" valor={jugador.dniNie} />
          <Campo label="Email" valor={datosPersonales.email} />
          <Campo label="Teléfono" valor={datosPersonales.telefono} />
          <Campo label="Teléfono alternativo" valor={datosPersonales.telefonoAlternativo} />
          <Campo label="Dirección" valor={jugador.direccion} className="sm:col-span-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Equipos de la temporada
          </CardTitle>
          <CardDescription>
            {temporadaSeleccionada?.nombre ?? "Sin temporada seleccionada"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {asignacionesTemporada.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              El jugador no pertenece a ningún equipo en esta temporada.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {asignacionesTemporada.map(({ id: asignacionId, equipo, fechaAsignacion }) => (
                <div key={asignacionId} className="rounded-lg border p-4">
                  <div className="font-semibold">{equipo.nombre}</div>
                  {equipo.categoria && (
                    <div className="text-sm text-muted-foreground">{equipo.categoria}</div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Asignado el {formatearFecha(fechaAsignacion)}
                  </div>
                  {equipo.urlLiga && (
                    <a
                      href={equipo.urlLiga}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver liga
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horarios de entrenamiento</CardTitle>
          <CardDescription>Horarios de los equipos de la temporada seleccionada</CardDescription>
        </CardHeader>
        <CardContent>
          <HorariosEntrenamiento
            equipos={asignacionesTemporada.map(({ equipo }) => equipo)}
            soloActivos={false}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold">Gestiones</h2>
        <p className="text-sm text-muted-foreground">
          Historial y tareas correspondientes únicamente a este jugador.
        </p>
      </div>

      <Tabs defaultValue="recibos">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="recibos" className="px-1 text-xs sm:px-3 sm:text-sm">
            Recibos ({recibosTemporada.length})
          </TabsTrigger>
          <TabsTrigger value="documentos" className="px-1 text-xs sm:px-3 sm:text-sm">
            Documentos ({documentosTemporada.length})
          </TabsTrigger>
          <TabsTrigger
            value="consentimientos"
            className="px-1 text-[11px] sm:px-3 sm:text-sm"
          >
            Consentimientos ({consentimientosTemporada.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recibos" className="space-y-3">
          {recibosTemporada.length === 0 ? (
            <Vacio texto="No hay recibos para este jugador en la temporada." />
          ) : (
            recibosTemporada.map((asignacion) => (
              <Card key={asignacion.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {formatearNumeroRecibo(asignacion.numero)}
                      </span>
                      <EstadoRecibo
                        estado={asignacion.estado}
                        pagoDeclarado={Boolean(asignacion.pagoDeclaradoAt)}
                      />
                    </div>
                    <div className="mt-1 font-medium">{asignacion.recibo.concepto}</div>
                    <div className="text-xs text-muted-foreground">
                      Emitido el {formatearFecha(asignacion.recibo.fechaEmision)}
                      {asignacion.recibo.fechaVencimiento &&
                        ` · Vence el ${formatearFecha(asignacion.recibo.fechaVencimiento)}`}
                    </div>
                    {asignacion.justificanteSubidoPorNombre && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Justificante gestionado por{" "}
                        {asignacion.justificanteSubidoPorEsTutor ? "el tutor " : ""}
                        {asignacion.justificanteSubidoPorNombre}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">
                      {formatearNumero(asignacion.recibo.total)} €
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/dashboard/recibos/${asignacion.reciboId}?jugadorId=${jugador.id}`}
                      >
                        Ver y gestionar
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="documentos" className="space-y-3">
          {documentosTemporada.length === 0 ? (
            <Vacio texto="No hay documentos solicitados para este jugador en la temporada." />
          ) : (
            documentosTemporada.map((documento) => (
              <Card key={documento.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{documento.solicitud.nombre}</CardTitle>
                      <CardDescription>
                        Solicitado el {formatearFecha(documento.createdAt)}
                      </CardDescription>
                    </div>
                    <EstadoDocumento estado={documento.estado} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {documento.solicitud.descripcion && (
                    <p className="text-sm">{documento.solicitud.descripcion}</p>
                  )}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Equipos</div>
                    <div className="text-sm">
                      {formatearEquiposGestion(
                        documento.equiposOrigen,
                        equiposTemporadaIds,
                        documento.asignadoDirectamente
                      )}
                    </div>
                  </div>
                  {documento.ultimoMotivoRechazo && documento.estado === "PENDIENTE" && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Debe volver a subirse. Motivo: {documento.ultimoMotivoRechazo}
                      </AlertDescription>
                    </Alert>
                  )}
                  {documento.archivoSubidoPorNombre && (
                    <p className="text-xs text-muted-foreground">
                      Subido por {documento.archivoSubidoPorEsTutor ? "el tutor " : ""}
                      {documento.archivoSubidoPorNombre}
                      {documento.archivoSubidoAt &&
                        ` el ${formatearFechaHora(documento.archivoSubidoAt)}`}
                    </p>
                  )}
                  {documento.archivoKey && (
                    <a
                      href={`/api/documentos/${documento.id}/archivo`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver PDF subido
                    </a>
                  )}
                  {documento.estado !== "VALIDADO" && (
                    <SubirDocumento
                      documentoId={documento.id}
                      tieneArchivo={Boolean(documento.archivoKey)}
                    />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="consentimientos" className="space-y-3">
          {consentimientosTemporada.length === 0 ? (
            <Vacio texto="No hay consentimientos para este jugador en la temporada." />
          ) : (
            consentimientosTemporada.map((asignacion) => (
              <Card key={asignacion.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        {asignacion.consentimiento.titulo}
                      </CardTitle>
                      <CardDescription>
                        Creado el {formatearFecha(asignacion.createdAt)}
                      </CardDescription>
                    </div>
                    <Badge variant={asignacion.estado === "FIRMADO" ? "success" : "warning"}>
                      {asignacion.estado === "FIRMADO" ? "Firmado" : "Pendiente"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ContenidoConsentimiento
                    contenido={asignacion.consentimiento.descripcion}
                    className="rounded-md bg-muted/40 p-4 text-sm"
                  />
                  {asignacion.estado === "FIRMADO" ? (
                    <Alert variant="success">
                      <ShieldCheck className="h-4 w-4" />
                      <AlertDescription className="ml-2">
                        Firmado por {asignacion.firmadoPorNombre}
                        {asignacion.firmadoPorEsTutor ? " como tutor" : ""}
                        {asignacion.firmadoAt &&
                          ` el ${formatearFechaHora(asignacion.firmadoAt)}`}.{" "}
                        <a
                          href={`/api/consentimientos/${asignacion.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline"
                        >
                          Ver PDF
                        </a>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <FirmaConsentimiento consentimientoJugadorId={asignacion.id} />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground">
        El tutor asignado solo lo puede cambiar el administrador del club.
      </p>
    </div>
  );
}

function perteneceATemporada(
  equiposOrigen: Array<{ temporadaId: string }>,
  fecha: Date,
  temporada: { id: string; fechaInicio: Date; fechaFin: Date }
) {
  if (equiposOrigen.length > 0) {
    return equiposOrigen.some(({ temporadaId }) => temporadaId === temporada.id);
  }
  const fechaGestion = new Date(fecha);
  return fechaGestion >= temporada.fechaInicio && fechaGestion <= temporada.fechaFin;
}

function formatearEquiposGestion(
  equiposOrigen: Array<{ id: string; nombre: string }>,
  equiposJugadorIds: Set<string>,
  asignadoDirectamente: boolean
) {
  const nombres = equiposOrigen
    .filter(({ id }) => equiposJugadorIds.has(id))
    .map(({ nombre }) => nombre);
  if (asignadoDirectamente) nombres.push("Asignación directa al jugador");
  return nombres.length > 0 ? nombres.join(" · ") : "Sin equipos actuales asociados";
}

function EstadoRecibo({
  estado,
  pagoDeclarado,
}: {
  estado: string;
  pagoDeclarado: boolean;
}) {
  if (estado === "PAGADO") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Pagado
      </Badge>
    );
  }
  if (estado === "ANULADO") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Anulado
      </Badge>
    );
  }
  if (estado === "RECHAZADO") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Pago rechazado
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <Clock className="mr-1 h-3 w-3" />
      {pagoDeclarado ? "Pendiente de confirmar" : "Pendiente"}
    </Badge>
  );
}

function EstadoDocumento({ estado }: { estado: string }) {
  return (
    <Badge variant={estado === "VALIDADO" ? "success" : estado === "SUBIDO" ? "secondary" : "warning"}>
      {estado === "VALIDADO"
        ? "Validado"
        : estado === "SUBIDO"
          ? "Pendiente de revisión"
          : "Pendiente de subir"}
    </Badge>
  );
}

function Campo({
  label,
  valor,
  className,
}: {
  label: string;
  valor: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">
        {valor || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        {texto}
      </CardContent>
    </Card>
  );
}
