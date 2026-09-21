"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface EquipoAsignado {
  asignacionId: string;
  equipoId: string;
  nombre: string;
  categoria: string | null;
  temporada: string | null;
  rol?: string | null;
}

export interface EquipoDisponible {
  id: string;
  nombre: string;
  categoria: string | null;
  temporada: string | null;
}

export type RolesEntrenador = readonly string[];

interface Props {
  titulo: string;
  descripcion: string;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  equiposAsignados: EquipoAsignado[];
  equiposDisponibles: EquipoDisponible[];
  roles?: RolesEntrenador;
  rolDefault?: string;
  mostrarRolEnAsignados?: boolean;
  onAsignar: (
    equipoIds: string[],
    rol?: string
  ) => Promise<{ error?: string; success?: string }>;
  onDesasignar: (asignacionId: string) => Promise<{ error?: string; success?: string }>;
}

const ROL_LABELS: Record<string, string> = {
  ENTRENADOR_PRINCIPAL: "Entrenador principal",
  ENTRENADOR_AYUDANTE: "Ayudante",
  PREPARADOR_FISICO: "Preparador físico",
  COORDINADOR: "Coordinador",
};

function formatearRol(rol: string): string {
  return ROL_LABELS[rol] ?? rol;
}

export function SelectorEquiposModal({
  titulo,
  descripcion,
  triggerLabel,
  triggerIcon,
  equiposAsignados,
  equiposDisponibles,
  roles,
  rolDefault,
  mostrarRolEnAsignados = false,
  onAsignar,
  onDesasignar,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rol, setRol] = useState<string>(rolDefault ?? roles?.[0] ?? "");
  const [pendientesAsignar, setPendientesAsignar] = useState<Set<string>>(new Set());
  const [pendientesQuitar, setPendientesQuitar] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [, startTransition] = useTransition();

  const asignadosSet = useMemo(
    () => new Set(equiposAsignados.map((a) => a.equipoId)),
    [equiposAsignados]
  );

  const equiposDisponiblesFiltrados = useMemo(() => {
    const disponibles = equiposDisponibles.filter((e) => !asignadosSet.has(e.id));
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return disponibles;
    return disponibles.filter(
      (e) =>
        e.nombre.toLowerCase().includes(termino) ||
        (e.categoria ?? "").toLowerCase().includes(termino) ||
        (e.temporada ?? "").toLowerCase().includes(termino)
    );
  }, [asignadosSet, equiposDisponibles, busqueda]);

  const asignadosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return equiposAsignados;
    return equiposAsignados.filter(
      (a) =>
        a.nombre.toLowerCase().includes(termino) ||
        (a.categoria ?? "").toLowerCase().includes(termino) ||
        (a.temporada ?? "").toLowerCase().includes(termino)
    );
  }, [equiposAsignados, busqueda]);

  function togglePendienteAsignar(equipoId: string) {
    setPendientesAsignar((prev) => {
      const next = new Set(prev);
      if (next.has(equipoId)) next.delete(equipoId);
      else next.add(equipoId);
      return next;
    });
  }

  function resetear() {
    setBusqueda("");
    setError(null);
    setPendientesAsignar(new Set());
    setPendientesQuitar(new Set());
    if (rolDefault) setRol(rolDefault);
  }

  function cerrar() {
    setOpen(false);
    resetear();
  }

  async function guardar() {
    setError(null);
    if (pendientesAsignar.size === 0 && pendientesQuitar.size === 0) {
      cerrar();
      return;
    }
    setGuardando(true);
    try {
      const promesas: Promise<{ error?: string }>[] = [];
      if (pendientesAsignar.size > 0) {
        promesas.push(onAsignar(Array.from(pendientesAsignar), rol || undefined));
      }
      for (const asignacionId of pendientesQuitar) {
        promesas.push(onDesasignar(asignacionId));
      }
      const resultados = await Promise.all(promesas);
      const primeroConError = resultados.find((r) => r?.error);
      if (primeroConError?.error) {
        setError(primeroConError.error);
        return;
      }
      cerrar();
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  const haySinAsignar = equiposDisponiblesFiltrados.length > 0;
  const hayAsignados = asignadosFiltrados.length > 0;
  const hayCambios = pendientesAsignar.size > 0 || pendientesQuitar.size > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetear();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          {triggerIcon ?? <Users className="h-4 w-4" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, categoría o temporada..."
            className="pl-9"
          />
        </div>

        {roles && roles.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="selector-rol">Rol para las nuevas asignaciones</Label>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger id="selector-rol">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {formatearRol(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-4">
          {hayAsignados && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Asignados ({equiposAsignados.length})
                </h3>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-md border">
                <ul className="divide-y">
                  {asignadosFiltrados.map((a) => {
                    const quitando = pendientesQuitar.has(a.asignacionId);
                    return (
                      <li
                        key={a.asignacionId}
                        className={cn(
                          "flex items-center justify-between gap-3 p-3",
                          quitando && "opacity-60"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{a.nombre}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {a.categoria ?? "—"}
                            {a.temporada ? ` · ${a.temporada}` : ""}
                            {mostrarRolEnAsignados && a.rol
                              ? ` · ${formatearRol(a.rol)}`
                              : ""}
                          </div>
                        </div>
                        {quitando ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPendientesQuitar((prev) => {
                                const next = new Set(prev);
                                next.delete(a.asignacionId);
                                return next;
                              })
                            }
                            disabled={guardando}
                          >
                            <X className="h-4 w-4" />
                            Deshacer
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setPendientesQuitar((prev) => {
                                const next = new Set(prev);
                                next.add(a.asignacionId);
                                return next;
                              })
                            }
                            disabled={guardando}
                          >
                            <X className="h-4 w-4" />
                            Quitar
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {haySinAsignar && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Disponibles</h3>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-md border">
                <ul className="divide-y">
                  {equiposDisponiblesFiltrados.map((e) => {
                    const marcado = pendientesAsignar.has(e.id);
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => togglePendienteAsignar(e.id)}
                          disabled={guardando}
                          className={cn(
                            "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent disabled:opacity-50",
                            marcado && "bg-accent"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                              marcado
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-background"
                            )}
                          >
                            {marcado && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{e.nombre}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {e.categoria ?? "—"}
                              {e.temporada ? ` · ${e.temporada}` : ""}
                            </div>
                          </div>
                          {marcado && <Badge variant="success">Se asignará</Badge>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {!hayAsignados && !haySinAsignar && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay equipos disponibles.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={guardando || !hayCambios}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            {hayCambios
              ? `Guardar (${pendientesAsignar.size + pendientesQuitar.size})`
              : "Cerrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
