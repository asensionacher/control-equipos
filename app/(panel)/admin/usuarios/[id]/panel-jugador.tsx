"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, Plus } from "lucide-react";
import {
  asignarEquiposAJugador,
  crearPerfilJugadorParaUsuario,
  quitarEquipoAJugador,
  vincularJugadorExistente,
} from "./actions";

export interface EquipoLite {
  id: string;
  nombre: string;
  categoria: string | null;
}

export interface JugadorVinculable {
  id: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: string;
}

export interface AsignacionItem {
  id: string;
  equipoId: string;
  equipoNombre: string;
  fechaAsignacion: string;
}

interface Props {
  usuarioId: string;
  jugador: {
    id: string;
    nombre: string;
    apellidos: string;
    fechaNacimiento: string;
    equipos: AsignacionItem[];
  } | null;
  jugadoresVinculables: JugadorVinculable[];
  equiposDisponibles: EquipoLite[];
}

export function PanelJugador({
  usuarioId,
  jugador,
  jugadoresVinculables,
  equiposDisponibles,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [jugadorVinculableSeleccionado, setJugadorVinculableSeleccionado] =
    useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleCrearPerfil(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await crearPerfilJugadorParaUsuario(usuarioId, fd);
      if (result.error) setError(result.error);
      else {
        setSuccess("Ficha de jugador creada");
        router.refresh();
      }
    });
  }

  function handleVincularExistente() {
    setError(null);
    if (!jugadorVinculableSeleccionado) {
      setError("Selecciona un jugador");
      return;
    }
    startTransition(async () => {
      const result = await vincularJugadorExistente(
        usuarioId,
        jugadorVinculableSeleccionado
      );
      if (result.error) setError(result.error);
      else {
        setSuccess("Jugador vinculado");
        setJugadorVinculableSeleccionado("");
        router.refresh();
      }
    });
  }

  function handleAsignarEquipo() {
    setError(null);
    if (!equipoSeleccionado) {
      setError("Selecciona un equipo");
      return;
    }
    startTransition(async () => {
      const result = await asignarEquiposAJugador(jugador!.id, [equipoSeleccionado]);
      if (result.error) setError(result.error);
      else {
        setSuccess("Asignado");
        setEquipoSeleccionado("");
        router.refresh();
      }
    });
  }

  function handleQuitarEquipo(equipoId: string) {
    setError(null);
    startTransition(async () => {
      const result = await quitarEquipoAJugador(jugador!.id, equipoId);
      if (result.error) setError(result.error);
      else {
        setSuccess("Equipo quitado");
        router.refresh();
      }
    });
  }

  if (!jugador) {
    const hayVinculables = jugadoresVinculables.length > 0;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rol: Jugador</CardTitle>
          <CardDescription>
            Este usuario aún no tiene ficha de jugador. Elige una opción:
          </CardDescription>
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

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Crear ficha de jugador nueva
            </summary>
            <form onSubmit={handleCrearPerfil} className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fechaNacimiento">Fecha de nacimiento *</Label>
                  <Input
                    id="fechaNacimiento"
                    name="fechaNacimiento"
                    type="date"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dniNie">DNI / NIE (opcional)</Label>
                  <Input id="dniNie" name="dniNie" />
                </div>
              </div>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Crear ficha
              </Button>
            </form>
          </details>

          {hayVinculables && (
            <details className="rounded-lg border p-3" open>
              <summary className="cursor-pointer text-sm font-medium">
                Vincular ficha de jugador existente
              </summary>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select
                    value={jugadorVinculableSeleccionado || "none"}
                    onValueChange={(v) =>
                      setJugadorVinculableSeleccionado(v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona jugador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Selecciona —</SelectItem>
                      {jugadoresVinculables.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.nombre} {j.apellidos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={handleVincularExistente} disabled={isPending}>
                  Vincular
                </Button>
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    );
  }

  const equiposAsignadosIds = new Set(jugador.equipos.map((e) => e.equipoId));
  const equiposSinAsignar = equiposDisponibles.filter(
    (e) => !equiposAsignadosIds.has(e.id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Rol: Jugador</span>
          <Link
            href={`/admin/jugadores/${jugador.id}/editar`}
            className="text-xs font-normal text-blue-600 hover:underline"
          >
            Editar ficha
          </Link>
        </CardTitle>
        <CardDescription>
          {jugador.nombre} {jugador.apellidos} · nacido el {jugador.fechaNacimiento}
        </CardDescription>
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

        {jugador.equipos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin equipos asignados.</p>
        ) : (
          <ul className="space-y-2">
            {jugador.equipos.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{a.equipoNombre}</div>
                  <div className="text-xs text-muted-foreground">
                    desde {a.fechaAsignacion}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuitarEquipo(a.equipoId)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}

        {equiposSinAsignar.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Select
                value={equipoSeleccionado || "none"}
                onValueChange={(v) => setEquipoSeleccionado(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Asignar a un equipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Selecciona —</SelectItem>
                  {equiposSinAsignar.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.nombre}
                      {eq.categoria ? ` (${eq.categoria})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={handleAsignarEquipo} disabled={isPending || !equipoSeleccionado}>
              <Plus className="h-4 w-4" />
              Asignar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
