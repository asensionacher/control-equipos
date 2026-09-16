import PDFDocument from "pdfkit";
import type { ConfiguracionClub, Jugador, Recibo, ReciboJugador } from "@prisma/client";
import { getObjectBuffer } from "./s3";
import { formatearFecha, formatearNumero, formatearNumeroRecibo } from "./utils";

type UsuarioBasico = {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string | null;
};

type EquipoBasico = {
  id?: string;
  nombre: string;
  temporada?: { nombre: string } | null;
};

type JugadorCompleto = Jugador & {
  tutorias?: Array<{ id: string; esPrincipal: boolean; usuario?: UsuarioBasico | null }>;
  usuario?: UsuarioBasico | null;
};

type ReciboJugadorCompleto = ReciboJugador & {
  jugador: JugadorCompleto;
  equiposOrigen?: EquipoBasico[];
};

type ReciboCompleto = Recibo & {
  jugadores: ReciboJugadorCompleto[];
  equipo?: EquipoBasico | null;
  equipos?: EquipoBasico[];
};

export interface GenerarPdfReciboParams {
  recibo: ReciboCompleto;
  club: ConfiguracionClub;
  numeroRecibo?: number;
  jugadorObjetivo?: JugadorCompleto;
}

export async function generarPdfRecibo(params: GenerarPdfReciboParams): Promise<Buffer> {
  let logo: Buffer | null = null;
  if (params.club.logoKey) {
    try {
      logo = await getObjectBuffer(params.club.logoKey);
    } catch (error) {
      console.error("[recibo] No se pudo cargar el escudo para el PDF:", error);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 42, bottom: 42, left: 42, right: 42 },
        info: {
          Title: params.numeroRecibo
            ? `Recibo ${formatearNumeroRecibo(params.numeroRecibo)}`
            : "Resumen de recibos",
          Author: params.club.nombre,
          Subject: "Recibo",
          Creator: params.club.nombre,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawRecibo(doc, params, logo);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function drawRecibo(
  doc: PDFKit.PDFDocument,
  params: GenerarPdfReciboParams,
  logo: Buffer | null
) {
  const { recibo, club, jugadorObjetivo } = params;
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width - margin - doc.page.margins.right;
  const accent = /^#[0-9a-f]{6}$/i.test(club.colorPrimario)
    ? club.colorPrimario
    : "#4568ff";
  const dark = "#293043";
  const muted = "#818a9f";
  const panel = "#f5f7fa";
  const border = "#e8ebf0";
  const reciboJugador = jugadorObjetivo
    ? recibo.jugadores.find((item) => item.jugadorId === jugadorObjetivo.id) ?? null
    : null;
  const estado = reciboJugador?.estado ?? recibo.estado;
  const numero = params.numeroRecibo
    ? formatearNumeroRecibo(params.numeroRecibo)
    : `EMISIÓN ${recibo.id}`;

  drawClubHeader(doc, { club, logo, accent, dark, muted, margin, pageWidth });
  drawReceiptHeading(doc, { numero, estado, accent, dark, muted, margin, pageWidth });

  const cardsY = 170;
  const gap = 14;
  const cardWidth = (pageWidth - gap) / 2;
  drawClientCard(doc, {
    x: margin,
    y: cardsY,
    width: cardWidth,
    height: 94,
    jugador: jugadorObjetivo ?? null,
    recibo,
    reciboJugador,
    panel,
    accent,
    dark,
    muted,
  });
  drawReceiptCard(doc, {
    x: margin + cardWidth + gap,
    y: cardsY,
    width: cardWidth,
    height: 94,
    recibo,
    panel,
    accent,
    dark,
    muted,
  });

  drawConceptSection(doc, {
    recibo,
    x: margin,
    y: 300,
    width: pageWidth,
    panel,
    border,
    dark,
    muted,
  });
  drawTotalsCard(doc, {
    recibo,
    x: margin + pageWidth * 0.57,
    y: 435,
    width: pageWidth * 0.43,
    panel,
    accent,
    dark,
    muted,
  });
  drawPaymentsSection(doc, {
    recibo,
    reciboJugador,
    estado,
    x: margin,
    y: 560,
    width: pageWidth,
    panel,
    border,
    dark,
    muted,
    accent,
  });
  drawFooter(doc, { club, margin, pageWidth, dark, muted, border });
}

function drawClubHeader(
  doc: PDFKit.PDFDocument,
  params: {
    club: ConfiguracionClub;
    logo: Buffer | null;
    accent: string;
    dark: string;
    muted: string;
    margin: number;
    pageWidth: number;
  }
) {
  const { club, logo, accent, dark, muted, margin } = params;
  const logoSize = 52;

  if (logo) {
    try {
      doc.save();
      doc.circle(margin + logoSize / 2, 65 + logoSize / 2, logoSize / 2).clip();
      doc.image(logo, margin, 65, { fit: [logoSize, logoSize], align: "center", valign: "center" });
      doc.restore();
    } catch (error) {
      doc.restore();
      console.error("[recibo] El formato del escudo no es compatible con PDFKit:", error);
      drawLogoFallback(doc, margin, 65, logoSize, club.nombre, accent);
    }
  } else {
    drawLogoFallback(doc, margin, 65, logoSize, club.nombre, accent);
  }

  const textX = margin + logoSize + 18;
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(12).text(club.nombre, textX, 64, {
    width: 250,
    ellipsis: true,
  });
  let y = 84;
  doc.fillColor(muted).font("Helvetica").fontSize(7.5);
  if (club.nif) {
    doc.text(`CIF/NIF: ${club.nif}`, textX, y, { width: 260 });
    y += 14;
  }
  const direccion = [club.direccion, [club.codigoPostal, club.ciudad].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");
  if (direccion) {
    doc.text(direccion, textX, y, { width: 285, ellipsis: true });
    y += 14;
  }
  const contacto = [club.email, club.telefono].filter(Boolean).join(" · ");
  if (contacto) doc.text(contacto, textX, y, { width: 285, ellipsis: true });
}

function drawLogoFallback(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
  nombre: string,
  accent: string
) {
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join("")
    .toUpperCase();
  doc.circle(x + size / 2, y + size / 2, size / 2).fill(accent);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(iniciales, x, y + 18, { width: size, align: "center" });
}

function drawReceiptHeading(
  doc: PDFKit.PDFDocument,
  params: {
    numero: string;
    estado: string;
    accent: string;
    dark: string;
    muted: string;
    margin: number;
    pageWidth: number;
  }
) {
  const { numero, estado, accent, dark, muted, margin, pageWidth } = params;
  const rightX = margin + pageWidth - 185;
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(20).text("Detalle", rightX, 66, {
    width: 185,
    align: "right",
  });
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("Recibo", rightX, 97, {
    width: 120,
    align: "right",
    continued: true,
  });
  doc.fillColor(accent).font("Helvetica-Bold").text(`  ${numero}`, { continued: false });

  const config =
    estado === "PAGADO"
      ? { label: "PAGADO", fill: "#dff5e9", text: "#27845d", width: 64 }
      : estado === "ANULADO"
        ? { label: "ANULADO", fill: "#f1f2f5", text: "#6f7788", width: 68 }
        : { label: "PENDIENTE", fill: "#fff1d6", text: "#a76d00", width: 82 };
  const pillX = margin + pageWidth - config.width;
  doc.roundedRect(pillX, 125, config.width, 25, 13).fill(config.fill);
  doc
    .fillColor(config.text)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text(config.label, pillX, 134, { width: config.width, align: "center" });
}

function drawClientCard(
  doc: PDFKit.PDFDocument,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    jugador: JugadorCompleto | null;
    recibo: ReciboCompleto;
    reciboJugador: ReciboJugadorCompleto | null;
    panel: string;
    accent: string;
    dark: string;
    muted: string;
  }
) {
  const { x, y, width, height, jugador, recibo, reciboJugador, panel, accent, dark, muted } =
    params;
  drawPanel(doc, x, y, width, height, panel, accent);
  drawEyebrow(doc, "CLIENTE", x + 15, y + 15, muted);

  const nombre = jugador
    ? `${jugador.nombre} ${jugador.apellidos}`
    : `${recibo.jugadores.length} jugadores asignados`;
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(8.5).text(nombre, x + 15, y + 39, {
    width: width - 30,
    ellipsis: true,
  });
  let lineY = y + 57;
  if (jugador?.dniNie) {
    doc.fillColor(muted).font("Helvetica").fontSize(7.5).text(`DNI/NIE ${jugador.dniNie}`, x + 15, lineY, {
      width: width - 30,
    });
    lineY += 15;
  }
  const equipos = resolveEquipos(recibo, reciboJugador);
  if (equipos.length > 0) {
    doc
      .fillColor(muted)
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        `Equipo${equipos.length > 1 ? "s" : ""} ${equipos
          .map((equipo) =>
            equipo.temporada ? `${equipo.nombre} ${equipo.temporada.nombre}` : equipo.nombre
          )
          .join(" · ")}`,
        x + 15,
        lineY,
        { width: width - 30, height: 22, ellipsis: true }
      );
  }

}

function drawReceiptCard(
  doc: PDFKit.PDFDocument,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    recibo: Recibo;
    panel: string;
    accent: string;
    dark: string;
    muted: string;
  }
) {
  const { x, y, width, height, recibo, panel, accent, muted } = params;
  drawPanel(doc, x, y, width, height, panel, accent);
  drawEyebrow(doc, "RECIBO", x + 15, y + 15, muted);
  drawLabelValue(doc, "Emitido:", formatearFecha(recibo.fechaEmision), x + 15, y + 42, width - 30, muted);
  drawLabelValue(
    doc,
    "Vencimiento:",
    recibo.fechaVencimiento ? formatearFecha(recibo.fechaVencimiento) : "—",
    x + 15,
    y + 63,
    width - 30,
    muted
  );
}

function drawConceptSection(
  doc: PDFKit.PDFDocument,
  params: {
    recibo: Recibo;
    x: number;
    y: number;
    width: number;
    panel: string;
    border: string;
    dark: string;
    muted: string;
  }
) {
  const { recibo, x, y, width, panel, border, dark, muted } = params;
  drawSectionTitle(doc, "CONCEPTO", x, y, muted);
  const tableY = y + 25;
  doc.roundedRect(x, tableY, width, 86, 4).fillAndStroke("#ffffff", border);
  doc.rect(x, tableY, width, 31).fill(panel);
  drawEyebrow(doc, "CONCEPTO", x + 12, tableY + 12, dark);
  drawEyebrow(doc, "IMPORTE", x + width - 115, tableY + 12, dark, 103, "right");
  doc
    .fillColor(dark)
    .font("Helvetica")
    .fontSize(8.5)
    .text(recibo.concepto, x + 12, tableY + 48, {
      width: width - 145,
      height: 16,
      ellipsis: true,
    });
  doc
    .fillColor(dark)
    .font("Helvetica")
    .fontSize(8.5)
    .text(`${formatearNumero(Number(recibo.total))} €`, x + width - 115, tableY + 48, {
      width: 103,
      align: "right",
    });
  if (recibo.descripcion) {
    doc.fillColor(muted).font("Helvetica").fontSize(6.8).text(recibo.descripcion, x + 12, tableY + 65, {
      width: width - 145,
      height: 13,
      ellipsis: true,
    });
  }
}

function drawTotalsCard(
  doc: PDFKit.PDFDocument,
  params: {
    recibo: Recibo;
    x: number;
    y: number;
    width: number;
    panel: string;
    accent: string;
    dark: string;
    muted: string;
  }
) {
  const { recibo, x, y, width, panel, accent, dark, muted } = params;
  const base = Number(recibo.baseImponible);
  const iva = Number(recibo.cuotaIva);
  const ivaPct = Number(recibo.tipoIva);
  const total = Number(recibo.total);
  const height = iva > 0 ? 104 : 82;
  doc.roundedRect(x, y, width, height, 6).fill(panel);
  drawLabelValue(doc, "Base imponible", `${formatearNumero(base)} €`, x + 13, y + 17, width - 26, muted, dark);
  let separatorY = y + 38;
  if (iva > 0) {
    drawLabelValue(
      doc,
      `IVA (${formatearNumero(ivaPct)}%)`,
      `${formatearNumero(iva)} €`,
      x + 13,
      y + 38,
      width - 26,
      muted,
      dark
    );
    separatorY = y + 61;
  }
  doc.moveTo(x + 13, separatorY).lineTo(x + width - 13, separatorY).lineWidth(1.4).strokeColor(dark).stroke();
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(11).text("Total", x + 13, separatorY + 16, {
    width: width / 2,
  });
  doc
    .fillColor(accent)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`${formatearNumero(total)} €`, x + width / 2, separatorY + 16, {
      width: width / 2 - 13,
      align: "right",
    });
}

