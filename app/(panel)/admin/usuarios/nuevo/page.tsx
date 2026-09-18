import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WizardUsuarioForm } from "./form";

export const dynamic = "force-dynamic";

export interface EquipoLite {
  id: string;
  nombre: string;
  categoria: string | null;
}
export interface JugadorLite {
  id: string;
  nombre: string;
  apellidos: string;
}
export interface JugadorVinculable {
  id: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: string;
}

interface PageProps {
  searchParams: Promise<{
    rol?: string;
    roles?: string;
    desde?: string;
  }>;
}

export default async function NuevoUsuarioPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");
  const sp = await searchParams;

  // Defaults a partir de query params
  const rolBase: "ADMIN" | "USUARIO" = sp.rol === "ADMIN" ? "ADMIN" : "USUARIO";
  const flags = (sp.roles ?? "").split(",").filter(Boolean);
  const esPadre = flags.includes("padre");
  const esJugador = flags.includes("jugador");
  const esEntrenador = flags.includes("entrenador");
  const desdePanelAdmin = sp.desde === "admin";

  const [equipos, jugadoresACargoDisponibles, jugadoresVinculables] = await Promise.all([
    prisma.equipo.findMany({
      where: { activo: true },
      orderBy: [{ temporada: { fechaInicio: "desc" } }, { nombre: "asc" }],
      select: { id: true, nombre: true, categoria: true },
    }),
    prisma.jugador.findMany({
      where: {
        activo: true,
        // Solo listar jugadores que NO tienen tutor principal
        tutorias: { none: { esPrincipal: true } },
      },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, apellidos: true },
    }),
    prisma.jugador.findMany({
      where: {
        activo: true,
        // Jugadores sin Usuario asociado (no pueden ser ellos mismos su propia cuenta)
        usuarioId: null,
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={desdePanelAdmin ? "/admin" : "/admin/usuarios"}
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Crear usuario</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea un usuario y, opcionalmente, asígnale los roles que necesite (padre,
          jugador, entrenador). Puedes combinar varios roles a la vez.
        </p>
      </div>
      <WizardUsuarioForm
        equipos={equipos.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          categoria: e.categoria,
        }))}
        jugadoresACargoDisponibles={jugadoresACargoDisponibles.map((j) => ({
          id: j.id,
          nombre: j.nombre,
          apellidos: j.apellidos,
        }))}
        jugadoresVinculables={jugadoresVinculables.map((j) => ({
          id: j.id,
          nombre: j.nombre,
          apellidos: j.apellidos,
          fechaNacimiento: j.fechaNacimiento.toISOString().slice(0, 10),
        }))}
        defaults={{
          rolBase,
          esPadre,
          esJugador,
          esEntrenador,
          desdePanelAdmin,
        }}
      />
    </div>
  );
}
