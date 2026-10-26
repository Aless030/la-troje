import { eventoDeApertura } from "./Evento";

const VENTANA_APERTURA_MS = 24 * 60 * 60 * 1000;

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export function mismoDia(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  );
}

// La caja activa es la apertura "abierta" más reciente de las últimas 24 horas
// (así un turno que pasa de medianoche sigue abierto, y una apertura vieja que
// quedó abierta por error no "revive" al cerrar la actual).
export function buscarAperturaActiva(aperturas) {
  const ahora = Date.now();
  const abiertas = aperturas
    .filter((a) => a.estado === "abierta" && ahora - new Date(a.fecha).getTime() < VENTANA_APERTURA_MS)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return abiertas[0] || null;
}

// Todas las cajas abiertas a la vez (ej. Interior y Semicubierto). Cada una descuenta del
// inventario de su propia barra. Si por un doble clic hay dos iguales (misma cajera y barra),
// se queda la más reciente. Se ordenan de la más antigua a la más nueva (pestañas estables).
export function buscarAperturasActivas(aperturas) {
  const ahora = Date.now();
  const abiertas = aperturas
    .filter((a) => a.estado === "abierta" && ahora - new Date(a.fecha).getTime() < VENTANA_APERTURA_MS)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const vistas = new Set();
  const unicas = [];
  abiertas.forEach((a) => {
    const clave = `${a.barra}|${String(a.cajera || "").trim().toLowerCase()}`;
    if (vistas.has(clave)) return;
    vistas.add(clave);
    unicas.push(a);
  });
  return unicas.reverse();
}

export function diaDeFecha(fechaIso) {
  const d = new Date(fechaIso).getDay();
  if (d === 4) return { dia: "jueves", diaEtiqueta: "Jueves" };
  if (d === 5) return { dia: "viernes", diaEtiqueta: "Viernes" };
  if (d === 6) return { dia: "sabado", diaEtiqueta: "Sábado" };
  const nombre = new Date(fechaIso).toLocaleDateString("es-BO", { weekday: "long" });
  return { dia: "otro", diaEtiqueta: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
}

// Arma el reporte del turno de una cajera (ventas con su aperturaId).
export function construirCierre({ apertura, ventas, gastosCaja, fechaCierre = new Date().toISOString() }) {
  const delTurno = ventas.filter((v) => v.aperturaId === apertura.id);
  const pagadas = delTurno.filter((v) => v.formaPago !== "cortesia");
  const cortesias = delTurno.filter((v) => v.formaPago === "cortesia");
  const gastos = gastosCaja.filter((g) => g.aperturaId === apertura.id);
  const evento = eventoDeApertura(apertura);

  const totalEfectivo = r2(pagadas.reduce((s, v) => s + Number(v.montoEfectivo || 0), 0));
  const totalQr = r2(pagadas.reduce((s, v) => s + Number(v.montoQr || 0), 0));
  const totalGastos = r2(gastos.reduce((s, g) => s + Number(g.monto || 0), 0));
  // Ventas totales = efectivo + QR. A mano se entrega: ventas totales - QR - gastos (= efectivo - gastos).
  // Caja chica: solo informativa, no entra en ningun calculo.
  const cajaChica = r2(apertura.cajaChica);
  const efectivoDeVenta = r2(totalEfectivo - totalGastos);
  const efectivoAEntregar = efectivoDeVenta;

  // Una fila por producto + precio unitario + forma de pago (QR / Efectivo / QR + Efectivo).
  const metodoDe = (v) => {
    const qr = Number(v.montoQr || 0) > 0;
    const ef = Number(v.montoEfectivo || 0) > 0;
    if (qr && ef) return "QR + Efectivo";
    return qr ? "QR" : "Efectivo";
  };
  const porProducto = {};
  pagadas.forEach((v) => {
    // Un producto vendido por vaso se separa del mismo producto vendido por botella.
    const nombre = v.unidad === "Vaso" && !v.recetaId ? `${v.producto} (vaso)` : v.producto;
    const precioUnitario = r2(v.precioUnitario);
    const pago = metodoDe(v);
    const clave = `${nombre}|${precioUnitario}|${pago}`;
    if (!porProducto[clave]) porProducto[clave] = { producto: nombre, precioUnitario, pago, cantidad: 0, total: 0 };
    porProducto[clave].cantidad += Number(v.cantidad || 0);
    porProducto[clave].total = r2(porProducto[clave].total + Number(v.total || 0));
  });

  return {
    fecha: fechaCierre,
    fechaApertura: apertura.fecha,
    ...diaDeFecha(apertura.fecha),
    aperturaId: apertura.id,
    evento: evento.nombre,
    eventoId: evento.id,
    cajera: apertura.cajera || "",
    barra: apertura.barra || "",
    meseros: apertura.meseros || [],
    totalEfectivo,
    totalQr,
    totalGeneral: r2(totalEfectivo + totalQr),
    totalGastos,
    cajaChica,
    efectivoDeVenta,
    efectivoAEntregar,
    cantidadVentas: pagadas.length,
    productosVendidos: Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad),
    gastosDetalle: gastos.map((g) => ({
      concepto: g.concepto || "",
      monto: Number(g.monto || 0),
      observaciones: g.observaciones || "",
    })),
    cortesiasDetalle: cortesias.map((v) => ({
      comanda: v.comanda || "",
      mesero: v.mesero || "",
      producto: v.producto,
      cantidad: Number(v.cantidad || 0),
      precio: Number(v.precioUnitario || 0),
    })),
  };
}

// Cierra el turno: guarda el reporte y marca la apertura como cerrada.
// También cierra aperturas duplicadas (mismo cajero, barra y día) que hayan
// quedado abiertas por un doble clic, para que la caja no se "reabra" sola.
export async function cerrarTurno({
  apertura, ventas, gastosCaja, aperturasCaja, registrarCierre, cerrarAperturaCaja,
}) {
  const cierre = construirCierre({ apertura, ventas, gastosCaja });
  await registrarCierre(cierre);
  await cerrarAperturaCaja(apertura.id, {
    fechaCierre: cierre.fecha,
    totalEfectivo: cierre.totalEfectivo,
    totalQr: cierre.totalQr,
    totalGastos: cierre.totalGastos,
    efectivoAEntregar: cierre.efectivoAEntregar,
  });
  const duplicadas = aperturasCaja.filter(
    (a) =>
      a.estado === "abierta" &&
      a.id !== apertura.id &&
      a.cajera === apertura.cajera &&
      a.barra === apertura.barra &&
      mismoDia(a.fecha, apertura.fecha)
  );
  await Promise.all(duplicadas.map((a) => cerrarAperturaCaja(a.id, { duplicadaDe: apertura.id })));
  return cierre;
}