import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatearFecha, iniciales } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PerfilForm } from "./perfil-form";
import { CambioPasswordForm } from "./cambio-password-form";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: {
      _count: { select: { tutorias: true } },
    },
  });

  if (!usuario) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg">
            {iniciales(usuario.nombre, usuario.apellidos)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {usuario.nombre} {usuario.apellidos}
          </h1>
          <p className="text-sm text-muted-foreground">{usuario.email ?? "Sin email"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={usuario.rol === "ADMIN" ? "default" : "secondary"}>{usuario.rol}</Badge>
            <span className="text-muted-foreground">
              Miembro desde {formatearFecha(usuario.createdAt)}
            </span>
            {usuario.rol === "USUARIO" && (
              <span className="text-muted-foreground">
                · {usuario._count.tutorias} jugador
                {usuario._count.tutorias === 1 ? "" : "es"} gestionado
                {usuario._count.tutorias === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>Actualiza tu información de contacto</CardDescription>
        </CardHeader>
        <CardContent>
          <PerfilForm
            usuario={{
              nombre: usuario.nombre,
              apellidos: usuario.apellidos,
              email: usuario.email,
              telefono: usuario.telefono,
              telefonoAlternativo: usuario.telefonoAlternativo,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            Introduce tu contraseña actual para confirmar el cambio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CambioPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
