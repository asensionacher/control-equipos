import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { calcularEdad, formatearFecha, iniciales } from "@/lib/utils";
import Link from "next/link";
import { Users, UserCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardUsuarioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [misJugadores, jugadorPropio] = await Promise.all([
    prisma.jugador.findMany({
      where: { tutorias: { some: { usuarioId: session.user.id } }, activo: true },
      orderBy: { createdAt: "desc" },
      include: {
        asignaciones: {
          include: { equipo: { include: { temporada: true } } },
        },
      },
    }),
    prisma.jugador.findUnique({
      where: { usuarioId: session.user.id },
      include: {
        asignaciones: {
          include: { equipo: { include: { temporada: true } } },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Bienvenido, {session.user.nombre}
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tu perfil y los jugadores a tu cargo
        </p>
      </div>

      {jugadorPropio && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Tu ficha como jugador
            </CardTitle>
            <CardDescription>
              Esta es tu ficha personal. Puedes editar tus datos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {jugadorPropio.fotoUrl ? (
                    <AvatarImage src={jugadorPropio.fotoUrl} alt={jugadorPropio.nombre} />
                  ) : null}
                  <AvatarFallback>
                    {iniciales(jugadorPropio.nombre, jugadorPropio.apellidos)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {jugadorPropio.nombre} {jugadorPropio.apellidos}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {calcularEdad(jugadorPropio.fechaNacimiento)} años · Nacido el{" "}
                    {formatearFecha(jugadorPropio.fechaNacimiento)}
                  </div>
                </div>
              </div>
              <Button asChild>
                <Link href={`/dashboard/jugadores/${jugadorPropio.id}`}>Ver mi ficha completa</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5" />
          Jugadores que gestionas ({misJugadores.length})
        </h2>
        {misJugadores.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Aún no gestionas ningún jugador. Cuando un administrador te vincule a uno, aparecerá aquí.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {misJugadores.map((j) => (
              <Card key={j.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      {j.fotoUrl ? <AvatarImage src={j.fotoUrl} alt={j.nombre} /> : null}
                      <AvatarFallback>{iniciales(j.nombre, j.apellidos)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-lg">
                        {j.nombre} {j.apellidos}
                      </CardTitle>
                      <CardDescription>{calcularEdad(j.fechaNacimiento)} años</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Nacido el {formatearFecha(j.fechaNacimiento)}
                  </div>
                  {j.asignaciones.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium">Equipos</div>
                      <div className="flex flex-wrap gap-1">
                        {j.asignaciones.map((a) => (
                          <Badge key={a.id} variant="secondary" className="text-xs">
                            {a.equipo.nombre} ({a.equipo.temporada.nombre})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/dashboard/jugadores/${j.id}`}>
                      <Users className="h-4 w-4" />
                      Ver ficha completa
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
