import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearFecha, iniciales } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ texto?: string }>;
}

export default async function PadresPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");
  const { texto } = await searchParams;

  const where: any = { rol: "USUARIO" };
  if (texto?.trim()) {
    where.OR = [
      { nombre: { contains: texto.trim(), mode: "insensitive" } },
      { apellidos: { contains: texto.trim(), mode: "insensitive" } },
      { email: { contains: texto.trim(), mode: "insensitive" } },
    ];
  }

  const padres = await prisma.usuario.findMany({
    where,
    orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    include: {
      _count: {
        select: {
          tutorias: true,
        },
      },
      jugadorComoUsuario: {
        select: { id: true, nombre: true, apellidos: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Padres y tutores</h1>
          <p className="text-sm text-muted-foreground">
            Usuarios con cuenta que gestionan jugadores
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/usuarios/nuevo?roles=padre">
            <Plus className="h-4 w-4" />
            Nuevo padre
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
                placeholder="Buscar padre o tutor..."
                className="pl-9"
              />
            </div>
            <Button type="submit">Buscar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de padres</CardTitle>
          <CardDescription>
            {padres.length} padre{padres.length === 1 ? "" : "s"} / tutor{padres.length === 1 ? "" : "es"} con cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {padres.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay padres registrados. Crea el primero.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Jugadores</TableHead>
                  <TableHead className="hidden lg:table-cell">Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {padres.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{iniciales(p.nombre, p.apellidos)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/padres/${p.id}`} className="font-medium hover:underline">
                              {p.nombre} {p.apellidos}
                            </Link>
                            {p.jugadorComoUsuario && (
                              <Badge variant="outline" className="text-xs">
                                Jugador
                              </Badge>
                            )}
                          </div>
                          {p.telefono && (
                            <div className="text-xs text-muted-foreground">{p.telefono}</div>
                          )}
                          {p.telefonoAlternativo && (
                            <div className="text-xs text-muted-foreground">
                              {p.telefonoAlternativo}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{p.email ?? "—"}</TableCell>
                    <TableCell>
                      {p.passwordHash ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p._count.tutorias}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{formatearFecha(p.createdAt)}</TableCell>
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
