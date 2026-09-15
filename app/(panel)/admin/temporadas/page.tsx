import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearFecha } from "@/lib/utils";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { EliminarTemporadaButton } from "./eliminar-button";

export default async function TemporadasPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const temporadas = await prisma.temporada.findMany({
    orderBy: { fechaInicio: "desc" },
    include: { _count: { select: { equipos: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Temporadas</h1>
          <p className="text-sm text-muted-foreground">Gestiona las temporadas del club</p>
        </div>
        <Button asChild>
          <Link href="/admin/temporadas/nueva">
            <Plus className="h-4 w-4" />
            Nueva temporada
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de temporadas</CardTitle>
          <CardDescription>{temporadas.length} temporadas registradas</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {temporadas.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay temporadas registradas. Crea la primera.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Fecha inicio</TableHead>
                  <TableHead className="hidden sm:table-cell">Fecha fin</TableHead>
                  <TableHead className="hidden md:table-cell">Equipos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {temporadas.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nombre}</TableCell>
                    <TableCell className="hidden sm:table-cell">{formatearFecha(t.fechaInicio)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{formatearFecha(t.fechaFin)}</TableCell>
                    <TableCell className="hidden md:table-cell">{t._count.equipos}</TableCell>
                    <TableCell>
                      <Badge variant={t.activa ? "success" : "secondary"}>
                        {t.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/temporadas/${t.id}/editar`}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only sm:not-sr-only sm:ml-1">Editar</span>
                          </Link>
                        </Button>
                        <EliminarTemporadaButton id={t.id} nombre={t.nombre} />
                      </div>
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
