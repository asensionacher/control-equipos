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
import { formatearFecha, iniciales } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    texto?: string;
    rol?: string;
  }>;
}

const ROL_LABELS: Record<string, string> = {
  ADMIN: "ADMIN",
  USUARIO: "USUARIO",
};

export default async function UsuariosPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");
  const { texto, rol } = await searchParams;

  const where: Record<string, unknown> = {};
  if (texto?.trim()) {
    where.OR = [
      { nombre: { contains: texto.trim(), mode: "insensitive" } },
      { apellidos: { contains: texto.trim(), mode: "insensitive" } },
      { email: { contains: texto.trim(), mode: "insensitive" } },
      { dniNie: { contains: texto.trim(), mode: "insensitive" } },
      { telefono: { contains: texto.trim(), mode: "insensitive" } },
    ];
  }
  if (rol === "ADMIN" || rol === "USUARIO") where.rol = rol;

  const usuarios = await prisma.usuario.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      _count: {
        select: { tutorias: true },
      },
      jugadorComoUsuario: { select: { id: true } },
      entrenadorComoUsuario: { select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Lista completa de usuarios del sistema (administradores y cuentas con acceso al portal).
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/usuarios/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar</CardTitle>
          <CardDescription>Busca por nombre, apellidos, email, DNI o teléfono. Filtra por rol.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="texto"
                defaultValue={texto ?? ""}
                placeholder="Buscar usuario..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                name="rol"
                value={rol === "ADMIN" ? "" : "ADMIN"}
                variant={rol === "ADMIN" ? "default" : "outline"}
              >
                Usuarios
              </Button>
              <Button
                type="submit"
                name="rol"
                value={rol === "USUARIO" ? "" : "USUARIO"}
                variant={rol === "USUARIO" ? "default" : "outline"}
              >
                Usuarios
              </Button>
              {(rol || texto) && (
                <Button asChild variant="ghost">
                  <Link href="/admin/usuarios">Limpiar</Link>
                </Button>
              )}
            </div>
            <input type="hidden" name="rol" value="" />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>
            {usuarios.length} usuario{usuarios.length === 1 ? "" : "s"}
            {rol ? ` (${ROL_LABELS[rol]})` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {usuarios.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay usuarios con esos criterios.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="hidden lg:table-cell">Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{iniciales(u.nombre, u.apellidos)}</AvatarFallback>
                        </Avatar>
                        <Link
                          href={`/admin/usuarios/${u.id}`}
                          className="font-medium hover:underline"
                        >
                          {u.nombre} {u.apellidos}
                        </Link>
                        {u.id === session.user.id && (
                          <Badge variant="outline" className="text-xs">
                            Tú
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={u.rol === "ADMIN" ? "default" : "secondary"}>
                          {u.rol}
                        </Badge>
                        {u.jugadorComoUsuario && (
                          <Badge variant="outline" className="text-xs">
                            Jugador
                          </Badge>
                        )}
                        {u._count.tutorias > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Padre · {u._count.tutorias}
                          </Badge>
                        )}
                        {u.entrenadorComoUsuario && (
                          <Badge variant="outline" className="text-xs">
                            Entrenador
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {u.emailVerificado ? (
                        <Badge variant="success">Verificado</Badge>
                      ) : (
                        <Badge variant="warning">Sin verificar</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatearFecha(u.createdAt)}
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
