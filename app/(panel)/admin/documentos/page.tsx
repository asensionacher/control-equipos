import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatearFecha } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EquiposAsignadosCeldas } from "@/components/equipos-asignados-celda";

export const dynamic = "force-dynamic";

export default async function DocumentosAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const solicitudes = await prisma.solicitudDocumento.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      equipo: { include: { temporada: true } },
      equipos: { include: { temporada: true } },
      jugadores: { select: { estado: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Solicita PDFs a jugadores o equipos y revisa los archivos recibidos.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/documentos/nuevo">
            <Plus className="h-4 w-4" />
            Solicitar documento
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes</CardTitle>
          <CardDescription>{solicitudes.length} solicitudes creadas</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {solicitudes.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay documentos solicitados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead className="hidden sm:table-cell">Asignación</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitudes.map((solicitud) => {
                  const validados = solicitud.jugadores.filter((j) => j.estado === "VALIDADO").length;
                  const subidos = solicitud.jugadores.filter((j) => j.estado === "SUBIDO").length;
                  return (
                    <TableRow key={solicitud.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <FileText className="h-4 w-4" />
                          {solicitud.nombre}
                        </div>
                        {solicitud.descripcion && (
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {solicitud.descripcion}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <EquiposAsignadosCeldas
                          origen={solicitud}
                          fallbackVacio="Jugadores concretos"
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatearFecha(solicitud.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {validados}/{solicitud.jugadores.length} validados
                        </div>
                        {subidos > 0 && (
                          <div className="text-xs text-blue-700">{subidos} por revisar</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/documentos/${solicitud.id}`}>Revisar</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
