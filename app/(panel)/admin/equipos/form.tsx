"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearEquipo, editarEquipo } from "./actions";

interface Temporada {
  id: string;
  nombre: string;
}

interface Props {
  equipo?: {
    id: string;
    nombre: string;
    categoria: string | null;
    descripcion: string | null;
    urlLiga: string | null;
    temporadaId: string;
    horarios: {
      id: string;
      diaSemana: number;
      minutoInicio: number;
      minutoFin: number;
    }[];
  };
  temporadas: Temporada[];
}

const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

interface HorarioForm {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

function minutosAHora(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function horaAMinutos(hora: string) {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

export function EquipoForm({ equipo, temporadas }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [temporadaId, setTemporadaId] = useState(equipo?.temporadaId ?? temporadas[0]?.id ?? "");
  const [horarios, setHorarios] = useState<HorarioForm[]>(
    equipo?.horarios.map((horario) => ({
      id: horario.id,
      diaSemana: horario.diaSemana,
      horaInicio: minutosAHora(horario.minutoInicio),
      horaFin: minutosAHora(horario.minutoFin),
    })) ?? []
  );

  const horariosSerializados = JSON.stringify(
    horarios.map(({ diaSemana, horaInicio, horaFin }) => ({
      diaSemana,
      minutoInicio: horaAMinutos(horaInicio),
      minutoFin: horaAMinutos(horaFin),
    }))
  );

  function agregarIntervalo(diaSemana: number) {
    setHorarios((actuales) => [
      ...actuales,
      {
        id: `${diaSemana}-${Date.now()}-${actuales.length}`,
        diaSemana,
        horaInicio: "18:00",
        horaFin: "19:30",
      },
    ]);
  }

  function actualizarIntervalo(id: string, campo: "horaInicio" | "horaFin", valor: string) {
    setHorarios((actuales) =>
      actuales.map((horario) => (horario.id === id ? { ...horario, [campo]: valor } : horario))
    );
  }

  function eliminarIntervalo(id: string) {
    setHorarios((actuales) => actuales.filter((horario) => horario.id !== id));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = equipo ? await editarEquipo(equipo.id, formData) : await crearEquipo(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {temporadas.length === 0 ? (
            <Alert variant="warning">
              <AlertDescription>
                No hay temporadas activas. Crea primero una temporada desde la sección Temporadas.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="temporadaId">Temporada *</Label>
              <Select value={temporadaId} onValueChange={setTemporadaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una temporada" />
                </SelectTrigger>
                <SelectContent>
                  {temporadas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="temporadaId" value={temporadaId} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del equipo *</Label>
            <Input id="nombre" name="nombre" required defaultValue={equipo?.nombre ?? ""} placeholder="Alevín A" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoría</Label>
            <Input
              id="categoria"
              name="categoria"
              defaultValue={equipo?.categoria ?? ""}
              placeholder="Benjamín, Alevín, Cadete, Senior..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              name="descripcion"
              rows={3}
              defaultValue={equipo?.descripcion ?? ""}
              placeholder="Entrenador, horario, observaciones..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="urlLiga">URL de la liga (página oficial de la federación)</Label>
            <Input
              id="urlLiga"
              name="urlLiga"
              type="url"
              defaultValue={equipo?.urlLiga ?? ""}
              placeholder="https://competicion.federacion.es/equipo/..."
            />
          </div>
          <div className="space-y-3">
            <div>
              <Label>Horarios de entrenamiento</Label>
              <p className="text-sm text-muted-foreground">
                Añade tantos intervalos como necesites para cada día.
              </p>
            </div>
            <input type="hidden" name="horarios" value={horariosSerializados} />
            <div className="space-y-3">
              {DIAS.map((dia, index) => {
                const diaSemana = index + 1;
                const intervalos = horarios.filter((horario) => horario.diaSemana === diaSemana);
                return (
                  <div key={dia} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{dia}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => agregarIntervalo(diaSemana)}
                      >
                        <Plus className="h-4 w-4" />
                        Añadir intervalo
                      </Button>
                    </div>
                    {intervalos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin entrenamiento</p>
                    ) : (
                      <div className="space-y-2">
                        {intervalos.map((horario) => (
                          <div key={horario.id} className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                              <Label htmlFor={`${horario.id}-inicio`} className="text-xs">
                                Desde
                              </Label>
                              <Input
                                id={`${horario.id}-inicio`}
                                type="time"
                                required
                                value={horario.horaInicio}
                                onChange={(event) =>
                                  actualizarIntervalo(horario.id, "horaInicio", event.target.value)
                                }
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <Label htmlFor={`${horario.id}-fin`} className="text-xs">
                                Hasta
                              </Label>
                              <Input
                                id={`${horario.id}-fin`}
                                type="time"
                                required
                                value={horario.horaFin}
                                onChange={(event) =>
                                  actualizarIntervalo(horario.id, "horaFin", event.target.value)
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Eliminar intervalo del ${dia}`}
                              onClick={() => eliminarIntervalo(horario.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => history.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending || temporadas.length === 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {equipo ? "Guardar cambios" : "Crear equipo"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
