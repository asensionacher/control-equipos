import { describe, expect, it } from "vitest";
import {
  formatearFecha,
  formatearFechaInput,
  formatearNumero,
  formatearNumeroRecibo,
  iniciales,
  nombreCompleto,
} from "@/lib/utils";

describe("utilidades de formato", () => {
  it("formatea fechas para interfaz y formularios", () => {
    const date = new Date(2026, 8, 22, 12);

    expect(formatearFecha(date)).toBe("22/09/2026");
    expect(formatearFechaInput(new Date("2026-09-22T12:00:00.000Z"))).toBe(
      "2026-09-22"
    );
  });

  it("formatea números y números oficiales de recibo", () => {
    expect(formatearNumero(1234.5)).toBe("1234,50");
    expect(formatearNumeroRecibo(42)).toBe("#000042");
  });

  it("construye nombres e iniciales", () => {
    expect(nombreCompleto("Ana", "García")).toBe("Ana García");
    expect(iniciales("Ana", "García")).toBe("AG");
  });
});
