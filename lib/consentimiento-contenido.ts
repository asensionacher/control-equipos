import { parseDocument } from "htmlparser2";
import { Element, Text, type ChildNode } from "domhandler";

const etiquetasPermitidas = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "span",
  "ul",
  "ol",
  "li",
]);
const etiquetasDescartadas = new Set(["script", "style", "iframe", "object", "embed"]);
const tamanosFuente: Record<string, string> = {
  "1": "10px",
  "2": "10px",
  "3": "12px",
  "4": "14px",
  "5": "18px",
  "6": "24px",
  "7": "24px",
};

function escaparHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function colorSeguro(value: string): string | null {
  const color = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  const rgb = color.match(/^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/i);
  if (!rgb) return null;
  const componentes = rgb.slice(1).map(Number);
  if (componentes.some((componente) => componente > 255)) return null;
  return `rgb(${componentes.join(", ")})`;
}

function estilosSpan(style: string | undefined): string {
  if (!style) return "";
  const estilos: string[] = [];
  for (const declaracion of style.split(";")) {
    const separador = declaracion.indexOf(":");
    if (separador < 0) continue;
    const propiedad = declaracion.slice(0, separador).trim().toLowerCase();
    const valor = declaracion.slice(separador + 1).trim();
    if (propiedad === "color") {
      const color = colorSeguro(valor);
      if (color) estilos.push(`color:${color}`);
    }
    if (propiedad === "font-size" && /^(10|12|14|18|24)px$/.test(valor)) {
      estilos.push(`font-size:${valor}`);
    }
  }
  return estilos.join(";");
}

function serializarNodos(nodos: ChildNode[]): string {
  return nodos.map(serializarNodo).join("");
}

function serializarNodo(nodo: ChildNode): string {
  if (nodo instanceof Text) return escaparHtml(nodo.data);
  if (!(nodo instanceof Element)) return "";

  const etiqueta = nodo.name.toLowerCase();
  if (etiquetasDescartadas.has(etiqueta)) return "";
  const contenido = serializarNodos(nodo.children);

  if (etiqueta === "font") {
    const estilos: string[] = [];
    const color = nodo.attribs.color ? colorSeguro(nodo.attribs.color) : null;
    if (color) estilos.push(`color:${color}`);
    const size = nodo.attribs.size ? tamanosFuente[nodo.attribs.size] : undefined;
    if (size) estilos.push(`font-size:${size}`);
    return estilos.length > 0
      ? `<span style="${estilos.join(";")}">${contenido}</span>`
      : contenido;
  }

  if (!etiquetasPermitidas.has(etiqueta)) return contenido;
  if (etiqueta === "br") return "<br>";
  if (etiqueta === "span") {
    const estilos = estilosSpan(nodo.attribs.style);
    return estilos ? `<span style="${estilos}">${contenido}</span>` : contenido;
  }
  return `<${etiqueta}>${contenido}</${etiqueta}>`;
}

export function sanitizarContenidoConsentimiento(contenido: string): string {
  return serializarNodos(parseDocument(contenido).children).trim();
}

function extraerTexto(nodos: ChildNode[]): string {
  let texto = "";
  for (const nodo of nodos) {
    if (nodo instanceof Text) {
      texto += nodo.data;
      continue;
    }
    if (!(nodo instanceof Element)) continue;
    if (nodo.name === "br") {
      texto += "\n";
      continue;
    }
    texto += extraerTexto(nodo.children);
    if (["p", "li"].includes(nodo.name)) texto += "\n";
  }
  return texto;
}

export function obtenerTextoConsentimiento(contenido: string): string {
  return extraerTexto(parseDocument(sanitizarContenidoConsentimiento(contenido)).children)
    .replace(/\s+/g, " ")
    .trim();
}

export function obtenerContenidoConsentimientoHtml(contenido: string): string {
  const sanitizado = sanitizarContenidoConsentimiento(contenido);
  if (/<[a-z][\s\S]*>/i.test(sanitizado)) return sanitizado;

  return sanitizado
    .split(/\r?\n/)
    .map((linea) => `<p>${linea || "<br>"}</p>`)
    .join("");
}
