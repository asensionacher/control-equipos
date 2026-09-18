import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Plus, Pencil, Users, ExternalLink } from "lucide-react";
import { getConfiguracionClub } from "@/lib/club-utils";
import { EliminarEquipoButton } from "./eliminar-button";
import { ImportarEquiposFcfButton } from "./importar-fcf-button";

export default async function EquiposPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const [equipos, club, temporadaActiva] = await Promise.all([
    prisma.equipo.findMany({
      where: { activo: true },
      include: {
        temporada: true,
        _count: { select: { asignaciones: true } },
      },
      orderBy: [{ temporada: { fechaInicio: "desc" } }, { nombre: "asc" }],
    }),
    getConfiguracionClub(),
    prisma.temporada.findFirst({
      where: { activa: true },
      orderBy: { fechaInicio: "desc" },
      select: { nombre: true },
    }),
  ]);

  const agrupadosPorTemporada = equipos.reduce<Record<string, typeof equipos>>((acc, equipo) => {
    const key = equipo.temporada.nombre;
    if (!acc[key]) acc[key] = [];
    acc[key].push(equipo);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Equipos</h1>
          <p className="text-sm text-muted-foreground">Gestiona los equipos por temporada</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            {club.codigoFcf && (
              <ImportarEquiposFcfButton temporadaNombre={temporadaActiva?.nombre ?? null} />
            )}
            <Button asChild>
              <Link href="/admin/equipos/nuevo">
                <Plus className="h-4 w-4" />
                Nuevo equipo
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {Object.keys(agrupadosPorTemporada).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No hay equipos creados. Primero crea una temporada y luego añade equipos.
          </CardContent>
        </Card>
      ) : (
        Object.entries(agrupadosPorTemporada).map(([nombreTemporada, equiposTemp]) => (
          <Card key={nombreTemporada}>
            <CardHeader>
              <CardTitle>Temporada {nombreTemporada}</CardTitle>
              <CardDescription>{equiposTemp.length} equipos</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead className="hidden md:table-cell">Código FCF</TableHead>
                    <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                    <TableHead>Jugadores</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equiposTemp.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/equipos/${e.id}`} className="font-medium hover:underline">
                            {e.nombre}
                          </Link>
                          {e.urlLiga && (
                            <a
                              href={e.urlLiga}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-blue-600"
                              title="Ver liga"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {e.codigoFcf || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {e.categoria || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Users className="mr-1 h-3 w-3" />
                          {e._count.asignaciones}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/admin/equipos/${e.id}`}>
                              <Users className="h-4 w-4" />
                              <span className="sr-only sm:not-sr-only sm:ml-1">Ver</span>
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/admin/equipos/${e.id}/editar`}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only sm:not-sr-only sm:ml-1">Editar</span>
                            </Link>
                          </Button>
                          <EliminarEquipoButton id={e.id} nombre={e.nombre} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
