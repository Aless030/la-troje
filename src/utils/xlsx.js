import { etiquetaBarra } from "./barras";

// Descargas en Excel (.xlsx). Se carga la librería solo cuando se pide la descarga,
// así la app no pesa más al abrir.

// "12.50" -> 12.5 (para que Excel pueda sumar). Textos como "00123" (facturas) se dejan tal cual.
function aCelda(valor) {
  if (typeof valor === "string" && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(valor.trim())) return Number(valor);
  return valor ?? "";
}

function anchos(filasAoA) {
  const n = Math.max(0, ...filasAoA.map((f) => f.length));
  return Array.from({ length: n }, (_, c) => ({
    wch: Math.min(48, Math.max(10, ...filasAoA.map((f) => String(f[c] ?? "").length + 2))),
  }));
}

function guardar(XLSX, hojas, nombreArchivo) {
  const libro = XLSX.utils.book_new();
  hojas.forEach(({ nombre, filas }) => {
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja["!cols"] = anchos(filas);
    XLSX.utils.book_append_sheet(libro, hoja, nombre.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
  });
  XLSX.writeFile(libro, nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`);
}

// Misma forma que descargarCSV: (nombre, columnas [{titulo, clave}], filas [objetos]).
export async function descargarXLSX(nombreArchivo, columnas, filas, nombreHoja = "Reporte") {
  const XLSX = await import("xlsx");
  const datos = [
    columnas.map((c) => c.titulo),
    ...filas.map((f) => columnas.map((c) => aCelda(f[c.clave]))),
  ];
  guardar(XLSX, [{ nombre: nombreHoja, filas: datos }], nombreArchivo);
}

// Reporte de cierre de caja (un turno): resumen + productos, gastos y cortesías en hojas aparte.
export async function descargarReporteCierreXLSX(c) {
  const XLSX = await import("xlsx");
  const efectivoAEntregar = Number(c.totalEfectivo || 0) - Number(c.totalGastos || 0);
  const resumen = [
    ["LA TROJE — Reporte de cierre de caja"],
    [],
    ["Evento", c.evento || "-"],
    ["Cajera", c.cajera || "-"],
    ["Barra", etiquetaBarra(c.barra)],
    ["Apertura", c.fechaApertura ? new Date(c.fechaApertura).toLocaleString("es-BO") : "-"],
    ["Cierre", new Date(c.fecha).toLocaleString("es-BO")],
    ["Meseros", (c.meseros || []).join(", ") || "-"],
    [],
    ["Ventas efectivo (Bs)", Number(c.totalEfectivo || 0)],
    ["Ventas QR (Bs)", Number(c.totalQr || 0)],
    ["Gastos (Bs)", Number(c.totalGastos || 0)],
    ["Ventas totales (Bs)", Number(c.totalGeneral || 0)],
    ["Efectivo a entregar (Bs)", efectivoAEntregar],
    ["Caja chica con la que abrió (Bs)", Number(c.cajaChica || 0)],
  ];
  const hojas = [{ nombre: "Resumen", filas: resumen }];
  if ((c.productosVendidos || []).length) {
    hojas.push({
      nombre: "Productos vendidos",
      filas: [
        ["Producto", "Cantidad", "Precio unitario (Bs)", "Total (Bs)", "Pago"],
        ...c.productosVendidos.map((p) => [p.producto, Number(p.cantidad), p.precioUnitario ?? "", Number(p.total || 0), p.pago || ""]),
      ],
    });
  }
  if ((c.gastosDetalle || []).length) {
    hojas.push({
      nombre: "Gastos",
      filas: [["Concepto", "Observaciones", "Monto (Bs)"], ...c.gastosDetalle.map((g) => [g.concepto, g.observaciones || "", Number(g.monto || 0)])],
    });
  }
  if ((c.cortesiasDetalle || []).length) {
    hojas.push({
      nombre: "Cortesías",
      filas: [
        ["Comanda", "Mesero", "Producto", "Cantidad", "Precio botella (Bs)"],
        ...c.cortesiasDetalle.map((k) => [k.comanda || "", k.mesero || "", k.producto, k.cantidad, Number(k.precio || 0)]),
      ],
    });
  }
  const nombre = `cierre-${(c.cajera || "caja").replace(/\s+/g, "-")}-${new Date(c.fecha).toISOString().slice(0, 10)}`;
  guardar(XLSX, hojas, nombre);
}

// Respaldo: una hoja por colección con TODOS los campos de cada registro.
// hojas: [{ nombre: "Ventas", filas: [{...}, ...] }]
export async function descargarRespaldoXLSX(nombreArchivo, hojas) {
  const XLSX = await import("xlsx");
  const plano = (v) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") {
      if (typeof v.toDate === "function") return v.toDate().toISOString(); // fecha de Firebase
      return JSON.stringify(v);
    }
    return v;
  };
  const libro = hojas
    .filter((h) => h.filas.length > 0)
    .map((h) => {
      const claves = [...new Set(h.filas.flatMap((f) => Object.keys(f)))];
      const orden = ["fecha", ...claves.filter((k) => k !== "fecha" && k !== "id"), "id"].filter((k) => claves.includes(k));
      return { nombre: h.nombre, filas: [orden, ...h.filas.map((f) => orden.map((k) => aCelda(plano(f[k]))))] };
    });
  if (libro.length === 0) return false;
  guardar(XLSX, libro, nombreArchivo);
  return true;
}