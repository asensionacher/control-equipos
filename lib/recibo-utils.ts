/**
 * Utils específicos del módulo de Recibos.
 *
 * Los datos del club (emisor) viven en `lib/club-utils.ts`.
 * Aquí solo quedan utilidades propias de la creación / pago de recibos.
 */

/**
 * Calcula la cuota de IVA y el total a partir de la base y el tipo.
 * Devuelve números redondeados a 2 decimales.
 */
export function calcularIvaYTotal(base: number, tipoIvaPct: number): {
  cuotaIva: number;
  total: number;
} {
  const cuotaIva = Math.round(base * (tipoIvaPct / 100) * 100) / 100;
  const total = Math.round((base + cuotaIva) * 100) / 100;
  return { cuotaIva, total };
}

/**
 * Tipos de métodos de pago sugeridos.
 */
export const METODOS_PAGO = [
  "Transferencia bancaria",
  "Bizum",
  "Efectivo",
  "Tarjeta",
  "Domiciliación",
  "Otro",
] as const;