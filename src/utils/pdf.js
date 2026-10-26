import { jsPDF } from "jspdf";

export function descargarPDF(titulo, columnas, filas, nombreArchivo) {
  const doc = new jsPDF({ unit: "pt" });
  const margen = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LA TROJE", margen, y);
  y += 20;
  doc.setFontSize(12);
  doc.text(titulo, margen, y);
  y += 10;
  doc.setDrawColor(180);
  doc.line(margen, y, 555, y);
  y += 20;

  const anchoCol = (555 - margen) / columnas.length;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  columnas.forEach((c, i) => {
    doc.text(String(c.titulo), margen + i * anchoCol, y);
  });
  y += 14;
  doc.setDrawColor(220);
  doc.line(margen, y - 8, 555, y - 8);
  doc.setFont("helvetica", "normal");

  filas.forEach((fila) => {
    if (y > 780) {
      doc.addPage();
      y = 50;
    }
    columnas.forEach((c, i) => {
      const valor = String(fila[c.clave] ?? "");
      doc.text(valor.substring(0, 28), margen + i * anchoCol, y);
    });
    y += 16;
  });

  doc.save(nombreArchivo.endsWith(".pdf") ? nombreArchivo : `${nombreArchivo}.pdf`);
}

const fmtBs = (n) => `Bs ${Number(n || 0).toFixed(2)}`;

// Reporte de cierre de caja de una cajera (un turno).
export function descargarReporteCierrePDF(c) {
  const doc = new jsPDF({ unit: "pt" });
  const margen = 40;
  const derecha = 555;
  let y = 50;

  const nuevaPaginaSiHaceFalta = (alto = 20) => {
    if (y + alto > 790) {
      doc.addPage();
      y = 50;
    }
  };
  const fila = (izq, der, negrita = false) => {
    nuevaPaginaSiHaceFalta();
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.text(String(izq), margen, y);
    doc.text(String(der), derecha, y, { align: "right" });
    y += 18;
  };
  const titulo = (texto) => {
    nuevaPaginaSiHaceFalta(60);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(texto, margen, y);
    y += 8;
    doc.setFontSize(9);
  };

  // Tabla en columnas. cols: [{ t: "Titulo", x: posicion, w: ancho (si el texto se parte en lineas), align }]
  // Con align "right", x es el borde derecho de la columna.
  const tabla = (cols, filas) => {
    const alto = 18;
    const dibujarEncabezado = () => {
      doc.setFillColor(0, 0, 0);
      doc.rect(margen, y, derecha - margen, alto, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      cols.forEach((col) => {
        doc.text(col.t, col.x, y + 12, { align: col.align || "left" });
      });
      doc.setTextColor(0);
      y += alto;
    };
    nuevaPaginaSiHaceFalta(alto * 3);
    dibujarEncabezado();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    filas.forEach((f, n) => {
      // Las columnas con ancho (w) se parten en varias lineas si el texto es largo.
      const lineas = cols.map((col, k) =>
        col.w ? doc.splitTextToSize(String(f[k] ?? ""), col.w) : [String(f[k] ?? "")]
      );
      const nLineas = Math.max(...lineas.map((l) => l.length));
      const altoFila = Math.max(alto, nLineas * 11 + 7);
      if (y + altoFila > 790) {
        doc.addPage();
        y = 50;
        dibujarEncabezado();
        doc.setFont("helvetica", "normal");
      }
      if (n % 2 === 1) {
        doc.setFillColor(238, 238, 238);
        doc.rect(margen, y, derecha - margen, altoFila, "F");
      }
      cols.forEach((col, k) => {
        doc.text(lineas[k], col.x, y + 12, { align: col.align || "left" });
      });
      y += altoFila;
    });
    doc.setDrawColor(0);
    doc.line(margen, y, derecha, y);
    y += 14;
  };

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("LA TROJE", margen, y);
  y += 20;
  doc.setFontSize(12);
  doc.text("Reporte de cierre de caja", margen, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (c.evento) {
    doc.text(`Evento: ${c.evento}`, margen, y);
    y += 14;
  }
  doc.text(`Cajera: ${c.cajera || "-"}    Barra: ${c.barra || "-"}`, margen, y);
  y += 14;
  doc.text(
    `Apertura: ${c.fechaApertura ? new Date(c.fechaApertura).toLocaleString("es-BO") : "-"}    Cierre: ${new Date(c.fecha).toLocaleString("es-BO")}`,
    margen,
    y
  );
  y += 14;
  if ((c.meseros || []).length) {
    doc.text(`Meseros: ${c.meseros.join(", ")}`, margen, y);
    y += 14;
  }
  y += 6;
  doc.setDrawColor(0);
  doc.line(margen, y, derecha, y);
  y += 22;

  const efectivoAEntregar = Number(c.totalEfectivo || 0) - Number(c.totalGastos || 0);
  doc.setFontSize(12);
  fila("VENTAS EFECTIVO", fmtBs(c.totalEfectivo));
  fila("VENTAS QR", fmtBs(c.totalQr));
  fila("GASTOS", fmtBs(c.totalGastos));
  fila("VENTAS TOTALES", fmtBs(c.totalGeneral), true);
  y += 2;
  doc.setDrawColor(0);
  doc.line(margen, y - 8, derecha, y - 8);
  y += 14;
  doc.setFontSize(14);
  fila("EFECTIVO A ENTREGAR", fmtBs(efectivoAEntregar), true);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Efectivo a entregar = ventas totales - QR - gastos.", margen, y - 4);
  y += 10;
  if (Number(c.cajaChica) > 0) {
    doc.setFontSize(10);
    doc.text(`Caja chica con la que abrio: ${fmtBs(c.cajaChica)} (informativa, no se suma ni se resta)`, margen, y);
    doc.setFontSize(9);
    y += 18;
  }

  if ((c.productosVendidos || []).length) {
    titulo("Productos vendidos");
    tabla(
      [
        { t: "Producto", x: margen + 6, w: 200 },
        { t: "Cant.", x: 285, align: "right" },
        { t: "P. unitario", x: 360, align: "right" },
        { t: "Total", x: 440, align: "right" },
        { t: "Pago", x: 456 },
      ],
      c.productosVendidos.map((p) => [
        p.producto,
        Number(p.cantidad).toFixed(0),
        p.precioUnitario != null ? fmtBs(p.precioUnitario) : "-",
        fmtBs(p.total),
        p.pago || "-",
      ])
    );
  }
  if ((c.gastosDetalle || []).length) {
    titulo("Gastos");
    tabla(
      [
        { t: "Concepto", x: margen + 6, w: 170 },
        { t: "Observaciones", x: 225, w: 200 },
        { t: "Monto", x: derecha - 6, align: "right" },
      ],
      c.gastosDetalle.map((g) => [g.concepto, g.observaciones || "-", fmtBs(g.monto)])
    );
  }
  if ((c.cortesiasDetalle || []).length) {
    titulo("Cortesias (solo control, no se suman)");
    tabla(
      [
        { t: "Comanda", x: margen + 6 },
        { t: "Mesero", x: 100, w: 90 },
        { t: "Producto", x: 200, w: 190 },
        { t: "Cant.", x: 430, align: "right" },
        { t: "Precio botella", x: derecha - 6, align: "right" },
      ],
      c.cortesiasDetalle.map((k) => [k.comanda || "-", k.mesero || "-", k.producto, k.cantidad, fmtBs(k.precio)])
    );
  }

  const nombre = `cierre-${(c.cajera || "caja").replace(/\s+/g, "-")}-${new Date(c.fecha).toISOString().slice(0, 10)}`;
  doc.save(`${nombre}.pdf`);
}