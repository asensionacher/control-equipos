"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { crearTemporada, editarTemporada } from "./actions";

interface Props {
  temporada?: {
    id: string;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    activa: boolean;
  };
}

function isoDate(date: Date | string) {
  return new Date(date).toISOString().split("T")[0];
}

export function TemporadaForm({ temporada }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = temporada
        ? await editarTemporada(temporada.id, formData)
        : await crearTemporada(formData);
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
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la temporada</Label>
            <Input
              id="nombre"
              name="nombre"
              required
              defaultValue={temporada?.nombre ?? ""}
              placeholder="2026/2027"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio">Fecha de inicio</Label>
              <Input
                id="fechaInicio"
                name="fechaInicio"
                type="date"
                required
                defaultValue={temporada?.fechaInicio ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaFin">Fecha de fin</Label>
              <Input
                id="fechaFin"
                name="fechaFin"
                type="date"
                required
                defaultValue={temporada?.fechaFin ?? ""}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="activa"
              name="activa"
              type="checkbox"
              defaultChecked={temporada?.activa ?? true}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="activa">Temporada activa</Label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => history.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {temporada ? "Guardar cambios" : "Crear temporada"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
