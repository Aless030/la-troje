// Barras (puntos de venta) del local. Para agregar otra en el futuro basta con sumarla aquí
// (y su campo de stock se crea solo al usarla). Cada barra tiene su propio inventario.
export const BARRAS = [
  { valor: "interior", etiqueta: "Interior", campo: "stockInterior" },
  { valor: "semicubierto", etiqueta: "Semicubierto", campo: "stockSemicubierto" },
  { valor: "palmera", etiqueta: "Palmera", detalle: "Patio", campo: "stockPalmera" },
];

// Campo de stock del producto para una barra ("stock" = almacén general).
export function campoBarra(barra) {
  return BARRAS.find((b) => b.valor === barra)?.campo || "stock";
}

export function etiquetaBarra(barra) {
  return BARRAS.find((b) => b.valor === barra)?.etiqueta || barra || "—";
}

// Existencia total de un producto: almacén general + todas las barras.
export function stockTotal(p) {
  return BARRAS.reduce((suma, b) => suma + Number(p?.[b.campo] || 0), Number(p?.stock || 0));
}

// Existencia solo en barras (sin almacén general).
export function stockEnBarras(p) {
  return BARRAS.reduce((suma, b) => suma + Number(p?.[b.campo] || 0), 0);
}