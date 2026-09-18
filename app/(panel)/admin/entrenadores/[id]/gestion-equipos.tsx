"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  asignarEquiposEntrenador,
  quitarEquipoEntrenador,
} from "../actions";

export interface EquipoAsignado {
  asignacionId: string;
  id: string;
  nombre: string;
  categoria: string | null;
  temporada: string | null;
}

export interface EquipoDisponible {
  id: string;
  nombre: string;
  categoria: string | null;
}

interface Props {
  entrenadorId: string;
  equiposAsignados: EquipoAsignado[];
  equiposDisponibles: EquipoDisponible[];
}

export function GestionEquiposEntrenador({
  entrenadorId,
  equiposAsignados,
  equiposDisponibles,
}: Props) {
  const router = useRouter();
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAsignar() {
    setMsg(null);
    if (!equipoSeleccionado) {
      setMsg({ tipo: "error", texto: "Selecciona un equipo" });
      return;
    }
    startTransition(async () => {
      const result = await asignarEquiposEntrenador(entrenadorId, [equipoSeleccionado]);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else {
        setMsg({ tipo: "success", texto: "Equipo asignado" });
        setEquipoSeleccionado("");
        router.refresh();
      }
    });
  }

  function handleQuitar(asignacionId: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await quitarEquipoEntrenador(entrenadorId, asignacionId);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else {
        setMsg({ tipo: "success", texto: "Equipo desvinculado" });
        router.refresh();
      }
    });
  }

  const disponiblesFiltrados = equiposDisponibles.filter(
    (d) => !equiposAsignados.some((a) => a.id === d.id)
  );

  return (
    <div className="space-y-4">
      {msg && (
        <Alert variant={msg.tipo === "error" ? "destructive" : "success"}>
          <AlertDescription>{msg.texto}</AlertDescription>
        </Alert>
      )}

      {equiposAsignados.length > 0 && (
        <ul className="space-y-2">
          {equiposAsignados.map((a) => (
            <li
              key={a.asignacionId}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="font-medium">{a.nombre}</div>
                <div className="text-xs text-muted-foreground">
                  {a.categoria ?? "—"}
                  {a.temporada ? ` · ${a.temporada}` : ""}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleQuitar(a.asignacionId)}
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

      {disponiblesFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {equiposAsignados.length === 0
            ? "Aún no tiene equipos asignados."
            : "No quedan más equipos disponibles para asignar."}
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Añadir equipo</div>
            <Select
              value={equipoSeleccionado || "none"}
              onValueChange={(v) => setEquipoSeleccionado(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Selecciona —</SelectItem>
                {disponiblesFiltrados.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                    {e.categoria ? ` (${e.categoria})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={handleAsignar} disabled={isPending || !equipoSeleccionado}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Asignar
          </Button>
        </div>
      )}
    </div>
  );
}
