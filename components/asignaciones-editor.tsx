"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { actualizarAsignacionesRecibo } from "@/app/(panel)/admin/recibos/actions";
import { actualizarAsignacionesDocumento } from "@/app/(panel)/admin/documentos/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Equipo {
  id: string;
  nombre: string;
  temporada: string;
  jugadoresIds: string[];
}

interface Jugador {
  id: string;
  nombre: string;
  apellidos: string;
}

interface AsignacionInicial {
  jugadorId: string;
  asignadoDirectamente: boolean;
  equiposOrigenIds: string[];
}

interface Props {
  tipo: "recibo" | "documento";
  entidadId: number | string;
  equipos: Equipo[];
  jugadores: Jugador[];
  equiposIniciales: string[];
  asignacionesIniciales: AsignacionInicial[];
}

export function AsignacionesEditor({
  tipo,
  entidadId,
  equipos,
  jugadores,
  equiposIniciales,
  asignacionesIniciales,
}: Props) {
  const router = useRouter();
  const equiposInicialesSet = useMemo(() => new Set(equiposIniciales), [equiposIniciales]);
  const asignacionesInicialesMap = useMemo(
    () => new Map(asignacionesIniciales.map((asignacion) => [asignacion.jugadorId, asignacion])),
    [asignacionesIniciales]
  );
  const jugadoresAsignadosInicialmente = useMemo(
    () => new Set(asignacionesIniciales.map(({ jugadorId }) => jugadorId)),
    [asignacionesIniciales]
  );
  const [equiposIds, setEquiposIds] = useState(new Set(equiposIniciales));
  const [jugadoresIds, setJugadoresIds] = useState(
    new Set(
      asignacionesIniciales
        .filter(({ asignadoDirectamente }) => asignadoDirectamente)
        .map(({ jugadorId }) => jugadorId)
    )
  );
  const [completarEquiposIds, setCompletarEquiposIds] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const equiposMap = useMemo(
    () => new Map(equipos.map((equipo) => [equipo.id, equipo])),
    [equipos]
  );
  const jugadoresFiltrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    if (!query) return jugadores;
    return jugadores.filter((jugador) =>
      `${jugador.nombre} ${jugador.apellidos}`.toLowerCase().includes(query)
    );
  }, [busqueda, jugadores]);

  function toggleEquipo(id: string) {
    setEquiposIds((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) {
        siguientes.delete(id);
        setCompletarEquiposIds((equiposACompletar) => {
          const nuevos = new Set(equiposACompletar);
          nuevos.delete(id);
          return nuevos;
        });
      } else {
        siguientes.add(id);
      }
      return siguientes;
    });
  }

  function toggleJugador(id: string) {
    setJugadoresIds((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }

  function toggleCompletarEquipo(id: string) {
    setCompletarEquiposIds((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }

  function guardar() {
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    equiposIds.forEach((id) => formData.append("equiposIds", id));
    jugadoresIds.forEach((id) => formData.append("jugadoresIds", id));
    completarEquiposIds.forEach((id) => formData.append("completarEquiposIds", id));
    startTransition(async () => {
      const result =
        tipo === "recibo"
          ? await actualizarAsignacionesRecibo(Number(entidadId), formData)
          : await actualizarAsignacionesDocumento(String(entidadId), formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Asignaciones actualizadas");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Equipos asignados</Label>
          <span className="text-xs text-muted-foreground">{equiposIds.size} seleccionados</span>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-2">
          {equipos.map((equipo) => {
            const seleccionado = equiposIds.has(equipo.id);
            const eraSeleccionado = equiposInicialesSet.has(equipo.id);
            const faltantes = equipo.jugadoresIds.filter(
              (jugadorId) => !jugadoresAsignadosInicialmente.has(jugadorId)
            ).length;
            const completarPendiente = completarEquiposIds.has(equipo.id);
            return (
              <div key={equipo.id} className="rounded border p-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={seleccionado}
                      onCheckedChange={() => toggleEquipo(equipo.id)}
                    />
                    <span className="text-sm">
                      {equipo.nombre} ({equipo.temporada}) · {equipo.jugadoresIds.length} jugadores
                    </span>
                  </label>
                  {seleccionado && eraSeleccionado && faltantes > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant={completarPendiente ? "secondary" : "outline"}
                      onClick={() => toggleCompletarEquipo(equipo.id)}
                    >
                      <Users className="h-4 w-4" />
                      {completarPendiente
                        ? `${faltantes} pendientes de guardar`
                        : `${faltantes} faltan · Asignar a todos`}
                    </Button>
                  )}
                  {seleccionado && !eraSeleccionado && (
                    <Badge variant="warning">Asignación del equipo pendiente de guardar</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Jugadores y origen de la asignación</Label>
          <span className="text-xs text-muted-foreground">
            {jugadoresIds.size} asignaciones directas
          </span>
        </div>
        <Input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar jugador..."
        />
        <div className="max-h-96 space-y-1 overflow-y-auto rounded-md border p-2">
          {jugadoresFiltrados.map((jugador) => {
            const inicial = asignacionesInicialesMap.get(jugador.id);
            const directoSeleccionado = jugadoresIds.has(jugador.id);
            const equiposPersistidos = (inicial?.equiposOrigenIds ?? [])
              .filter((equipoId) => equiposIds.has(equipoId))
              .map((equipoId) => equiposMap.get(equipoId))
              .filter((equipo): equipo is Equipo => Boolean(equipo));
            const equiposPendientes = equipos.filter(
              (equipo) =>
                equiposIds.has(equipo.id) &&
                equipo.jugadoresIds.includes(jugador.id) &&
                !(inicial?.equiposOrigenIds ?? []).includes(equipo.id) &&
                (!equiposInicialesSet.has(equipo.id) || completarEquiposIds.has(equipo.id))
            );
            const tieneOrigenEquipo =
              equiposPersistidos.length > 0 || equiposPendientes.length > 0;
            return (
              <div
                key={jugador.id}
                className={`rounded p-2 ${
                  tieneOrigenEquipo || directoSeleccionado ? "bg-muted/40" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={directoSeleccionado ? true : tieneOrigenEquipo ? "indeterminate" : false}
                    onCheckedChange={() => toggleJugador(jugador.id)}
                    aria-label={`Asignar directamente a ${jugador.nombre} ${jugador.apellidos}`}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      {jugador.apellidos}, {jugador.nombre}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {equiposPersistidos.map((equipo) => (
                        <Badge key={equipo.id} variant="default">
                          Asignado por equipo · {equipo.nombre}
                        </Badge>
                      ))}
                      {inicial?.asignadoDirectamente && directoSeleccionado && (
                        <Badge variant="secondary">Asignado directamente al jugador</Badge>
                      )}
                      {equiposPendientes.map((equipo) => (
                        <Badge key={equipo.id} variant="warning">
                          Por equipo · falta guardar · {equipo.nombre}
                        </Badge>
                      ))}
                      {directoSeleccionado && !inicial?.asignadoDirectamente && (
                        <Badge variant="warning">Por jugador · falta guardar</Badge>
                      )}
                      {inicial?.asignadoDirectamente && !directoSeleccionado && (
                        <Badge variant="destructive">Asignación directa pendiente de retirar</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Un jugador puede estar asignado por equipo, directamente o por ambas vías, pero solo tendrá
        un recibo o una solicitud documental. Los cambios marcados como pendientes se aplicarán al
        guardar.
      </p>
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
      <div className="flex justify-end">
        <Button type="button" onClick={guardar} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar asignaciones
        </Button>
      </div>
    </div>
  );
}
