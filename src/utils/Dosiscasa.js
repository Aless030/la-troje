// Dosis de la casa: cuántas dosis (o vasos) salen de cada tamaño de botella.
// Se identifican por el volumen de la botella en ml.
export const DOSIS_CASA = [
  { botellaMl: 700, dosis: 14, nombre: "Botella de 700 ml", detalle: "14 dosis de 50 ml" },
  { botellaMl: 750, dosis: 16, nombre: "Botella de 750 ml", detalle: "16 dosis" },
  { botellaMl: 1000, dosis: 20, nombre: "Botella de 1 litro", detalle: "20 dosis" },
  { botellaMl: 2000, dosis: 10, nombre: "Soda de 2 litros", detalle: "10 vasos" },
];

export function redondear4(n) {
  return Math.round(Number(n || 0) * 10000) / 10000;
}

// Formato de stock: sin decimales si es entero, hasta 2 decimales si no.
export function formatearStock(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function volumenEnMl(producto) {
  const v = Number(producto?.volumenCantidad) || 0;
  return String(producto?.volumenUnidad || "ml").toLowerCase() === "l" ? v * 1000 : v;
}

// Cuántas dosis de la casa salen de una botella de este producto (0 si no hay definida).
export function dosisPorBotella(producto) {
  const ml = volumenEnMl(producto);
  const d = DOSIS_CASA.find((x) => x.botellaMl === ml);
  return d ? d.dosis : 0;
}

// Fracción de botella/unidad de inventario que gasta un ingrediente.
// ml -> cantidad / volumen de la botella; dosis -> cantidad / dosis por botella;
// unidad -> la cantidad tal cual. Devuelve 0 si no se puede calcular.
export function consumoIngrediente(producto, cantidad, unidad) {
  const c = Number(cantidad) || 0;
  if (!producto || c <= 0) return 0;
  if (unidad === "unidad") return c;
  if (unidad === "dosis") {
    const d = dosisPorBotella(producto);
    return d > 0 ? c / d : 0;
  }
  const vol = volumenEnMl(producto);
  return vol > 0 ? c / vol : 0;
}

// Consumo de inventario de UN trago: [{ productoId, cantidad }] ya agrupado por producto.
export function consumoReceta(receta, productos) {
  const mapa = {};
  (receta?.ingredientes || []).forEach((ing) => {
    const producto = productos.find((p) => p.id === ing.productoId);
    const consumo = consumoIngrediente(producto, ing.cantidad, ing.unidad);
    if (consumo > 0) mapa[ing.productoId] = (mapa[ing.productoId] || 0) + consumo;
  });
  return Object.entries(mapa).map(([productoId, cantidad]) => ({ productoId, cantidad }));
}

// Cuántos tragos se pueden preparar con el stock que hay en un campo (stockInterior, etc.).
export function tragosDisponibles(receta, productos, campo) {
  const consumo = consumoReceta(receta, productos);
  if (consumo.length === 0) return 0;
  let max = Infinity;
  for (const c of consumo) {
    const p = productos.find((x) => x.id === c.productoId);
    const stock = Number(p?.[campo] || 0);
    max = Math.min(max, Math.floor(stock / c.cantidad + 1e-9));
  }
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}