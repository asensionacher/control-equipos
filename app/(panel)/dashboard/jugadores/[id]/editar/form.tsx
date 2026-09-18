"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { editarJugadorTutor } from "./actions";
import { obtenerFotoJugadorSrc } from "@/lib/imagen-upload";

interface JugadorData {
  id: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: string;
  dniNie: string | null;
  email: string | null;
  telefono: string | null;
  telefonoAlternativo: string | null;
  direccion: string | null;
  fotoUrl: string | null;
  sexo: "MASCULINO" | "FEMENINO" | "OTRO" | null;
}

interface Props {
  jugador: JugadorData;
}

export function JugadorEditTutorForm({ jugador }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{
    tipo: "success" | "error";
    texto: string;
    link?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sexo, setSexo] = useState<string>(jugador.sexo ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const formData = new FormData(e.currentTarget);
    if (sexo) formData.set("sexo", sexo);
    startTransition(async () => {
      const result = await editarJugadorTutor(jugador.id, formData);
      if (result.error) {
        setMsg({ tipo: "error", texto: result.error });
      } else if (result.success) {
        setMsg({
          tipo: "success",
          texto: result.success,
          link: result.devLink,
        });
        router.refresh();
        if (!result.devLink) {
          setTimeout(() => router.push(`/dashboard/jugadores/${jugador.id}`), 800);
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {msg && (
        <Alert variant={msg.tipo === "error" ? "destructive" : "success"}>
          <AlertDescription>{msg.texto}</AlertDescription>
          {msg.link && (
            <AlertDescription className="mt-2 break-all text-xs">
              <strong>Enlace de desarrollo:</strong> {msg.link}
            </AlertDescription>
          )}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" name="nombre" required defaultValue={jugador.nombre} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input id="apellidos" name="apellidos" required defaultValue={jugador.apellidos} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fechaNacimiento">Fecha de nacimiento *</Label>
              <Input
                id="fechaNacimiento"
                name="fechaNacimiento"
                type="date"
                required
                defaultValue={jugador.fechaNacimiento}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dniNie">DNI / NIE</Label>
              <Input id="dniNie" name="dniNie" defaultValue={jugador.dniNie ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo</Label>
              <Select value={sexo} onValueChange={setSexo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MASCULINO">Masculino</SelectItem>
                  <SelectItem value="FEMENINO">Femenino</SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="foto">Foto del jugador</Label>
              {jugador.fotoUrl && (
                <div className="flex items-center gap-3 rounded-md border p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={obtenerFotoJugadorSrc(jugador) ?? undefined}
                    alt={`${jugador.nombre} ${jugador.apellidos}`}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="eliminarFoto" />
                    Eliminar foto actual
                  </label>
                </div>
              )}
              <Input
                id="foto"
                name="foto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG o WebP. Máximo 5 MB.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={jugador.email ?? ""} />
              <p className="text-xs text-muted-foreground">
                El email de acceso a la cuenta se gestiona desde el perfil de usuario.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" name="telefono" type="tel" defaultValue={jugador.telefono ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefonoAlternativo">Teléfono alternativo</Label>
              <Input
                id="telefonoAlternativo"
                name="telefonoAlternativo"
                type="tel"
                defaultValue={jugador.telefonoAlternativo ?? ""}
              />
            </div>
            <div />
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Textarea id="direccion" name="direccion" rows={2} defaultValue={jugador.direccion ?? ""} />
          </div>
        </CardContent>
      </Card>

      <CardFooter className="flex justify-end gap-2 px-0">
        <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/jugadores/${jugador.id}`)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar cambios
        </Button>
      </CardFooter>
    </form>
  );
}
