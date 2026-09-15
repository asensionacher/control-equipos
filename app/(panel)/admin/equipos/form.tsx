"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
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
  };
  temporadas: Temporada[];
}

export function EquipoForm({ equipo, temporadas }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [temporadaId, setTemporadaId] = useState(equipo?.temporadaId ?? temporadas[0]?.id ?? "");

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