function drawPaymentsSection(
  doc: PDFKit.PDFDocument,
  params: {
    recibo: Recibo;
    reciboJugador: ReciboJugadorCompleto | null;
    estado: string;
    x: number;
    y: number;
    width: number;
    panel: string;
    border: string;
    dark: string;
    muted: string;
    accent: string;
  }
) {
  const { recibo, reciboJugador, estado, x, y, width, panel, border, dark, muted, accent } =
    params;
  drawSectionTitle(doc, "PAGOS", x, y, muted);
  const tableY = y + 25;
  doc.roundedRect(x, tableY, width, 72, 4).fillAndStroke("#ffffff", border);
  doc.rect(x, tableY, width, 30).fill(panel);

  const columns = [
    { label: "FECHA", x, width: width * 0.34, align: "left" as const },
    { label: "MÉTODO", x: x + width * 0.34, width: width * 0.21, align: "left" as const },
    { label: "REFERENCIA", x: x + width * 0.55, width: width * 0.25, align: "left" as const },
    { label: "IMPORTE", x: x + width * 0.8, width: width * 0.2, align: "right" as const },
  ];
  columns.forEach((column) =>
    drawEyebrow(doc, column.label, column.x + 10, tableY + 11, dark, column.width - 20, column.align)
  );

  const pago = reciboJugador
    ? {
        fecha: reciboJugador.fechaPago,
        metodo: reciboJugador.metodoPago,
        referencia: reciboJugador.referenciaPago,
      }
    : {
        fecha: recibo.fechaPago,
        metodo: recibo.metodoPago,
        referencia: recibo.referenciaPago,
      };

  if (estado === "PAGADO") {
    const values = [
      pago.fecha ? formatearFechaHora(pago.fecha) : "—",
      pago.metodo ?? "—",
      pago.referencia ?? "—",
      `${formatearNumero(Number(recibo.total))} €`,
    ];
    columns.forEach((column, index) => {
      doc
        .fillColor(index === 3 ? dark : muted)
        .font("Helvetica")
        .fontSize(7.5)
        .text(values[index], column.x + 10, tableY + 47, {
          width: column.width - 20,
          align: column.align,
          ellipsis: true,
        });
    });
  } else {
    doc
      .fillColor(estado === "ANULADO" ? muted : accent)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(
        estado === "ANULADO"
          ? "Este recibo está anulado."
          : "Pendiente de pago. Puedes subir el justificante desde el área privada.",
        x + 10,
        tableY + 47,
        { width: width - 20 }
      );
  }

  if (reciboJugador?.justificanteSubidoPorNombre) {
    const tipoGestor = reciboJugador.justificanteSubidoPorEsTutor
      ? "Tutor o responsable"
      : "Jugador";
    doc
      .fillColor(muted)
      .font("Helvetica")
      .fontSize(7)
      .text(
        `${tipoGestor} que realizó la gestión: ${reciboJugador.justificanteSubidoPorNombre}${
          reciboJugador.justificanteSubidoPorEmail
            ? ` · ${reciboJugador.justificanteSubidoPorEmail}`
            : ""
        }`,
        x,
        tableY + 82,
        { width }
      );
  }
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  params: {
    club: ConfiguracionClub;
    margin: number;
    pageWidth: number;
    dark: string;
    muted: string;
    border: string;
  }
) {
  const { club, margin, pageWidth, dark, muted, border } = params;
  const lineY = 756;
  doc.moveTo(margin, lineY).lineTo(margin + pageWidth, lineY).lineWidth(0.8).strokeColor(border).stroke();
  const contacto = [club.nif ? `CIF/NIF ${club.nif}` : null, club.email, club.telefono]
    .filter(Boolean)
    .join(" · ");
  const identidad = [club.nombre, contacto].filter(Boolean).join(" · ");
  doc
    .fillColor(dark)
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .text(identidad, margin, lineY + 14, {
      width: pageWidth,
      height: 10,
      align: "center",
      ellipsis: true,
    });
  doc
    .fillColor(muted)
    .font("Helvetica")
    .fontSize(6.3)
    .text(`Documento generado el ${formatearFechaHora(new Date())}.`, margin, lineY + 29, {
      width: pageWidth,
      height: 10,
      align: "center",
    });
}

