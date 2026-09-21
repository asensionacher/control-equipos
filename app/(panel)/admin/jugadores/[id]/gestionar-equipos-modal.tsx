"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AsignarEquipos } from "./asignar-equipos";

interface Equipo {
  id: string;
  nombre: string;
  categoria: string | null;
}

interface Temporada {
  id: string;
  nombre: string;
  equipos: Equipo[];
}

interface Props {
  jugadorId: string;
  temporadas: Temporada[];
  equiposAsignadosIds: string[];
}

export function GestionarEquiposModal({
  jugadorId,
  temporadas,
  equiposAsignadosIds,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Users className="h-4 w-4" />
          Gestionar equipos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gestionar equipos del jugador</DialogTitle>
          <DialogDescription>
            Añade o retira al jugador de los equipos de las temporadas activas.
          </DialogDescription>
        </DialogHeader>
        <AsignarEquipos
          jugadorId={jugadorId}
          temporadas={temporadas}
          equiposAsignadosIds={equiposAsignadosIds}
        />
      </DialogContent>
    </Dialog>
  );
}
