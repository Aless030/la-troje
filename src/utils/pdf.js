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
