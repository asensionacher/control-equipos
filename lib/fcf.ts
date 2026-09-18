import { z } from "zod";

const FCF_BASE_URL = "https://www.fcf.cat";
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCIA_DETALLES = 8;

const equipoListadoSchema = z.object({
  codequipo: z.string().regex(/^\d+$/),
  categoria_nombre: z.string().trim().min(1),
  letra_equipo: z.string().trim(),
});

const clubResponseSchema = z.object({
  data: z.object({
    teams: z.array(equipoListadoSchema),
  }),
});

const detalleResponseSchema = z.object({
  data: z.object({
    campos: z.record(z.unknown()).nullable().optional(),
  }),
});

const DIAS_ENTRENAMIENTO = [
  ["ENTRENAR_LUNES", 1],
  ["ENTRENAR_MARTES", 2],
  ["ENTRENAR_MIERCOLES", 3],
  ["ENTRENAR_JUEVES", 4],
  ["ENTRENAR_VIERNES", 5],
  ["ENTRENAR_SABADO", 6],
  ["ENTRENAR_DOMINGO", 7],
] as const;

export interface EquipoFcf {
  codigoFcf: string;
  nombre: string;
  categoria: string;
  urlLiga: string;
  horarios: {
    diaSemana: number;
    minutoInicio: number;
    minutoFin: number;
  }[];
}

export interface EquiposFcfResult {
  equipos: EquipoFcf[];
  advertencias: string[];
}

async function obtenerJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`La FCF respondió con el estado ${response.status}`);
  }

  return response.json();
}

function obtenerHorarios(campos: Record<string, unknown> | null | undefined) {
  if (!campos) return null;

  const horario = campos.ENTRENAR_HORARIO;
  if (typeof horario !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
    return null;
  }

  const [horas, minutos] = horario.split(":").map(Number);
  const minutoInicio = horas * 60 + minutos;
  const minutoFin = minutoInicio + 60;
  if (minutoFin > 1440) return null;

  return DIAS_ENTRENAMIENTO.filter(([campo]) => String(campos[campo] ?? "0") === "1").map(
    ([, diaSemana]) => ({
      diaSemana,
      minutoInicio,
      minutoFin,
    })
  );
}

async function mapearConConcurrencia<T, R>(
  elementos: T[],
  limite: number,
  callback: (elemento: T) => Promise<R>
): Promise<R[]> {
  const resultados = new Array<R>(elementos.length);
  let siguiente = 0;

  async function procesar() {
    while (siguiente < elementos.length) {
      const indice = siguiente++;
      resultados[indice] = await callback(elementos[indice]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limite, elementos.length) }, () => procesar())
  );
  return resultados;
}

export async function obtenerEquiposFcf(codigoClub: string): Promise<EquiposFcfResult> {
  if (!/^\d+$/.test(codigoClub)) {
    throw new Error("El Código FCF del club no es válido");
  }

  const listadoRaw = await obtenerJson(`${FCF_BASE_URL}/api/clubs/${codigoClub}`);
  const listado = clubResponseSchema.safeParse(listadoRaw);
  if (!listado.success) {
    throw new Error("La respuesta de equipos de la FCF no tiene el formato esperado");
  }

  const equiposUnicos = Array.from(
    new Map(listado.data.data.teams.map((equipo) => [equipo.codequipo, equipo])).values()
  );

  const resultados = await mapearConConcurrencia(
    equiposUnicos,
    CONCURRENCIA_DETALLES,
    async (equipo) => {
      const nombre = `${equipo.categoria_nombre} ${equipo.letra_equipo}`.trim();
      let horarios: EquipoFcf["horarios"] = [];
      let advertencia: string | null = null;

      try {
        const detalleRaw = await obtenerJson(
          `${FCF_BASE_URL}/api/clubs/${codigoClub}/team/${equipo.codequipo}`
        );
        const detalle = detalleResponseSchema.safeParse(detalleRaw);
        if (!detalle.success) {
          advertencia = `${nombre}: la respuesta de horarios no tiene el formato esperado`;
        } else {
          const horariosFcf = obtenerHorarios(detalle.data.data.campos);
          if (horariosFcf === null) {
            advertencia = `${nombre}: la FCF no proporciona un horario de entrenamiento válido`;
          } else {
            horarios = horariosFcf;
          }
        }
      } catch (error) {
        const detalle = error instanceof Error ? error.message : "error desconocido";
        advertencia = `${nombre}: no se pudo consultar el horario (${detalle})`;
      }

      return {
        equipo: {
          codigoFcf: equipo.codequipo,
          nombre,
          categoria: nombre,
          urlLiga: `${FCF_BASE_URL}/ca/clubs/${codigoClub}/categories/${equipo.codequipo}`,
          horarios,
        },
        advertencia,
      };
    }
  );

  return {
    equipos: resultados.map(({ equipo }) => equipo),
    advertencias: resultados.flatMap(({ advertencia }) =>
      advertencia ? [advertencia] : []
    ),
  };
}
