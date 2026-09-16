import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, FileSignature, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatearFecha } from "@/lib/utils";
import { obtenerTextoConsentimiento } from "@/lib/consentimiento-contenido";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ConsentimientosAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");
  const consentimientos = await prisma.consentimiento.findMany({
    orderBy: { createdAt: "desc" },
    include: { jugadores: { select: { estado: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Consentimientos</h1>
          <p className="text-sm text-muted-foreground">
            Solicita y consulta consentimientos firmados digitalmente.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/consentimientos/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo consentimiento
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consentimientos creados</CardTitle>
          <CardDescription>{consentimientos.length} consentimientos</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {consentimientos.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay consentimientos creados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consentimiento</TableHead>
                  <TableHead className="hidden sm:table-cell">Creado</TableHead>
                  <TableHead>Firmas</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consentimientos.map((consentimiento) => {
                  const firmados = consentimiento.jugadores.filter(
                    ({ estado }) => estado === "FIRMADO"
                  ).length;
                  return (
                    <TableRow key={consentimiento.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <FileSignature className="h-4 w-4" />
                          {consentimiento.titulo}
                        </div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {obtenerTextoConsentimiento(consentimiento.descripcion)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatearFecha(consentimiento.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          {firmados}/{consentimiento.jugadores.length}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/consentimientos/${consentimiento.id}`}>Gestionar</Link>
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
