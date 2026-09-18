"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import {
  asignarEquiposAEntrenador,
  crearPerfilEntrenador,
  quitarEquipoAEntrenador,
} from "./actions";

export interface EquipoLite {
  id: string;
  nombre: string;
  categoria: string | null;
}

export interface AsignacionItem {
  id: string;
  equipoId: string;
  equipoNombre: string;
  equipoCategoria: string | null;
  rol: string;
}

interface Props {
  usuarioId: string;
  entrenador: {
    id: string;
    nombre: string;
    apellidos: string;
    equipos: AsignacionItem[];
  } | null;
  equiposDisponibles: EquipoLite[];
}

export function PanelEntrenador({
  usuarioId,
  entrenador,
  equiposDisponibles,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleCrear() {
    setError(null);
    startTransition(async () => {
      const result = await crearPerfilEntrenador(usuarioId);
      if (result.error) setError(result.error);
      else {
        setSuccess("Perfil de entrenador creado");
        router.refresh();
      }
    });
  }

  function handleAsignar() {
    setError(null);
    if (!equipoSeleccionado) {
      setError("Selecciona un equipo");
      return;
    }
    startTransition(async () => {
      const result = await asignarEquiposAEntrenador(entrenador!.id, [
        equipoSeleccionado,
      ]);
      if (result.error) setError(result.error);
      else {
        setSuccess("Asignado");
        setEquipoSeleccionado("");
        router.refresh();
      }
    });
  }

  function handleQuitar(asignacionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await quitarEquipoAEntrenador(entrenador!.id, asignacionId);
      if (result.error) setError(result.error);
      else {
        setSuccess("Equipo quitado");
        router.refresh();
      }
    });
  }

  if (!entrenador) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rol: Entrenador</CardTitle>
          <CardDescription>
            Este usuario aún no tiene perfil de entrenador.
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
          <Button type="button" onClick={handleCrear} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear perfil de entrenador
          </Button>
        </CardContent>
      </Card>
    );
  }

  const equiposAsignadosIds = new Set(entrenador.equipos.map((e) => e.equipoId));
  const equiposSinAsignar = equiposDisponibles.filter(
    (e) => !equiposAsignadosIds.has(e.id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Rol: Entrenador</span>
          <Link
            href={`/admin/entrenadores/${entrenador.id}`}
            className="text-xs font-normal text-blue-600 hover:underline"
          >
            Ver ficha completa
          </Link>
        </CardTitle>
        <CardDescription>
          {entrenador.nombre} {entrenador.apellidos}
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

        {entrenador.equipos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin equipos asignados como entrenador.
          </p>
        ) : (
          <ul className="space-y-2">
            {entrenador.equipos.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{a.equipoNombre}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.equipoCategoria ?? "—"} · {a.rol}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuitar(a.id)}
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
                  <SelectValue placeholder="Asignar equipo" />
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
            <Button type="button" onClick={handleAsignar} disabled={isPending || !equipoSeleccionado}>
              <Plus className="h-4 w-4" />
              Asignar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
