import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatearFecha(date: Date | string | null | undefined, opciones?: Intl.DateTimeFormatOptions): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (opciones) return d.toLocaleDateString("es-ES", opciones);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()}`;
}

export function formatearFechaInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

export function formatearFechaHora(
  date: Date | string | null | undefined,
  opciones?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...opciones,
  });
}

export function calcularEdad(fechaNacimiento: Date | string): number {
  const hoy = new Date();
  const nacimiento = typeof fechaNacimiento === "string" ? new Date(fechaNacimiento) : fechaNacimiento;
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

export function nombreCompleto(nombre: string, apellidos: string): string {
  return `${nombre} ${apellidos}`.trim();
}

export function iniciales(nombre: string, apellidos: string): string {
  return `${nombre.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
}

/**
 * Formatea un número con 2 decimales y separador de miles estilo español (1.234,56).
 * Acepta number, string o Decimal de Prisma (que tiene toFixed).
 */
export function formatearNumero(valor: number | string | { toFixed: (n: number) => string } | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined || valor === "") return "0";
  const n = typeof valor === "number" ? valor : parseFloat(String(valor));
  if (isNaN(n)) return "0";
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Formatea el número individual de un recibo como "#001234".
 */
export function formatearNumeroRecibo(numero: number | string): string {
  const n = typeof numero === "string" ? parseInt(numero, 10) : numero;
  return "#" + n.toString().padStart(6, "0");
}
