import PDFDocument from "pdfkit";
import { parseDocument } from "htmlparser2";
import { Element, Text, type ChildNode } from "domhandler";
import { formatearFechaHora } from "@/lib/utils";
import { obtenerContenidoConsentimientoHtml } from "@/lib/consentimiento-contenido";

interface GenerarPdfConsentimientoParams {
  titulo: string;
  descripcion: string;
  jugador: {
    nombre: string;
    apellidos: string;
    dniNie: string | null;
  };
  firmante: {
    nombre: string;
    email: string;
    esTutor: boolean;
  };
  firmadoAt: Date;
  firmaPng: Buffer;
}

interface EstiloTexto {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  size: number;
  color: string;
}

interface FragmentoTexto extends EstiloTexto {
  text: string;
}

const estiloBase: EstiloTexto = {
  bold: false,
  italic: false,
  underline: false,
  size: 10,
  color: "#000000",
};

function normalizarColor(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = color.match(/^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/i);
  if (!rgb) return estiloBase.color;
  const componentes = rgb.slice(1).map((valor) =>
    Math.min(255, Number(valor)).toString(16).padStart(2, "0")
  );
  return `#${componentes.join("")}`;
}

function estiloElemento(elemento: Element, estilo: EstiloTexto): EstiloTexto {
  const siguiente = { ...estilo };
  if (elemento.name === "strong" || elemento.name === "b") siguiente.bold = true;
  if (elemento.name === "em" || elemento.name === "i") siguiente.italic = true;
  if (elemento.name === "u") siguiente.underline = true;

  if (elemento.name === "span" && elemento.attribs.style) {
    for (const declaracion of elemento.attribs.style.split(";")) {
      const [propiedad, valor] = declaracion.split(":").map((parte) => parte.trim());
      if (propiedad === "color" && valor) siguiente.color = normalizarColor(valor);
      if (propiedad === "font-size" && valor) {
        const size = Number.parseInt(valor, 10);
        if ([10, 12, 14, 18, 24].includes(size)) siguiente.size = size;
      }
    }
  }
  return siguiente;
}

function extraerFragmentos(
  nodos: ChildNode[],
  estilo: EstiloTexto = estiloBase
): FragmentoTexto[] {
  const fragmentos: FragmentoTexto[] = [];
  for (const nodo of nodos) {
    if (nodo instanceof Text) {
      const text = nodo.data.replace(/\s+/g, " ");
      if (text) fragmentos.push({ ...estilo, text });
      continue;
    }
    if (!(nodo instanceof Element)) continue;
    if (nodo.name === "br") {
      fragmentos.push({ ...estilo, text: "\n" });
      continue;
    }
    fragmentos.push(...extraerFragmentos(nodo.children, estiloElemento(nodo, estilo)));
  }
  return fragmentos;
}

function extraerBloques(contenido: string): FragmentoTexto[][] {
  const documento = parseDocument(obtenerContenidoConsentimientoHtml(contenido));
  const bloques: FragmentoTexto[][] = [];
  let fragmentosSueltos: FragmentoTexto[] = [];

  const guardarSueltos = () => {
    if (fragmentosSueltos.length > 0) bloques.push(fragmentosSueltos);
    fragmentosSueltos = [];
  };

  for (const nodo of documento.children) {
    if (nodo instanceof Text) {
      fragmentosSueltos.push(...extraerFragmentos([nodo]));
      continue;
    }
    if (!(nodo instanceof Element)) continue;
    if (nodo.name === "p") {
      guardarSueltos();
      bloques.push(extraerFragmentos(nodo.children));
      continue;
    }
    if (nodo.name === "ul" || nodo.name === "ol") {
      guardarSueltos();
      let indice = 1;
      for (const hijo of nodo.children) {
        if (!(hijo instanceof Element) || hijo.name !== "li") continue;
        const prefijo = nodo.name === "ol" ? `${indice}. ` : "• ";
        bloques.push([{ ...estiloBase, text: prefijo }, ...extraerFragmentos(hijo.children)]);
        indice += 1;
      }
      continue;
    }
    fragmentosSueltos.push(...extraerFragmentos([nodo]));
  }
  guardarSueltos();
  return bloques;
}

function fuentePdf(estilo: EstiloTexto): string {
  if (estilo.bold && estilo.italic) return "Helvetica-BoldOblique";
  if (estilo.bold) return "Helvetica-Bold";
  if (estilo.italic) return "Helvetica-Oblique";
  return "Helvetica";
}

function renderizarDescripcion(
  doc: PDFKit.PDFDocument,
  descripcion: string,
  width: number
): void {
  for (const bloque of extraerBloques(descripcion)) {
    if (bloque.length === 0) {
      doc.moveDown(0.5);
      continue;
    }
    bloque.forEach((fragmento, index) => {
      doc
        .font(fuentePdf(fragmento))
        .fontSize(fragmento.size)
        .fillColor(fragmento.color)
        .text(fragmento.text, {
          width,
          align: "left",
          lineGap: 3,
          underline: fragmento.underline,
          continued: index < bloque.length - 1,
        });
    });
    doc.fillColor("#000000").moveDown(0.55);
  }
}

export async function generarPdfConsentimiento({
  titulo,
  descripcion,
  jugador,
  firmante,
  firmadoAt,
  firmaPng,
}: GenerarPdfConsentimientoParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 55, bottom: 55, left: 55, right: 55 },
        info: {
          Title: titulo,
          Subject: "Consentimiento firmado",
          Creator: "Control de Equipos",
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.font("Helvetica-Bold").fontSize(18).text("CONSENTIMIENTO", { align: "center" });
      doc.moveDown(1);
      doc.fontSize(14).text(titulo);
      doc.moveDown(0.8);
      renderizarDescripcion(doc, descripcion, width);

      doc.moveDown(1.5);
      doc.font("Helvetica-Bold").fontSize(10).text("Jugador");
      doc.font("Helvetica").text(`${jugador.nombre} ${jugador.apellidos}`);
      if (jugador.dniNie) doc.text(`DNI/NIE: ${jugador.dniNie}`);

      doc.moveDown(1);
      doc.font("Helvetica-Bold").text("Firmante");
      doc.font("Helvetica").text(firmante.nombre);
      doc.text(firmante.email);
      doc.text(
        firmante.esTutor
          ? "Actúa como tutor o responsable del jugador"
          : "Actúa como el propio jugador"
      );
      doc.text(`Fecha y hora: ${formatearFechaHora(firmadoAt)}`);

      doc.moveDown(1.5);
      if (doc.y + 180 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      doc.font("Helvetica-Bold").text("Firma");
      const firmaY = doc.y + 8;
      doc.rect(doc.page.margins.left, firmaY, width, 150).strokeColor("#cccccc").stroke();
      doc.image(firmaPng, doc.page.margins.left + 15, firmaY + 15, {
        fit: [width - 30, 120],
        align: "center",
        valign: "center",
      });

      doc.font("Helvetica").fontSize(7).fillColor("#777777").text(
        "Documento generado electrónicamente desde el área privada de Control de Equipos.",
        doc.page.margins.left,
        doc.page.height - doc.page.margins.bottom - 15,
        { width, align: "center" }
      );
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
