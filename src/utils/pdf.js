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
    nuevaPaginaSiHaceFalta(30);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(texto, margen, y);
    y += 6;
    doc.setDrawColor(200);
    doc.line(margen, y, derecha, y);
    y += 16;
    doc.setFontSize(10);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("LA TROJE", margen, y);
  y += 20;
  doc.setFontSize(12);
  doc.text("Reporte de cierre de caja", margen, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
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
  doc.setDrawColor(150);
  doc.line(margen, y, derecha, y);
  y += 22;

  doc.setFontSize(12);
  fila("VENTAS EFECTIVO", fmtBs(c.totalEfectivo));
  fila("VENTAS QR", fmtBs(c.totalQr));
  fila("GASTOS", fmtBs(c.totalGastos));
  fila("VENTAS TOTALES", fmtBs(c.totalGeneral), true);
  if (Number(c.cajaChica) > 0) fila("CAJA CHICA (con la que abrio)", fmtBs(c.cajaChica));
  y += 4;
  doc.setDrawColor(150);
  doc.line(margen, y - 8, derecha, y - 8);
  doc.setFontSize(14);
  fila("EFECTIVO A ENTREGAR", fmtBs(c.efectivoAEntregar), true);
  doc.setFontSize(10);

  if ((c.productosVendidos || []).length) {
    titulo("Productos vendidos");
    c.productosVendidos.forEach((p) => fila(`${p.producto}  x${Number(p.cantidad).toFixed(0)}`, fmtBs(p.total)));
  }
  if ((c.gastosDetalle || []).length) {
    titulo("Gastos");
    c.gastosDetalle.forEach((g) =>
      fila(`${g.concepto}${g.observaciones ? ` (${g.observaciones})` : ""}`.substring(0, 80), fmtBs(g.monto))
    );
  }
  if ((c.cortesiasDetalle || []).length) {
    titulo("Cortesias (solo control, no se suman)");
    c.cortesiasDetalle.forEach((k) =>
      fila(
        `Comanda ${k.comanda || "-"} - ${k.producto} x${k.cantidad}${k.mesero ? ` (${k.mesero})` : ""}`.substring(0, 80),
        fmtBs(k.precio)
      )
    );
  }

  const nombre = `cierre-${(c.cajera || "caja").replace(/\s+/g, "-")}-${new Date(c.fecha).toISOString().slice(0, 10)}`;
  doc.save(`${nombre}.pdf`);
}