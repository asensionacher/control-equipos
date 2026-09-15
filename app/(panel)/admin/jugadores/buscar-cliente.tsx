"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export function BuscarJugadores() {
  const router = useRouter();
  const params = useSearchParams();
  const [texto, setTexto] = useState(params.get("texto") ?? "");
  const [anio, setAnio] = useState(params.get("anio") ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      const sp = new URLSearchParams();
      if (texto.trim()) sp.set("texto", texto.trim());
      if (anio.trim()) sp.set("anio", anio.trim());
      const tempId = params.get("temporadaId");
      if (tempId) sp.set("temporadaId", tempId);
      router.push(`/admin/jugadores?${sp.toString()}`);
    });
  }

  function limpiar() {
    setTexto("");
    setAnio("");
    startTransition(() => {
      const tempId = params.get("temporadaId");
      const sp = new URLSearchParams();
      if (tempId) sp.set("temporadaId", tempId);
      const qs = sp.toString();
      router.push(qs ? `/admin/jugadores?${qs}` : "/admin/jugadores");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <label className="text-sm font-medium" htmlFor="texto">
          Nombre o apellidos
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre o apellido..."
            className="pl-9"
          />
        </div>
      </div>
      <div className="w-full space-y-1 sm:w-40">
        <label className="text-sm font-medium" htmlFor="anio">
          Año de nacimiento
        </label>
        <Input
          id="anio"
          type="number"
          min="1900"
          max={new Date().getFullYear()}
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
          placeholder="2010"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          <Search className="h-4 w-4" />
          Buscar
        </Button>
        <Button type="button" variant="outline" onClick={limpiar} disabled={isPending}>
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      </div>
    </form>
  );
}
