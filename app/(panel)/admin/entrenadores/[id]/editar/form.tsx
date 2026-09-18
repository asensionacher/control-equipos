"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { editarEntrenador } from "../../actions";

export interface UsuarioLite {
  id: string;
  nombre: string;
  apellidos: string;
  email: string | null;
}
export interface JugadorLite {
  id: string;
  nombre: string;
  apellidos: string;
}

interface Props {
  entrenador: {
    id: string;
    nombre: string;
    apellidos: string;
    email: string | null;
    telefono: string | null;
    telefonoAlternativo: string | null;
    observaciones: string | null;
    usuarioId: string | null;
    jugadorId: string | null;
  };
  usuariosDisponibles: (UsuarioLite & { yaAsignado: boolean })[];
  jugadoresDisponibles: (JugadorLite & { yaAsignado: boolean })[];
}

export function EditarEntrenadorForm({
  entrenador,
  usuariosDisponibles,
  jugadoresDisponibles,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [usuarioId, setUsuarioId] = useState<string>(entrenador.usuarioId ?? "");
  const [jugadorId, setJugadorId] = useState<string>(entrenador.jugadorId ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    const data = {
      nombre: ((fd.get("nombre") as string) || "").trim(),
      apellidos: ((fd.get("apellidos") as string) || "").trim(),
      email: ((fd.get("email") as string) || "").trim(),
      telefono: ((fd.get("telefono") as string) || "").trim(),
      telefonoAlternativo: ((fd.get("telefonoAlternativo") as string) || "").trim(),
      observaciones: ((fd.get("observaciones") as string) || "").trim(),
      usuarioId: usuarioId || null,
      jugadorId: jugadorId || null,
    };
    startTransition(async () => {
      const result = await editarEntrenador(entrenador.id, data);
      if (result.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Entrenador actualizado");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert variant="success">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                name="nombre"
                required
                defaultValue={entrenador.nombre}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input
                id="apellidos"
                name="apellidos"
                required
                defaultValue={entrenador.apellidos}
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
                defaultValue={entrenador.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                defaultValue={entrenador.telefono ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefonoAlternativo">Teléfono alternativo</Label>
              <Input
                id="telefonoAlternativo"
                name="telefonoAlternativo"
                type="tel"
                defaultValue={entrenador.telefonoAlternativo ?? ""}
              />
            </div>
            <div />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              name="observaciones"
              rows={3}
              defaultValue={entrenador.observaciones ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Vinculación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="usuarioId">Cuenta de acceso</Label>
              <Select
                value={usuarioId || "none"}
                onValueChange={(v) => setUsuarioId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cuenta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin cuenta —</SelectItem>
                  {usuariosDisponibles.map((u) => (
                    <SelectItem
                      key={u.id}
                      value={u.id}
                      disabled={u.yaAsignado && u.id !== entrenador.usuarioId}
                    >
                      {u.nombre} {u.apellidos} ({u.email})
                      {u.yaAsignado && u.id !== entrenador.usuarioId ? " — ya asignado" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jugadorId">Ficha de jugador</Label>
              <Select
                value={jugadorId || "none"}
                onValueChange={(v) => setJugadorId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin ficha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin ficha —</SelectItem>
                  {jugadoresDisponibles.map((j) => (
                    <SelectItem
                      key={j.id}
                      value={j.id}
                      disabled={j.yaAsignado && j.id !== entrenador.jugadorId}
                    >
                      {j.nombre} {j.apellidos}
                      {j.yaAsignado && j.id !== entrenador.jugadorId ? " — ya asignado" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
