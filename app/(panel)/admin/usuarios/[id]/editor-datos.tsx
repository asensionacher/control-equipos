"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actualizarDatosUsuario, reenviarActivacionUsuario } from "./actions";

interface Props {
  usuario: {
    id: string;
    nombre: string;
    apellidos: string;
    email: string | null;
    telefono: string | null;
    telefonoAlternativo: string | null;
    fechaNacimiento: string | null;
    dniNie: string | null;
    rol: "ADMIN" | "USUARIO";
    emailVerificado: boolean;
  };
}

export function EditorDatosUsuario({ usuario }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{
    tipo: "success" | "error";
    texto: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isReenviarPending, startReenviarTransition] = useTransition();
  const [email, setEmail] = useState(usuario.email ?? "");
  const [rol, setRol] = useState<"ADMIN" | "USUARIO">(usuario.rol);

  const emailHaCambiado = email.trim().toLowerCase() !== (usuario.email ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("rol", rol);
    startTransition(async () => {
      const result = await actualizarDatosUsuario(usuario.id, fd);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else {
        setMsg({
          tipo: "success",
          texto:
            result.success ??
            (result.emailCambiado
              ? "Datos guardados. Email cambiado, activación reenviada."
              : "Datos guardados."),
        });
        router.refresh();
      }
    });
  }

  function handleReenviar() {
    setMsg(null);
    startReenviarTransition(async () => {
      const result = await reenviarActivacionUsuario(usuario.id);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else setMsg({ tipo: "success", texto: result.success ?? "Reenviado" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos personales</CardTitle>
        <CardDescription>
          Datos básicos y de contacto. Si cambias el email, se resetea la contraseña y se
          envía un email de activación al nuevo correo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {msg && (
            <Alert variant={msg.tipo === "error" ? "destructive" : "success"}>
              <AlertDescription>{msg.texto}</AlertDescription>
            </Alert>
          )}

          {!usuario.emailVerificado && !emailHaCambiado && (
            <Alert variant="warning">
              <AlertDescription>
                Este usuario aún no ha activado su cuenta.{" "}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={handleReenviar}
                  disabled={isReenviarPending}
                >
                  Reenviar email de activación
                </button>
              </AlertDescription>
            </Alert>
          )}

          {emailHaCambiado && (
            <Alert variant="info">
              <AlertDescription>
                Si guardas, el email quedará pendiente de verificar y se enviará al nuevo
                correo un email de activación.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" name="nombre" required defaultValue={usuario.nombre} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos</Label>
              <Input
                id="apellidos"
                name="apellidos"
                required
                defaultValue={usuario.apellidos}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
              />
              <p className="text-xs text-muted-foreground">
                Vacío para menores sin acceso al portal. Si lo cambias, se resetea la
                contraseña y se envía email de activación.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol base</Label>
              <Select value={rol} onValueChange={(v) => setRol(v as "ADMIN" | "USUARIO")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USUARIO">Usuario</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
              <Input
                id="fechaNacimiento"
                name="fechaNacimiento"
                type="date"
                defaultValue={usuario.fechaNacimiento?.slice(0, 10) ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dniNie">DNI / NIE</Label>
              <Input id="dniNie" name="dniNie" defaultValue={usuario.dniNie ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                defaultValue={usuario.telefono ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefonoAlternativo">Teléfono alternativo</Label>
              <Input
                id="telefonoAlternativo"
                name="telefonoAlternativo"
                type="tel"
                defaultValue={usuario.telefonoAlternativo ?? ""}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReenviar}
              disabled={isReenviarPending}
            >
              Reenviar activación
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
