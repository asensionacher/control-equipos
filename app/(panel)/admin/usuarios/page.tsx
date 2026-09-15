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
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const admins = await prisma.usuario.findMany({
    where: { rol: "ADMIN" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Administradores</h1>
          <p className="text-sm text-muted-foreground">
            Cuentas con acceso completo al sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/usuarios/nuevo-admin">
            <Plus className="h-4 w-4" />
            Nuevo administrador
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>
            {admins.length} administrador{admins.length === 1 ? "" : "es"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{iniciales(u.nombre, u.apellidos)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {u.nombre} {u.apellidos}
                          {u.id === session.user.id && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Tú
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{u.email}</TableCell>
                  <TableCell className="hidden lg:table-cell">{formatearFecha(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
