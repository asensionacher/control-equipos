type EquipoAsignado = {
  id: string;
  nombre: string;
  temporada?: { nombre: string } | null;
};

export type { EquipoAsignado };

export function obtenerEquiposAsignados(origen: {
  equipo?: EquipoAsignado | null;
  equipos?: EquipoAsignado[];
}): EquipoAsignado[] {
  const equipos = new Map<string, EquipoAsignado>();
  if (origen.equipo) equipos.set(origen.equipo.id, origen.equipo);
  origen.equipos?.forEach((equipo) => equipos.set(equipo.id, equipo));
  return Array.from(equipos.values());
}

export function formatearEquiposAsignados(
  origen: {
    equipo?: EquipoAsignado | null;
    equipos?: EquipoAsignado[];
  },
  incluirTemporada = false
): string {
  return obtenerEquiposAsignados(origen)
    .map((equipo) =>
      incluirTemporada && equipo.temporada
        ? `${equipo.nombre} (${equipo.temporada.nombre})`
        : equipo.nombre
    )
    .join(", ");
}
