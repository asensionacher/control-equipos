import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { iniciales } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ texto?: string }>;
}

const ROL_LABELS: Record<string, string> = {
  ENTRENADOR_PRINCIPAL: "Entrenador principal",
  ENTRENADOR_AYUDANTE: "Ayudante",
  PREPARADOR_FISICO: "Preparador físico",
  COORDINADOR: "Coordinador",
};

export default async function EntrenadoresPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");
  const { texto } = await searchParams;

  const where: Record<string, unknown> = {};
  if (texto?.trim()) {
    where.OR = [
      { nombre: { contains: texto.trim(), mode: "insensitive" } },
      { apellidos: { contains: texto.trim(), mode: "insensitive" } },
      { email: { contains: texto.trim(), mode: "insensitive" } },
    ];
  }

  const entrenadores = await prisma.entrenador.findMany({
    where,
    orderBy: [{ activo: "desc" }, { apellidos: "asc" }, { nombre: "asc" }],
    include: {
      equipos: {
        include: {
          equipo: { include: { temporada: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      usuario: { select: { id: true, email: true } },
      jugador: { select: { id: true, nombre: true, apellidos: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Entrenadores</h1>
          <p className="text-sm text-muted-foreground">
            Cuerpo técnico del club. Asigna cada entrenador a uno o varios equipos.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/usuarios/nuevo?roles=entrenador">
            <Plus className="h-4 w-4" />
            Nuevo entrenador
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar</CardTitle>
          <CardDescription>Busca por nombre, apellidos o email</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" method="get">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="texto"
                defaultValue={texto ?? ""}
                placeholder="Buscar entrenador..."
                className="pl-9"
              />
            </div>
            <Button type="submit">Buscar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de entrenadores</CardTitle>
          <CardDescription>
            {entrenadores.length} entrenador{entrenadores.length === 1 ? "" : "es"} registrado
            {entrenadores.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {entrenadores.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay entrenadores registrados. Crea el primero.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead className="hidden md:table-cell">Contacto</TableHead>
                  <TableHead>Equipos</TableHead>
                  <TableHead className="hidden lg:table-cell">Vinculación</TableHead>
                  <TableHead className="hidden lg:table-cell">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entrenadores.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{iniciales(e.nombre, e.apellidos)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/entrenadores/${e.id}`}
                            className="font-medium hover:underline"
                          >
                            {e.nombre} {e.apellidos}
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {e.email && <div className="text-sm">{e.email}</div>}
                      {e.telefono && (
                        <div className="text-xs text-muted-foreground">{e.telefono}</div>
                      )}
                      {e.telefonoAlternativo && (
                        <div className="text-xs text-muted-foreground">
                          {e.telefonoAlternativo}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.equipos.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin equipos</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {e.equipos.slice(0, 3).map((asig) => (
                            <Badge key={asig.id} variant="secondary" className="text-xs">
                              {asig.equipo.nombre}
                            </Badge>
                          ))}
                          {e.equipos.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{e.equipos.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col gap-1">
                        {e.usuario && (
                          <Badge variant="outline" className="w-fit text-xs">
                            Con acceso
                          </Badge>
                        )}
                        {e.jugador && (
                          <Badge variant="outline" className="w-fit text-xs">
                            También jugador
                          </Badge>
                        )}
                        {!e.usuario && !e.jugador && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {e.activo ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="warning">Inactivo</Badge>
                      )}
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
