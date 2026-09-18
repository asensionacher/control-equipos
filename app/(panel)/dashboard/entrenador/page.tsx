import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CalendarClock,
  UserCircle,
  UserCog,
  Users,
} from "lucide-react";
import { getEntrenadorDeUsuario, getEquiposComoJugador } from "@/lib/entrenador";
import { getDatosPersonales } from "@/lib/jugador-sync";
import { obtenerFotoJugadorSrc } from "@/lib/imagen-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  construirSlotsEntrenamientos,
  HorarioSemanal,
} from "@/components/horario-semanal";
import { iniciales } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalEntrenadorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [entrenador, equiposComoJugadorRaw] = await Promise.all([
    getEntrenadorDeUsuario(session.user.id),
    getEquiposComoJugador(session.user.id),
  ]);

  if (!entrenador) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver al panel
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Aún no eres entrenador</CardTitle>
            <CardDescription>
              Tu cuenta no está vinculada a ninguna ficha de entrenador del club. Pide al
              administrador que te dé de alta en el cuerpo técnico desde{" "}
              <Link href="/admin/entrenadores" className="underline font-medium">
                Entrenadores
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const equiposEntrenados = entrenador.equipos
    .map((a) => a.equipo)
    .filter((eq, idx, arr) => arr.findIndex((e) => e.id === eq.id) === idx);

  let datosJugador: Awaited<ReturnType<typeof getDatosPersonales>> | null = null;
  if (entrenador.jugador) {
    datosJugador = await getDatosPersonales(entrenador.jugador.id);
  }

  const slotsEntrenador = construirSlotsEntrenamientos(equiposEntrenados, "entrenador");
  const slotsJugador = construirSlotsEntrenamientos(equiposComoJugadorRaw, "jugador");
  const slots = [...slotsEntrenador, ...slotsJugador];

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver al panel
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Portal del entrenador</h1>
        <p className="text-sm text-muted-foreground">
          Aquí ves tus equipos como entrenador, junto con tu ficha de jugador (si juegas)
          y el rol de padre/tutor (si gestionas jugadores).
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 sm:h-20 sm:h-20">
          <AvatarFallback className="text-lg">{iniciales(entrenador.nombre, entrenador.apellidos)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-semibold">
            {entrenador.nombre} {entrenador.apellidos}
          </h2>
          <p className="text-sm text-muted-foreground">
            {entrenador.email ?? "Sin email"}
            {entrenador.telefono && <> · {entrenador.telefono}</>}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">Cuerpo técnico</Badge>
            {entrenador.jugador && <Badge variant="outline">También jugador</Badge>}
            {entrenador.usuario && <Badge variant="outline">Con acceso al portal</Badge>}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Equipos que entrenas ({equiposEntrenados.length})
          </CardTitle>
          <CardDescription>
            Equipos en los que estás asignado como entrenador en la temporada activa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {equiposEntrenados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes equipos asignados. Pide a un administrador que te asigne desde tu
              ficha de entrenador.
            </p>
          ) : (
            <ul className="space-y-2">
              {equiposEntrenados.map((eq) => (
                <li
                  key={eq.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{eq.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {eq.categoria ?? "—"}
                      {eq.temporada?.nombre ? ` · ${eq.temporada.nombre}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {eq.horariosEntrenamiento.length > 0 ? (
                      <Badge variant="secondary">
                        {eq.horariosEntrenamiento.length} horario
                        {eq.horariosEntrenamiento.length === 1 ? "" : "s"}
                      </Badge>
                    ) : (
                      <Badge variant="warning">Sin horarios</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Vista semanal de entrenamientos
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            Unificamos los horarios de los equipos que entrenas
            <UserCog className="inline h-3.5 w-3.5 text-blue-600" aria-hidden /> y los que
            juegas como jugador
            <UserCircle className="inline h-3.5 w-3.5 text-green-600" aria-hidden />.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HorarioSemanal slots={slots} emptyMessage="No hay entrenamientos configurados." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            ¿También eres jugador?
          </CardTitle>
          <CardDescription>
            Si entrenas pero también juegas en algún equipo, aquí ves tu ficha como jugador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!entrenador.jugador || !datosJugador ? (
            <p className="text-sm text-muted-foreground">
              No tienes ficha de jugador vinculada. Si también juegas, el administrador puede
              vincularla desde tu ficha de entrenador.
            </p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={obtenerFotoJugadorSrc(entrenador.jugador)}
                    alt={datosJugador.nombre}
                  />
                  <AvatarFallback>{iniciales(datosJugador.nombre, datosJugador.apellidos)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {datosJugador.nombre} {datosJugador.apellidos}
                  </div>
                  {datosJugador.email && (
                    <div className="text-xs text-muted-foreground">{datosJugador.email}</div>
                  )}
                </div>
              </div>
              <Button asChild variant="outline">
                <Link href={`/dashboard/jugadores/${entrenador.jugador.id}`}>
                  Ver ficha completa
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            ¿También eres padre/tutor?
          </CardTitle>
          <CardDescription>
            Si gestionas jugadores a tu cargo, los encontrarás en el panel principal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard">Ir al panel de jugadores gestionados</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
