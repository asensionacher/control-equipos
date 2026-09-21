"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AsignacionMasiva } from "./asignacion-masiva";

interface JugadorDisponible {
  id: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: Date | string;
  fotoUrl: string | null;
}

interface Props {
  equipoId: string;
  jugadoresDisponibles: JugadorDisponible[];
}

export function AsignarJugadoresModal({
  equipoId,
  jugadoresDisponibles,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <UserPlus className="h-4 w-4" />
          Asignar jugadores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Asignar jugadores</DialogTitle>
          <DialogDescription>
            Selecciona uno o varios jugadores para añadirlos a este equipo.
          </DialogDescription>
        </DialogHeader>
        <AsignacionMasiva
          equipoId={equipoId}
          jugadoresDisponibles={jugadoresDisponibles}
          onAssigned={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
