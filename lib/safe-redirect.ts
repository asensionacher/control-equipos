const LOCAL_BASE_URL = "https://local.invalid";

function contieneCaracteresPeligrosos(value: string): boolean {
  return value.includes("\\") || /[\u0000-\u001F\u007F]/.test(value);
}

export function obtenerRutaLocalSegura(
  value: string | null | undefined,
  fallback = "/"
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    contieneCaracteresPeligrosos(value)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, LOCAL_BASE_URL);
    if (parsed.origin !== LOCAL_BASE_URL) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function obtenerRedirectAuthSeguro(url: string, baseUrl: string): string {
  if (url.startsWith("/")) {
    const ruta = obtenerRutaLocalSegura(url);
    return ruta === "/" && url !== "/" ? baseUrl : new URL(ruta, baseUrl).toString();
  }

  try {
    const destino = new URL(url);
    return destino.origin === new URL(baseUrl).origin ? destino.toString() : baseUrl;
  } catch {
    return baseUrl;
  }
}
