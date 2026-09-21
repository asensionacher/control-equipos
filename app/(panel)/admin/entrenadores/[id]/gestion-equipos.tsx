"use client";

import { useCallback } from "react";
import { Users } from "lucide-react";
import {
  SelectorEquiposModal,
  type EquipoAsignado,
  type EquipoDisponible,
  type RolesEntrenador,
} from "@/components/selector-equipos-modal";
import {
  asignarEquiposEntrenador,
  quitarEquipoEntrenador,
} from "../actions";

interface Props {
  entrenadorId: string;
  equiposAsignados: EquipoAsignado[];
  equiposDisponibles: Array<{
    id: string;
    nombre: string;
    categoria: string | null;
    temporada: { nombre: string } | null;
  }>;
  roles: RolesEntrenador;
}

export function GestionEquiposEntrenador({
  entrenadorId,
  equiposAsignados,
  equiposDisponibles,
  roles,
}: Props) {
  const disponibles: EquipoDisponible[] = equiposDisponibles.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    categoria: e.categoria,
    temporada: e.temporada?.nombre ?? null,
  }));

  const onAsignar = useCallback(
    async (equipoIds: string[], rol?: string) => {
      return asignarEquiposEntrenador(entrenadorId, equipoIds, rol ?? "ENTRENADOR_PRINCIPAL");
    },
    [entrenadorId]
  );

  const onDesasignar = useCallback(
    async (asignacionId: string) => {
      return quitarEquipoEntrenador(entrenadorId, asignacionId);
    },
    [entrenadorId]
  );

  return (
    <SelectorEquiposModal
      titulo="Gestionar equipos del entrenador"
      descripcion="Asigna o desvincula a este entrenador de los equipos del club, eligiendo su rol."
      triggerLabel="Gestionar equipos"
      triggerIcon={<Users className="h-4 w-4" />}
      equiposAsignados={equiposAsignados}
      equiposDisponibles={disponibles}
      roles={roles}
      rolDefault="ENTRENADOR_PRINCIPAL"
      mostrarRolEnAsignados
      onAsignar={onAsignar}
      onDesasignar={onDesasignar}
    />
  );
}
