import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { ArrowLeft, UserPlus, Send } from "lucide-react";
import { formatearFecha, iniciales } from "@/lib/utils";
import { ReenviarActivacionButton } from "./reenviar-activacion-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function FichaPadrePage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const padre = await prisma.usuario.findUnique({
    where: { id },
    include: {
      tutorias: {
        include: {
          jugador: {
            include: {
              asignaciones: {
                include: { equipo: { include: { temporada: true } } },
              },
            },
          },
        },
      },
      jugadorComoUsuario: true,
      passwordResetTokens: false,
    },
  });

  if (!padre) notFound();

  // Pending registration activa
  const pending = await prisma.pendingRegistration.findFirst({
    where: {
      email: padre.email,
      usado: false,
      expiresAt: { gt: new Date() },
    },
  });

  const temporadaActiva = await prisma.temporada.findFirst({
    where: { activa: true },
    orderBy: { fechaInicio: "desc" },
  });

  const pendienteActivar = !padre.passwordHash;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/padres"
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a padres
      </Link>

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
          <AvatarFallback className="text-lg">
            {iniciales(padre.nombre, padre.apellidos)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {padre.nombre} {padre.apellidos}
          </h1>
          <p className="text-sm text-muted-foreground">{padre.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">Padre/Tutor</Badge>
            {padre.jugadorComoUsuario && (
              <Badge variant="outline">También jugador</Badge>
            )}
            {pendienteActivar ? (
              <Badge variant="warning">Pendiente de activar</Badge>
            ) : (
              <Badge variant="success">Activo</Badge>
            )}
            <span className="text-muted-foreground">
              Miembro desde {formatearFecha(padre.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {pendienteActivar && (
        <Alert variant="warning">
          <AlertDescription>
            <strong>Cuenta pendiente de activar.</strong> El padre aún no ha elegido contraseña.
            {pending
              ? ` Hay una invitación pendiente (caduca el ${formatearFecha(pending.expiresAt)}).`
              : " No hay ninguna activación pendiente."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Campo label="Nombre completo" valor={`${padre.nombre} ${padre.apellidos}`} />
            <Campo label="Email" valor={padre.email} />
            <Campo label="Teléfono" valor={padre.telefono} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendienteActivar && <ReenviarActivacionButton usuarioId={padre.id} />}
            {padre.jugadorComoUsuario && (
              <Link
                href={`/admin/jugadores/${padre.jugadorComoUsuario.id}`}
                className="block text-blue-600 hover:underline font-medium"
              >
                Ver ficha de {padre.jugadorComoUsuario.nombre}{" "}
                {padre.jugadorComoUsuario.apellidos} →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Jugadores gestionados ({padre.tutorias.length})</CardTitle>
              <CardDescription>
                Jugadores de los que este usuario es tutor legal
              </CardDescription>
            </div>
            <Button asChild>
              <Link href={`/admin/jugadores/nuevo?tutorId=${padre.id}`}>
                <UserPlus className="h-4 w-4" />
                Vincular nuevo jugador
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {padre.tutorias.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Este padre aún no gestiona ningún jugador.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {padre.tutorias.map((t) => {
                const equipoActual = temporadaActiva
                  ? t.jugador.asignaciones.find((a) => a.equipo.temporadaId === temporadaActiva.id)
                  : null;
                return (
                  <Link
                    key={t.id}
                    href={`/admin/jugadores/${t.jugador.id}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {iniciales(t.jugador.nombre, t.jugador.apellidos)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {t.jugador.nombre} {t.jugador.apellidos}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {t.parentesco && <span>{t.parentesco}</span>}
                        {equipoActual && (
                          <Badge variant="secondary" className="text-xs">
                            {equipoActual.equipo.nombre}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
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
