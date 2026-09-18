import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { calcularEdad, formatearFecha, iniciales } from "@/lib/utils";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { BuscarJugadores } from "./buscar-cliente";
import { obtenerFotoJugadorSrc } from "@/lib/imagen-upload";

interface PageProps {
  searchParams: Promise<{ texto?: string; anio?: string; temporadaId?: string }>;
}

export const dynamic = "force-dynamic";

export default async function JugadoresPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const { texto, anio, temporadaId } = await searchParams;

  const where: any = { activo: true };

  if (texto && texto.trim()) {
    where.OR = [
      { nombre: { contains: texto.trim(), mode: "insensitive" } },
      { apellidos: { contains: texto.trim(), mode: "insensitive" } },
    ];
  }

  if (anio && /^\d{4}$/.test(anio)) {
    const inicio = new Date(`${anio}-01-01`);
    const fin = new Date(`${anio}-12-31`);
    where.fechaNacimiento = { gte: inicio, lte: fin };
  }

  // Determinar qué temporada mostrar
  const temporadas = await prisma.temporada.findMany({
    where: { activa: true },
    orderBy: { fechaInicio: "desc" },
  });
  const temporadaSeleccionada =
    (temporadaId && temporadas.find((t) => t.id === temporadaId)) || temporadas[0] || null;

  const jugadores = await prisma.jugador.findMany({
    where,
    orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    include: {
      tutorias: {
        where: { esPrincipal: true },
        include: { usuario: { select: { nombre: true, apellidos: true, email: true } } },
      },
      asignaciones: {
        where: temporadaSeleccionada
          ? { equipo: { temporadaId: temporadaSeleccionada.id } }
          : undefined,
        include: { equipo: { include: { temporada: true } } },
      },
    },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Jugadores</h1>
          <p className="text-sm text-muted-foreground">Listado completo de jugadores del club</p>
        </div>
        <Button asChild>
          <Link href="/admin/usuarios/nuevo?roles=jugador">
            <Plus className="h-4 w-4" />
            Nuevo jugador
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar jugadores</CardTitle>
          <CardDescription>
            Busca por nombre, apellidos o año de nacimiento
            {temporadas.length > 1 && (
              <span className="block mt-1">
                Mostrando equipos de:{" "}
                <strong>
                  {temporadaSeleccionada?.nombre ?? "(sin temporada)"}
                </strong>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BuscarJugadores />
          {temporadas.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Temporada:</span>
              {temporadas.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/jugadores?texto=${texto ?? ""}&anio=${anio ?? ""}&temporadaId=${t.id}`}
                >
                  <Badge variant={t.id === temporadaSeleccionada?.id ? "default" : "outline"}>
                    {t.nombre}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>
            {jugadores.length} jugador{jugadores.length === 1 ? "" : "es"} encontrado{jugadores.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {jugadores.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No se encontraron jugadores con esos criterios.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead className="hidden sm:table-cell">Edad</TableHead>
                  <TableHead className="hidden md:table-cell">Tutor</TableHead>
                  <TableHead>Equipo actual</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jugadores.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>
                      <Link href={`/admin/jugadores/${j.id}`} className="flex items-center gap-3 hover:underline">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={obtenerFotoJugadorSrc(j)} alt={j.nombre} />
                          <AvatarFallback>{iniciales(j.nombre, j.apellidos)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {j.nombre} {j.apellidos}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Nacido el {formatearFecha(j.fechaNacimiento)}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{calcularEdad(j.fechaNacimiento)} años</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {j.tutorias[0] ? (
                        <span className="text-sm">
                          {j.tutorias[0].usuario.nombre} {j.tutorias[0].usuario.apellidos}
                        </span>
                      ) : (
                        <Badge variant="warning">Sin tutor</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {j.asignaciones.length === 0 ? (
                        <Badge variant="outline">Sin equipo</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {j.asignaciones.map((a) => (
                            <Badge key={a.id} variant="secondary" className="text-xs">
                              {a.equipo.nombre}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/jugadores/${j.id}`}>Ver ficha</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
