"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { eliminarEquipo } from "./actions";

export function EliminarEquipoButton({ id, nombre }: { id: string; nombre: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`¿Eliminar el equipo "${nombre}"? Las asignaciones de jugadores también se eliminarán.`)) {
      return;
    }
    startTransition(async () => {
      await eliminarEquipo(id);
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleClick}
      disabled={isPending}
      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
    >
      <Trash2 className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only sm:ml-1">Eliminar</span>
    </Button>
  );
}
