"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { calcularEdad, iniciales } from "@/lib/utils";
import { asignarJugadoresMasivo } from "../asignaciones-actions";

interface JugadorDisponible {
  id: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: Date | string;
  fotoUrl: string | null;
}

interface Props {
  equipoId: string;
  jugadoresDisponibles: JugadorDisponible[];
}

export function AsignacionMasiva({ equipoId, jugadoresDisponibles }: Props) {
  const router = useRouter();
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [anioFiltro, setAnioFiltro] = useState("");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);

  const jugadoresFiltrados = useMemo(() => {
    return jugadoresDisponibles.filter((j) => {
      const coincideTexto =
        !busqueda.trim() ||
        `${j.nombre} ${j.apellidos}`.toLowerCase().includes(busqueda.trim().toLowerCase());
      const coincideAnio =
        !anioFiltro ||
        new Date(j.fechaNacimiento).getFullYear().toString() === anioFiltro;
      return coincideTexto && coincideAnio;
    });
  }, [jugadoresDisponibles, busqueda, anioFiltro]);

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (seleccionados.size === jugadoresFiltrados.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(jugadoresFiltrados.map((j) => j.id)));
    }
  }

  function handleAsignar() {
    if (seleccionados.size === 0) return;
    setMsg(null);
    startTransition(async () => {
      await asignarJugadoresMasivo(equipoId, Array.from(seleccionados));
      setSeleccionados(new Set());
      setMsg({ tipo: "success", texto: `${seleccionados.size} jugador(es) asignado(s) correctamente` });
      router.refresh();
    });
  }

  if (jugadoresDisponibles.length === 0) {
    return (
      <Alert variant="info">
        <AlertDescription>
          No hay jugadores disponibles para asignar. Todos los jugadores activos ya están en este
          equipo o no hay jugadores registrados.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor="busqueda-masiva">
            Buscar jugador disponible
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="busqueda-masiva"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o apellido..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-full space-y-1 sm:w-32">
          <label className="text-sm font-medium" htmlFor="anio-masiva">
            Año
          </label>
          <Input
            id="anio-masiva"
            type="number"
            value={anioFiltro}
            onChange={(e) => setAnioFiltro(e.target.value)}
            placeholder="Todos"
          />
        </div>
        {(busqueda || anioFiltro) && (
          <Button
            variant="outline"
            onClick={() => {
              setBusqueda("");
              setAnioFiltro("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {msg && (
        <Alert variant={msg.tipo === "error" ? "destructive" : "success"}>
          <AlertDescription>{msg.texto}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id="todos"
            checked={seleccionados.size === jugadoresFiltrados.length && jugadoresFiltrados.length > 0}
            onCheckedChange={toggleTodos}
          />
          <label htmlFor="todos" className="cursor-pointer">
            {seleccionados.size > 0
              ? `${seleccionados.size} seleccionados`
              : `Seleccionar todos (${jugadoresFiltrados.length})`}
          </label>
        </div>
        <Button onClick={handleAsignar} disabled={seleccionados.size === 0 || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Asignar {seleccionados.size > 0 ? `(${seleccionados.size})` : ""}
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border">
        {jugadoresFiltrados.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No hay jugadores que coincidan con la búsqueda.
          </div>
        ) : (
          <ul className="divide-y">
            {jugadoresFiltrados.map((j) => {
              const checked = seleccionados.has(j.id);
              return (
                <li
                  key={j.id}
                  className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-accent"
                  onClick={() => toggleSeleccion(j.id)}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleSeleccion(j.id)} />
                  <Avatar className="h-9 w-9">
                    {j.fotoUrl ? <AvatarImage src={j.fotoUrl} alt={j.nombre} /> : null}
                    <AvatarFallback>{iniciales(j.nombre, j.apellidos)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {j.nombre} {j.apellidos}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {calcularEdad(j.fechaNacimiento)} años · Nacido en{" "}
                      {new Date(j.fechaNacimiento).getFullYear()}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
