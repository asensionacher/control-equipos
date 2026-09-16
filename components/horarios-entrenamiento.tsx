import { CalendarClock } from "lucide-react";

const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

interface EquipoConHorarios {
  id: string;
  nombre: string;
  activo: boolean;
  temporada: {
    nombre: string;
    activa: boolean;
  };
  horariosEntrenamiento: {
    id: string;
    diaSemana: number;
    minutoInicio: number;
    minutoFin: number;
  }[];
}

function formatearHora(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

export function HorariosEntrenamiento({
  equipos,
  compacto = false,
  soloActivos = true,
}: {
  equipos: EquipoConHorarios[];
  compacto?: boolean;
  soloActivos?: boolean;
}) {
  const equiposActivos = Array.from(
    new Map(
      equipos
        .filter((equipo) => !soloActivos || (equipo.activo && equipo.temporada.activa))
        .map((equipo) => [equipo.id, equipo])
    ).values()
  );

  if (equiposActivos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {soloActivos
          ? "No hay equipos activos con horarios de entrenamiento."
          : "No hay equipos con horarios de entrenamiento."}
      </p>
    );
  }

  return (
    <div className={compacto ? "space-y-3" : "space-y-4"}>
      {equiposActivos.map((equipo) => (
        <div key={equipo.id} className={compacto ? "" : "rounded-lg border p-4"}>
          <div className="mb-2 flex items-center gap-2 font-medium">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span>{equipo.nombre}</span>
            {!compacto && (
              <span className="text-xs font-normal text-muted-foreground">
                ({equipo.temporada.nombre})
              </span>
            )}
          </div>
          {equipo.horariosEntrenamiento.length === 0 ? (
            <p className="text-xs text-muted-foreground">Horario aún no configurado.</p>
          ) : (
            <div className="space-y-1">
              {DIAS.map((dia, index) => {
                const intervalos = equipo.horariosEntrenamiento.filter(
                  (horario) => horario.diaSemana === index + 1
                );
                if (intervalos.length === 0) return null;
                return (
                  <div key={dia} className="grid grid-cols-[5.5rem_1fr] gap-2 text-sm">
                    <span className="font-medium">{dia}</span>
                    <span className="text-muted-foreground">
                      {intervalos
                        .map(
                          (horario) =>
                            `${formatearHora(horario.minutoInicio)}–${formatearHora(horario.minutoFin)}`
                        )
                        .join(" · ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
