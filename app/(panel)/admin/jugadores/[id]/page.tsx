import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calcularEdad, formatearFecha, formatearNumeroRecibo, iniciales } from "@/lib/utils";
import Link from "next/link";
import { Pencil, Mail, Users, Trophy, ExternalLink, UserPlus, FileText } from "lucide-react";
import { EliminarJugadorButton } from "./eliminar-button";
import { AsignarEquipos } from "./asignar-equipos";
import { CrearActivacionJugador } from "./crear-activacion-jugador";
import { getDatosPersonales } from "@/lib/jugador-sync";
import { formatearEquiposAsignados } from "@/lib/asignacion-equipos";
import { obtenerFotoJugadorSrc } from "@/lib/imagen-upload";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function FichaJugadorPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const jugador = await prisma.jugador.findUnique({
    where: { id },
    include: {
      tutorias: {
        include: { usuario: true },
        orderBy: [{ esPrincipal: "desc" }, { createdAt: "asc" }],
      },
      asignaciones: {
        include: { equipo: { include: { temporada: true } } },
        orderBy: { fechaAsignacion: "desc" },
      },
      usuario: {
        select: { id: true, nombre: true, email: true },
      },
      recibosJugador: {
        include: {
          recibo: {
            include: {
              equipo: { include: { temporada: true } },
              equipos: { include: { temporada: true } },
            },
          },
        },
        orderBy: [
          { recibo: { fechaEmision: "desc" } },
          { numero: "desc" },
        ],
      },
    },
  });

  if (!jugador) notFound();

  const datosPersonales = await getDatosPersonales(jugador.id);

  const temporadas = await prisma.temporada.findMany({
    where: { activa: true },
    include: {
      equipos: {
        where: { activo: true },
        orderBy: { nombre: "asc" },
      },
    },
    orderBy: { fechaInicio: "desc" },
  });

  const equiposAsignadosIds = new Set(jugador.asignaciones.map((a) => a.equipoId));

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

  const tutoriaPrincipal = jugador.tutorias.find((t) => t.esPrincipal);
  const sinTutorYSinUsuario = jugador.tutorias.length === 0 && !jugador.usuario;

  // Pending activation del propio jugador
  const pendingJugador = jugador.email
    ? await prisma.pendingRegistration.findFirst({
        where: {
          email: jugador.email.toLowerCase(),
          jugadorId: jugador.id,
          usado: false,
          expiresAt: { gt: new Date() },
        },
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
            <AvatarImage src={obtenerFotoJugadorSrc(jugador)} alt={jugador.nombre} />
            <AvatarFallback className="text-lg">{iniciales(jugador.nombre, jugador.apellidos)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {datosPersonales.nombre} {datosPersonales.apellidos}
            </h1>
            <p className="text-sm text-muted-foreground">
              {calcularEdad(jugador.fechaNacimiento)} años · Nacido el {formatearFecha(jugador.fechaNacimiento)}
              {datosPersonales.email && (
                <> · <a href={`mailto:${datosPersonales.email}`} className="hover:underline">{datosPersonales.email}</a></>
              )}
              {datosPersonales.telefono && (
                <> · {datosPersonales.telefono}</>
              )}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {jugador.usuario && (
                <Badge variant="outline">Tiene cuenta propia</Badge>
              )}
              {tutoriaPrincipal ? (
                <Badge variant="success">Con tutor</Badge>
              ) : (
                <Badge variant="warning">Sin tutor</Badge>
              )}
              {!jugador.activo && (
                <Badge variant="destructive">Inactivo</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/jugadores/${jugador.id}/editar`}>
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          </Button>
          <EliminarJugadorButton id={jugador.id} nombre={`${jugador.nombre} ${jugador.apellidos}`} />
        </div>
      </div>

      {sinTutorYSinUsuario && (
        <Alert>
          <UserPlus className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Este jugador no tiene tutor asignado ni cuenta propia. Puedes:
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
              <li>
                <strong>Vincular un tutor existente</strong> editando la ficha.
              </li>
              <li>
                <strong>Crear un nuevo tutor</strong> que lo gestione (con email de activación).
              </li>
              {jugador.email && (
                <li>
                  <strong>Generar activación para el propio jugador</strong> si debe gestionar su
                  propia ficha (introduce el email abajo).
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
            <CardDescription>
              Datos sincronizados: si el jugador tiene cuenta propia, se muestran los datos de su Usuario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Campo label="Nombre" valor={`${datosPersonales.nombre} ${datosPersonales.apellidos}`} />
            <Campo label="DNI/NIE" valor={jugador.dniNie} />
            <Campo label="Sexo" valor={jugador.sexo ? jugador.sexo.toLowerCase() : null} />
            <Campo label="Email" valor={datosPersonales.email} />
            <Campo label="Teléfono" valor={datosPersonales.telefono} />
            <Campo label="Dirección" valor={jugador.direccion} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tutores legales</CardTitle>
            <CardDescription>
              {jugador.tutorias.length === 0
                ? "Este jugador no tiene tutores asignados"
                : `${jugador.tutorias.length} tutor${jugador.tutorias.length === 1 ? "" : "es"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jugador.tutorias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Puedes vincular un tutor editando la ficha del jugador.
              </p>
            ) : (
              <ul className="space-y-3">
                {jugador.tutorias.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/padres/${t.usuario.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.usuario.nombre} {t.usuario.apellidos}
                      </Link>
                      <div className="text-xs text-muted-foreground">{t.usuario.email}</div>
                      {t.parentesco && (
                        <div className="text-xs text-muted-foreground">{t.parentesco}</div>
                      )}
                    </div>
                    {t.esPrincipal && <Badge variant="secondary">Principal</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {sinTutorYSinUsuario && jugador.email && (
        <Card>
          <CardHeader>
            <CardTitle>Activar cuenta propia</CardTitle>
            <CardDescription>
              Enviar al jugador un email para que active su cuenta y gestione su propia ficha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CrearActivacionJugador jugadorId={jugador.id} email={jugador.email} />
            {pendingJugador && (
              <p className="mt-3 text-xs text-muted-foreground">
                Ya hay una activación pendiente (caduca el{" "}
                {formatearFecha(pendingJugador.expiresAt)}).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {jugador.usuario && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Cuenta propia
            </CardTitle>
            <CardDescription>
              Este jugador también tiene cuenta de usuario (puede iniciar sesión con su email)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/usuarios`}
              className="text-blue-600 hover:underline font-medium"
            >
              {jugador.usuario.nombre} · {jugador.usuario.email}
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Equipos asignados
          </CardTitle>
          <CardDescription>
            Marca los equipos en los que juega en las temporadas activas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AsignarEquipos
            jugadorId={jugador.id}
            temporadas={temporadas.map((t) => ({
              id: t.id,
              nombre: t.nombre,
              equipos: t.equipos.map((e) => ({ id: e.id, nombre: e.nombre, categoria: e.categoria })),
            }))}
            equiposAsignadosIds={Array.from(equiposAsignadosIds)}
          />
        </CardContent>
      </Card>

      {historialTemporadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Historial de equipos
            </CardTitle>
            <CardDescription>
              Equipos en los que ha estado inscrito el jugador a lo largo de todas las temporadas
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                        <Link
                          href={`/admin/equipos/${a.equipo.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {a.equipo.nombre}
                          {a.equipo.categoria && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({a.equipo.categoria})
                            </span>
                          )}
                        </Link>
                        {a.equipo.urlLiga && (
                          <a
                            href={a.equipo.urlLiga}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-600"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver liga
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recibos asignados
          </CardTitle>
          <CardDescription>
            Todos los recibos emitidos a este jugador, del más nuevo al más antiguo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jugador.recibosJugador.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este jugador no tiene recibos asignados todavía.
            </p>
          ) : (
            <ul className="space-y-2">
              {jugador.recibosJugador.map((rj) => (
                <li key={rj.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div>
                    <Link href={`/admin/recibos/${rj.reciboId}`} className="font-medium hover:underline">
                      {formatearNumeroRecibo(rj.numero)} · {rj.recibo.concepto}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {formatearFecha(rj.recibo.fechaEmision)}
                      {formatearEquiposAsignados(rj.recibo) && (
                        <> · {formatearEquiposAsignados(rj.recibo)}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rj.recibo.total.toString()} €</span>
                    <Badge
                      variant={
                        rj.estado === "PAGADO"
                          ? "success"
                          : rj.estado === "ANULADO"
                          ? "destructive"
                          : "warning"
                      }
                    >
                      {rj.estado === "PAGADO"
                        ? "Pagado"
                        : rj.estado === "ANULADO"
                        ? "Anulado"
                        : "Pendiente"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
