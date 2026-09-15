"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toggleAsignacionEquipo } from "../../equipos/asignaciones-actions";

interface Equipo {
  id: string;
  nombre: string;
  categoria: string | null;
}

interface Temporada {
  id: string;
  nombre: string;
  equipos: Equipo[];
}

interface Props {
  jugadorId: string;
  temporadas: Temporada[];
  equiposAsignadosIds: string[];
}

export function AsignarEquipos({ jugadorId, temporadas, equiposAsignadosIds }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const asignadosSet = new Set(equiposAsignadosIds);

  function handleToggle(equipoId: string, checked: boolean) {
    setPending(equipoId);
    startTransition(async () => {
      await toggleAsignacionEquipo(jugadorId, equipoId, checked);
      setPending(null);
      router.refresh();
    });
  }

  if (temporadas.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No hay temporadas activas. Crea temporadas y equipos primero.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {temporadas.map((temp) => (
        <div key={temp.id}>
          <h3 className="mb-3 text-sm font-semibold">{temp.nombre}</h3>
          {temp.equipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay equipos en esta temporada.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {temp.equipos.map((equipo) => {
                const asignado = asignadosSet.has(equipo.id);
                const isLoading = pending === equipo.id;
                return (
                  <label
                    key={equipo.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <Checkbox
                      checked={asignado}
                      onCheckedChange={(checked) => handleToggle(equipo.id, !!checked)}
                      disabled={isLoading}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{equipo.nombre}</div>
                      {equipo.categoria && (
                        <div className="text-xs text-muted-foreground">{equipo.categoria}</div>
                      )}
                    </div>
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {asignado && !isLoading && <Badge variant="success">Asignado</Badge>}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
