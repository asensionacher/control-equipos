"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { eliminarJugador } from "../actions";

export function EliminarJugadorButton({ id, nombre }: { id: string; nombre: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`¿Marcar como inactivo a ${nombre}? El jugador no se eliminará definitivamente, pero no aparecerá en los listados.`)) {
      return;
    }
    startTransition(async () => {
      await eliminarJugador(id);
    });
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleClick} disabled={isPending}>
      <Trash2 className="h-4 w-4" />
      Desactivar
    </Button>
  );
}
