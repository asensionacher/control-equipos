import { CalendarClock, UserCog, User } from "lucide-react";

const DIAS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
  { id: 6, label: "Sábado" },
  { id: 7, label: "Domingo" },
];

export interface HorarioSlot {
  id: string;
  equipoId: string;
  equipoNombre: string;
  equipoCategoria: string | null;
  diaSemana: number;
  minutoInicio: number;
  minutoFin: number;
  rol: "jugador" | "entrenador";
}

interface Props {
  /**
   * Lista plana de slots semanales (cada slot es un horario de entrenamiento
   * + el equipo al que pertenece + rol del usuario en ese equipo).
   */
  slots: HorarioSlot[];
  emptyMessage?: string;
}

function formatearHora(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

export function HorarioSemanal({ slots, emptyMessage }: Props) {
  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? "No hay entrenamientos configurados."}
      </p>
    );
  }

  // Agrupar por día y ordenar por hora de inicio
  const porDia = new Map<number, HorarioSlot[]>();
  for (const slot of slots) {
    const arr = porDia.get(slot.diaSemana) ?? [];
    arr.push(slot);
    porDia.set(slot.diaSemana, arr);
  }
  for (const arr of porDia.values()) {
    arr.sort((a, b) => a.minutoInicio - b.minutoInicio);
  }

  return (
    <div className="space-y-3">
      {DIAS.map((dia) => {
        const items = porDia.get(dia.id) ?? [];
        if (items.length === 0) return null;
        return (
          <div
            key={dia.id}
            className="grid grid-cols-[6rem_1fr] items-start gap-3 rounded-md border p-3"
          >
            <div className="font-semibold">{dia.label}</div>
            <ul className="space-y-1.5">
              {items.map((slot) => (
                <li
                  key={slot.id}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  {slot.rol === "entrenador" ? (
                    <UserCog
                      className="h-4 w-4 text-blue-600"
                      aria-label="Como entrenador"
                    />
                  ) : (
                    <User
                      className="h-4 w-4 text-green-600"
                      aria-label="Como jugador"
                    />
                  )}
                  <span className="font-mono">
                    {formatearHora(slot.minutoInicio)}–{formatearHora(slot.minutoFin)}
                  </span>
                  <span className="font-medium">{slot.equipoNombre}</span>
                  {slot.equipoCategoria && (
                    <span className="text-xs text-muted-foreground">
                      ({slot.equipoCategoria})
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      slot.rol === "entrenador"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {slot.rol === "entrenador" ? "Entreno" : "Jugador"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <UserCog className="h-3 w-3 text-blue-600" /> Como entrenador
        </span>
        <span className="flex items-center gap-1">
          <User className="h-3 w-3 text-green-600" /> Como jugador
        </span>
      </div>
    </div>
  );
}

export function construirSlotsEntrenamientos<T extends {
  id: string;
  nombre: string;
  categoria: string | null;
  horariosEntrenamiento: { id: string; diaSemana: number; minutoInicio: number; minutoFin: number }[];
}>(equipos: T[], rol: "jugador" | "entrenador"): HorarioSlot[] {
  const slots: HorarioSlot[] = [];
  for (const eq of equipos) {
    for (const h of eq.horariosEntrenamiento) {
      slots.push({
        id: h.id,
        equipoId: eq.id,
        equipoNombre: eq.nombre,
        equipoCategoria: eq.categoria,
        diaSemana: h.diaSemana,
        minutoInicio: h.minutoInicio,
        minutoFin: h.minutoFin,
        rol,
      });
    }
  }
  return slots;
}

export function CalendarLegend({ className }: { className?: string }) {
  return (
    <p className={`flex items-center gap-1 text-xs text-muted-foreground ${className ?? ""}`}>
      <CalendarClock className="h-3.5 w-3.5" />
      Vista semanal de entrenamientos (jugador + entrenador)
    </p>
  );
}
