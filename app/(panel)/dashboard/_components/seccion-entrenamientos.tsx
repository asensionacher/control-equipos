import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCog, ExternalLink } from "lucide-react";
import {
  construirSlotsEntrenamientos,
  HorarioSemanal,
} from "@/components/horario-semanal";
import { getEntrenadorDeUsuario, getEquiposComoJugador } from "@/lib/entrenador";

export const dynamic = "force-dynamic";

interface Props {
  usuarioId: string;
}

export async function SeccionEntrenamientos({ usuarioId }: Props) {
  const [entrenador, equiposComoJugador] = await Promise.all([
    getEntrenadorDeUsuario(usuarioId),
    getEquiposComoJugador(usuarioId),
  ]);

  if (!entrenador) {
    // El usuario no es entrenador. No mostramos nada.
    return null;
  }

  const equiposEntrenados = entrenador.equipos
    .filter((a) => a.equipo.activo)
    .map((a) => a.equipo);

  const todosLosEquiposActivos = Array.from(
    new Map(
      [...equiposEntrenados, ...equiposComoJugador].map((e) => [e.id, e])
    ).values()
  );

  const slotsEntrenador = construirSlotsEntrenamientos(equiposEntrenados, "entrenador");
  const slotsJugador = construirSlotsEntrenamientos(equiposComoJugador, "jugador");
  const slots = [...slotsEntrenador, ...slotsJugador];

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Mi ficha como entrenador
            </CardTitle>
            <CardDescription>
              Equipos en los que entrenas y resumen semanal de entrenamientos.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/entrenador">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver portal completo
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {equiposEntrenados.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no tienes equipos asignados. Pide a un administrador que te asigne desde tu
            ficha de entrenador.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {equiposEntrenados.length} equipo{equiposEntrenados.length === 1 ? "" : "s"}:
            </div>
            <div className="flex flex-wrap gap-2">
              {equiposEntrenados.map((eq) => (
                <Badge key={eq.id} variant="secondary">
                  {eq.nombre}
                  {eq.categoria ? ` · ${eq.categoria}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {todosLosEquiposActivos.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div className="text-xs font-medium text-muted-foreground">
              Entrenamientos de esta semana (jugador + entrenador)
            </div>
            <HorarioSemanal slots={slots} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
