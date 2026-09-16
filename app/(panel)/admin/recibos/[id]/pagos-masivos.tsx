"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { marcarJugadoresPagados } from "../actions";
import { METODOS_PAGO } from "@/lib/recibo-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  reciboId: number;
  jugadores: Array<{ id: string; numero: number; nombre: string; apellidos: string }>;
}

export function PagosMasivos({ reciboId, jugadores }: Props) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    const next = new Set(seleccionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSeleccionados(next);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(event.currentTarget);
    seleccionados.forEach((id) => formData.append("recibosJugadoresIds", id));
    startTransition(async () => {
      const result = await marcarJugadoresPagados(reciboId, formData);
      if (result.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Pagos registrados");
        setSeleccionados(new Set());
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
        {jugadores.map((jugador) => (
          <label key={jugador.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted">
            <Checkbox
              checked={seleccionados.has(jugador.id)}
              onCheckedChange={() => toggle(jugador.id)}
            />
            <span className="text-sm">
              <span className="mr-2 font-mono text-xs text-muted-foreground">
                #{jugador.numero.toString().padStart(6, "0")}
              </span>
              {jugador.apellidos}, {jugador.nombre}
            </span>
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pago-masivo-metodo">Método</Label>
          <select
            id="pago-masivo-metodo"
            name="metodoPago"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {METODOS_PAGO.map((metodo) => <option key={metodo}>{metodo}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pago-masivo-fecha">Fecha</Label>
          <Input
            id="pago-masivo-fecha"
            name="fechaPago"
            type="date"
            required
            defaultValue={new Date().toISOString().split("T")[0]}
          />
        </div>
      </div>
      <Input name="referenciaPago" placeholder="Referencia común (opcional)" />
      <Input name="notasPago" placeholder="Notas comunes (opcional)" />
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert variant="success"><AlertDescription>{success}</AlertDescription></Alert>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || seleccionados.size === 0}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Marcar {seleccionados.size || ""} como pagados
        </Button>
      </div>
    </form>
  );
}
