"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearJugador, editarJugador } from "./actions";
import Link from "next/link";

interface Tutor {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
}

interface JugadorData {
  id?: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: string;
  dniNie: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  fotoUrl: string | null;
  sexo: "MASCULINO" | "FEMENINO" | "OTRO" | null;
  tutorUsuarioId: string | null;
  parentescoTutor: string | null;
  emailContactoTutor: string | null;
  telefonoContactoTutor: string | null;
}

interface Props {
  jugador?: JugadorData;
  tutores: Tutor[];
}

export function JugadorForm({ jugador, tutores }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sexo, setSexo] = useState<string>(jugador?.sexo ?? "");
  const [tutorId, setTutorId] = useState<string>(jugador?.tutorUsuarioId ?? "");
  const [mensajeInvitacion, setMensajeInvitacion] = useState<string>("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    formData.set("sexo", sexo);
    formData.set("tutorUsuarioId", tutorId);

    const datos = {
      nombre: (formData.get("nombre") as string) ?? "",
      apellidos: (formData.get("apellidos") as string) ?? "",
      fechaNacimiento: (formData.get("fechaNacimiento") as string) ?? "",
      dniNie: ((formData.get("dniNie") as string) || "").trim() || null,
      email: ((formData.get("email") as string) || "").trim() || null,
      telefono: ((formData.get("telefono") as string) || "").trim() || null,
      direccion: ((formData.get("direccion") as string) || "").trim() || null,
      fotoUrl: ((formData.get("fotoUrl") as string) || "").trim() || null,
      sexo: (sexo || null) as "MASCULINO" | "FEMENINO" | "OTRO" | null,
      tutorUsuarioId: tutorId || null,
      parentescoTutor: ((formData.get("parentescoTutor") as string) || "").trim() || null,
      emailContactoTutor: ((formData.get("emailContactoTutor") as string) || "").trim() || null,
      telefonoContactoTutor: ((formData.get("telefonoContactoTutor") as string) || "").trim() || null,
    };

    startTransition(async () => {
      const result = jugador
        ? await editarJugador(jugador.id!, datos)
        : await crearJugador({ jugador: datos, mensajeInvitacion });

      if (result?.error) {
        setError(result.error);
        return;
      }
      if (jugador) {
        // editarJugador hace redirect, no llega aquí
      } else {
        const newId = (result as any).jugadorId;
        setSuccess(result.success ?? "Jugador creado");
        setTimeout(() => {
          if (newId) router.push(`/admin/jugadores/${newId}`);
          else router.push("/admin/jugadores");
        }, 600);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Datos personales del jugador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" name="nombre" required defaultValue={jugador?.nombre ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input id="apellidos" name="apellidos" required defaultValue={jugador?.apellidos ?? ""} />
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
                defaultValue={jugador?.fechaNacimiento ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dniNie">DNI / NIE</Label>
              <Input id="dniNie" name="dniNie" defaultValue={jugador?.dniNie ?? ""} />
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
              <Label htmlFor="fotoUrl">URL de la foto</Label>
              <Input
                id="fotoUrl"
                name="fotoUrl"
                type="url"
                placeholder="https://..."
                defaultValue={jugador?.fotoUrl ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email del jugador</Label>
              <Input id="email" name="email" type="email" defaultValue={jugador?.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono del jugador</Label>
              <Input id="telefono" name="telefono" type="tel" defaultValue={jugador?.telefono ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Textarea id="direccion" name="direccion" rows={2} defaultValue={jugador?.direccion ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tutor / Padre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="info">
            <AlertDescription>
              Opcional. Si el jugador es menor o quieres que un padre gestione su ficha, selecciónalo
              de la lista. Si no existe, créalo primero desde la sección{" "}
              <Link href="/admin/padres/nuevo" className="underline font-medium">
                Padres
              </Link>
              . Si el jugador es mayor y debe gestionar su propia ficha, déjalo sin tutor y
              después, desde su ficha, podrás generar una activación de cuenta con su email.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tutorUsuarioId">Tutor (padre/madre)</Label>
              <Select value={tutorId || "none"} onValueChange={(v) => setTutorId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin tutor asignado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin tutor —</SelectItem>
                  {tutores.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre} {t.apellidos} ({t.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentescoTutor">Parentesco</Label>
              <Input
                id="parentescoTutor"
                name="parentescoTutor"
                defaultValue={jugador?.parentescoTutor ?? ""}
                placeholder="Padre, Madre, Tutor legal..."
                disabled={!tutorId}
              />
            </div>
          </div>

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Datos de contacto adicionales del tutor (sin cuenta)
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emailContactoTutor">Email de contacto</Label>
                <Input
                  id="emailContactoTutor"
                  name="emailContactoTutor"
                  type="email"
                  defaultValue={jugador?.emailContactoTutor ?? ""}
                  placeholder="Para comunicaciones sin acceso al sistema"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefonoContactoTutor">Teléfono de contacto</Label>
                <Input
                  id="telefonoContactoTutor"
                  name="telefonoContactoTutor"
                  type="tel"
                  defaultValue={jugador?.telefonoContactoTutor ?? ""}
                />
              </div>
            </div>
          </details>

          {!jugador && tutorId && (
            <div className="space-y-2">
              <Label htmlFor="mensajeInvitacion">Mensaje para el email (opcional)</Label>
              <Textarea
                id="mensajeInvitacion"
                rows={2}
                value={mensajeInvitacion}
                onChange={(e) => setMensajeInvitacion(e.target.value)}
                placeholder="Mensaje personalizado que verá el tutor en el email de notificación..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {jugador ? "Guardar cambios" : "Crear jugador"}
        </Button>
      </div>
    </form>
  );
}
