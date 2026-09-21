"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import {
  obtenerAsignacionesHeredables,
  toggleAsignacionEquipo,
  type ResumenHerenciaEquipo,
  type SeleccionHerenciaEquipo,
} from "@/app/(panel)/admin/equipos/asignaciones-actions";
import {
  ConfirmarHerenciaEquipo,
  type OpcionesHerenciaEquipo,
} from "@/components/confirmar-herencia-equipo";
import {
  SelectorEquiposModal,
  type EquipoAsignado,
  type EquipoDisponible,
} from "@/components/selector-equipos-modal";

interface Props {
  jugadorId: string;
  equiposAsignados: EquipoAsignado[];
  equiposDisponibles: EquipoDisponible[];
}

export function GestionarEquiposModal({
  jugadorId,
  equiposAsignados,
  equiposDisponibles,
}: Props) {
  const router = useRouter();
  const [pendientesAsignar, setPendientesAsignar] = useState<string[]>([]);
  const [herencia, setHerencia] = useState<{
    equipoIds: string[];
    resumen: ResumenHerenciaEquipo;
  } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [, startTransition] = useTransition();

  const onAsignar = useCallback(
    async (equipoIds: string[]) => {
      const resumenes = await Promise.all(
        equipoIds.map((equipoId) =>
          obtenerAsignacionesHeredables(equipoId, [jugadorId])
        )
      );
      const recibos = new Map<number, ResumenHerenciaEquipo["recibos"][number]>();
      const documentos = new Map<string, ResumenHerenciaEquipo["documentos"][number]>();
      for (const r of resumenes) {
        for (const recibo of r.recibos) {
          if (!recibos.has(recibo.id)) recibos.set(recibo.id, recibo);
        }
        for (const documento of r.documentos) {
          if (!documentos.has(documento.id)) documentos.set(documento.id, documento);
        }
      }
      const resumenConsolidado: ResumenHerenciaEquipo = {
        recibos: Array.from(recibos.values()),
        documentos: Array.from(documentos.values()),
      };

      if (
        resumenConsolidado.recibos.length > 0 ||
        resumenConsolidado.documentos.length > 0
      ) {
        setPendientesAsignar(equipoIds);
        setHerencia({ equipoIds, resumen: resumenConsolidado });
        return { success: "pending-herencia" };
      }

      await Promise.all(
        equipoIds.map((equipoId) =>
          toggleAsignacionEquipo(jugadorId, equipoId, true, {
            asignarRecibos: false,
            asignarDocumentos: false,
          })
        )
      );
      return { success: "Equipos asignados" };
    },
    [jugadorId]
  );

  const onDesasignar = useCallback(
    async (asignacionId: string) => {
      const asignacion = equiposAsignados.find((a) => a.asignacionId === asignacionId);
      if (!asignacion) return { error: "Asignación no encontrada" };
      await toggleAsignacionEquipo(jugadorId, asignacion.equipoId, false);
      return { success: "Equipo desvinculado" };
    },
    [jugadorId, equiposAsignados]
  );

  function confirmarHerencia(opciones: OpcionesHerenciaEquipo) {
    if (!herencia) return;
    setConfirmando(true);
    startTransition(async () => {
      const herenciaFinal: SeleccionHerenciaEquipo = {
        asignarRecibos: opciones.asignarRecibos,
        asignarDocumentos: opciones.asignarDocumentos,
        recibosIds: opciones.recibosIds,
        documentosIds: opciones.documentosIds,
      };
      await Promise.all(
        herencia.equipoIds.map((equipoId) =>
          toggleAsignacionEquipo(jugadorId, equipoId, true, herenciaFinal)
        )
      );
      setHerencia(null);
      setPendientesAsignar([]);
      setConfirmando(false);
      router.refresh();
    });
  }

  return (
    <>
      <SelectorEquiposModal
        titulo="Gestionar equipos del jugador"
        descripcion="Añade o retira al jugador de los equipos de las temporadas activas."
        triggerLabel="Gestionar equipos"
        triggerIcon={<Users className="h-4 w-4" />}
        equiposAsignados={equiposAsignados}
        equiposDisponibles={equiposDisponibles}
        onAsignar={onAsignar}
        onDesasignar={onDesasignar}
      />
      <ConfirmarHerenciaEquipo
        open={Boolean(herencia)}
        onOpenChange={(open) => {
          if (!open && !confirmando) {
            setHerencia(null);
            setPendientesAsignar([]);
          }
        }}
        resumen={herencia?.resumen ?? null}
        cantidadJugadores={pendientesAsignar.length || 1}
        onConfirm={confirmarHerencia}
        isPending={confirmando}
      />
    </>
  );
}
