"use client";

import { usePathname, useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelectorTemporadaJugador({
  temporadas,
  temporadaId,
}: {
  temporadas: Array<{ id: string; nombre: string; activa: boolean }>;
  temporadaId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Label htmlFor="temporada-jugador">Temporada</Label>
        <p className="text-xs text-muted-foreground">
          Equipos, horarios y gestiones correspondientes a la temporada seleccionada.
        </p>
      </div>
      <Select
        value={temporadaId}
        onValueChange={(value) => router.push(`${pathname}?temporada=${value}`)}
      >
        <SelectTrigger id="temporada-jugador" className="w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {temporadas.map((temporada) => (
            <SelectItem key={temporada.id} value={temporada.id}>
              {temporada.nombre}
              {temporada.activa ? " · Actual" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
