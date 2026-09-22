import { describe, expect, it } from "vitest";
import {
  obtenerRedirectAuthSeguro,
  obtenerRutaLocalSegura,
} from "@/lib/safe-redirect";

describe("obtenerRutaLocalSegura", () => {
  it("conserva rutas locales con query y fragmento", () => {
    expect(obtenerRutaLocalSegura("/admin/usuarios?page=2#tabla")).toBe(
      "/admin/usuarios?page=2#tabla"
    );
  });

  it.each([
    "https://malicioso.example/phishing",
    "//malicioso.example/phishing",
    "/\\malicioso.example/phishing",
    "/admin\nLocation: https://malicioso.example",
  ])("rechaza destinos externos o ambiguos: %s", (value) => {
    expect(obtenerRutaLocalSegura(value)).toBe("/");
  });

  it("permite definir un fallback seguro", () => {
    expect(obtenerRutaLocalSegura("javascript:alert(1)", "/login")).toBe(
      "/login"
    );
  });
});

describe("obtenerRedirectAuthSeguro", () => {
  const baseUrl = "https://club.example";

  it("convierte una ruta local en URL absoluta del club", () => {
    expect(obtenerRedirectAuthSeguro("/admin", baseUrl)).toBe(
      "https://club.example/admin"
    );
  });

  it("permite una URL absoluta del mismo origen", () => {
    expect(
      obtenerRedirectAuthSeguro(
        "https://club.example/dashboard?tab=recibos",
        baseUrl
      )
    ).toBe("https://club.example/dashboard?tab=recibos");
  });

  it("rechaza URLs de otros orígenes", () => {
    expect(
      obtenerRedirectAuthSeguro("https://malicioso.example", baseUrl)
    ).toBe(baseUrl);
  });
});
