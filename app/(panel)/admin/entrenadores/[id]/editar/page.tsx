import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditarEntrenadorForm } from "./form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function EditarEntrenadorPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const entrenador = await prisma.entrenador.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      email: true,
      telefono: true,
      telefonoAlternativo: true,
      observaciones: true,
      usuarioId: true,
      jugadorId: true,
    },
  });
  if (!entrenador) notFound();

  const [usuarios, jugadores] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        entrenadorComoUsuario: { select: { id: true } },
      },
    }),
    prisma.jugador.findMany({
      where: { activo: true },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        entrenadorComoJugador: { select: { id: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/admin/entrenadores/${entrenador.id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a la ficha
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Editar {entrenador.nombre} {entrenador.apellidos}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modifica los datos personales o las vinculaciones.
        </p>
      </div>
      <EditarEntrenadorForm
        entrenador={entrenador}
        usuariosDisponibles={usuarios.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          apellidos: u.apellidos,
          email: u.email,
          yaAsignado: Boolean(u.entrenadorComoUsuario),
        }))}
        jugadoresDisponibles={jugadores.map((j) => ({
          id: j.id,
          nombre: j.nombre,
          apellidos: j.apellidos,
          yaAsignado: Boolean(j.entrenadorComoJugador),
        }))}
      />
    </div>
  );
}
