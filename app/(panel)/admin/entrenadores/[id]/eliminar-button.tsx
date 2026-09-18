"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { eliminarEntrenador } from "../actions";

interface Props {
  id: string;
  nombre: string;
}

export function EliminarEntrenadorButton({ id, nombre }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`¿Dar de baja a ${nombre}? Sus asignaciones a equipos se mantienen.`)) {
      return;
    }
    startTransition(async () => {
      await eliminarEntrenador(id);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Dar de baja
    </Button>
  );
}