function drawPanel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  panel: string,
  accent: string
) {
  doc.roundedRect(x, y, width, height, 4).fill(panel);
  doc.roundedRect(x, y, 2.5, height, 1.25).fill(accent);
}

function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  color: string
) {
  doc.fillColor(color).font("Helvetica-Bold").fontSize(8).text(label, x, y, {
    characterSpacing: 1.2,
  });
}

function drawEyebrow(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  color: string,
  width = 160,
  align: "left" | "right" = "left"
) {
  doc.fillColor(color).font("Helvetica-Bold").fontSize(6.5).text(label, x, y, {
    width,
    align,
    characterSpacing: 0.8,
  });
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  labelColor: string,
  valueColor = "#50586c"
) {
  doc.fillColor(labelColor).font("Helvetica").fontSize(7).text(label, x, y, {
    width: width * 0.5,
  });
  doc
    .fillColor(valueColor)
    .font("Helvetica")
    .fontSize(7)
    .text(value, x + width * 0.5, y, { width: width * 0.5, align: "right" });
}

function resolveEquipos(
  recibo: ReciboCompleto,
  reciboJugador: ReciboJugadorCompleto | null
): EquipoBasico[] {
  const equipos = new Map<string, EquipoBasico>();
  reciboJugador?.equiposOrigen?.forEach((equipo) =>
    equipos.set(equipo.id ?? equipo.nombre, equipo)
  );
  if (equipos.size === 0) {
    recibo.equipos?.forEach((equipo) => equipos.set(equipo.id ?? equipo.nombre, equipo));
    if (recibo.equipo) equipos.set(recibo.equipo.id ?? recibo.equipo.nombre, recibo.equipo);
  }
  return Array.from(equipos.values());
}

function formatearFechaHora(fecha: Date) {
  const date = new Date(fecha);
  return `${formatearFecha(date)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}
