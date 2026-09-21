import { Badge } from "@/components/ui/badge";
import { obtenerEquiposAsignados, type EquipoAsignado } from "@/lib/asignacion-equipos";

export function EquiposAsignadosCeldas({
  origen,
  fallbackVacio,
  maxVisibles = 2,
}: {
  origen: { equipo?: EquipoAsignado | null; equipos?: EquipoAsignado[] };
  fallbackVacio: string;
  maxVisibles?: number;
}) {
  const equipos = obtenerEquiposAsignados(origen);
  if (equipos.length === 0) {
    return <span className="text-xs text-muted-foreground">{fallbackVacio}</span>;
  }
  const visibles = equipos.slice(0, maxVisibles);
  const restantes = equipos.length - visibles.length;
  return (
    <div className="flex max-w-52 flex-wrap items-center gap-1">
      {visibles.map((equipo) => (
        <Badge key={equipo.id} variant="secondary">
          {equipo.nombre}
        </Badge>
      ))}
      {restantes > 0 && (
        <span className="text-xs text-muted-foreground">
          ({restantes} equipo{restantes === 1 ? "" : "s"} más)
        </span>
      )}
    </div>
  );
}
