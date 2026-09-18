import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
import { formatearFecha, iniciales } from "@/lib/utils";
import { EditorDatosUsuario } from "./editor-datos";
import { PanelPadre } from "./panel-padre";
import { PanelJugador } from "./panel-jugador";
import { PanelEntrenador } from "./panel-entrenador";
import { CambioPasswordAdmin } from "./cambio-password-admin";
import { formatearFechaInput } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pwd?: string }>;
}

export const dynamic = "force-dynamic";

export default async function FichaUsuarioPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { pwd } = await searchParams;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    include: {
      _count: {
        select: { tutorias: true },
      },
      jugadorComoUsuario: {
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          fechaNacimiento: true,
          asignaciones: {
            include: {
              equipo: { select: { id: true, nombre: true } },
            },
            orderBy: { fechaAsignacion: "desc" },
          },
        },
      },
      entrenadorComoUsuario: {
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          equipos: {
            include: {
              equipo: {
                select: { id: true, nombre: true, categoria: true },
              },
            },
          },
        },
      },
      tutorias: {
        include: {
          jugador: { select: { id: true, nombre: true, apellidos: true } },
        },
      },
    },
  });
  if (!usuario) notFound();

  const [equipos, jugadoresVinculables] = await Promise.all([
    prisma.equipo.findMany({
      where: { activo: true },
      orderBy: [{ temporada: { fechaInicio: "desc" } }, { nombre: "asc" }],
      select: { id: true, nombre: true, categoria: true },
    }),
    prisma.jugador.findMany({
      where: {
        activo: true,
        usuarioId: null,
        NOT: { id: usuario.jugadorComoUsuario?.id ?? "__none__" },
      },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        fechaNacimiento: true,
      },
    }),
  ]);

  const jugadoresACargoUsuariosIds = new Set(usuario.tutorias.map((t) => t.jugadorId));
  const jugadoresACargoDisponibles = await prisma.jugador.findMany({
    where: {
      activo: true,
      tutorias: { none: { esPrincipal: true } },
    },
    orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, apellidos: true },
  });

  const jugador = usuario.jugadorComoUsuario
    ? {
        id: usuario.jugadorComoUsuario.id,
        nombre: usuario.jugadorComoUsuario.nombre,
        apellidos: usuario.jugadorComoUsuario.apellidos,
        fechaNacimiento: formatearFecha(usuario.jugadorComoUsuario.fechaNacimiento),
        equipos: usuario.jugadorComoUsuario.asignaciones.map((a) => ({
          id: a.id,
          equipoId: a.equipo.id,
          equipoNombre: a.equipo.nombre,
          fechaAsignacion: formatearFecha(a.fechaAsignacion),
        })),
      }
    : null;

  const entrenador = usuario.entrenadorComoUsuario
    ? {
        id: usuario.entrenadorComoUsuario.id,
        nombre: usuario.entrenadorComoUsuario.nombre,
        apellidos: usuario.entrenadorComoUsuario.apellidos,
        equipos: usuario.entrenadorComoUsuario.equipos.map((a) => ({
          id: a.id,
          equipoId: a.equipo.id,
          equipoNombre: a.equipo.nombre,
          equipoCategoria: a.equipo.categoria,
          rol: a.rol,
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/usuarios"
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver al listado
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 sm:h-20 sm:h-20">
            <AvatarFallback className="text-lg">
              {iniciales(usuario.nombre, usuario.apellidos)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {usuario.nombre} {usuario.apellidos}
            </h1>
            <p className="text-sm text-muted-foreground">{usuario.email ?? "Sin email"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={usuario.rol === "ADMIN" ? "default" : "secondary"}>
                {usuario.rol}
              </Badge>
              {!usuario.email ? (
                <Badge variant="warning">Sin email (sin acceso al portal)</Badge>
              ) : usuario.emailVerificado ? (
                <Badge variant="success">Email verificado</Badge>
              ) : (
                <Badge variant="warning">Email sin verificar</Badge>
              )}
              {jugador && <Badge variant="outline">Jugador</Badge>}
              {usuario._count.tutorias > 0 && (
                <Badge variant="outline">
                  Padre ({usuario._count.tutorias})
                </Badge>
              )}
              {entrenador && <Badge variant="outline">Entrenador</Badge>}
              <span className="text-muted-foreground">
                Alta {formatearFecha(usuario.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {pwd === "1" && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-100">
              Contraseña generada
            </CardTitle>
            <CardDescription className="text-amber-900 dark:text-amber-200">
              Como no escribiste contraseña, se generó una automáticamente. Apunta la
              siguiente contraseña temporal antes de abandonar esta página:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-amber-100 px-3 py-2 font-mono text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 break-all">
              Ver en server logs (rotar antes de cerrar esta vista)
            </code>
          </CardContent>
        </Card>
      )}

      <EditorDatosUsuario
        usuario={{
          id: usuario.id,
          nombre: usuario.nombre,
          apellidos: usuario.apellidos,
          email: usuario.email,
          telefono: usuario.telefono,
          telefonoAlternativo: usuario.telefonoAlternativo,
          fechaNacimiento: usuario.fechaNacimiento
            ? usuario.fechaNacimiento.toISOString()
            : null,
          dniNie: usuario.dniNie,
          rol: usuario.rol,
          emailVerificado: usuario.emailVerificado,
        }}
      />

      <CambioPasswordAdmin usuarioId={usuario.id} />

      <PanelPadre
        usuarioId={usuario.id}
        tutoriasActuales={usuario.tutorias.map((t) => ({
          id: t.id,
          jugadorId: t.jugador.id,
          jugadorNombre: t.jugador.nombre,
          jugadorApellidos: t.jugador.apellidos,
          parentesco: t.parentesco,
          esPrincipal: t.esPrincipal,
        }))}
        jugadoresDisponibles={jugadoresACargoDisponibles.filter(
          (j) => !jugadoresACargoUsuariosIds.has(j.id)
        )}
      />

      <PanelJugador
        usuarioId={usuario.id}
        jugador={jugador}
        jugadoresVinculables={jugadoresVinculables.map((j) => ({
          id: j.id,
          nombre: j.nombre,
          apellidos: j.apellidos,
          fechaNacimiento: j.fechaNacimiento.toISOString().slice(0, 10),
        }))}
        equiposDisponibles={equipos}
      />

      <PanelEntrenador
        usuarioId={usuario.id}
        entrenador={
          entrenador
            ? {
                id: entrenador.id,
                nombre: entrenador.nombre,
                apellidos: entrenador.apellidos,
                equipos: entrenador.equipos,
              }
            : null
        }
        equiposDisponibles={equipos}
      />
    </div>
  );
}
