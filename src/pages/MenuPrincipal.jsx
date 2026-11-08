import { stockTotal } from "../utils/barras";
import { useMemo } from "react";
import { useData } from "../context/DataContext";
import { buscarAperturasActivas } from "../utils/Turno";
import { eventoDeApertura, eventoDeRegistro, etiquetaEvento, listarEventos, mapaAperturas } from "../utils/Evento";

export default function MenuPrincipal({ irA, permitidas }) {
  const { ventas, productos, movimientos, aperturasCaja = [], cierres = [] } = useData();

  // El resumen es por EVENTO, no por día calendario: una venta a las 2 a.m. pertenece al
  // evento de la noche anterior. Evento actual = el de las cajas abiertas; si no hay ninguna
  // abierta, el último evento que tuvo ventas.
  const evento = useMemo(() => {
    const lista = listarEventos({ aperturas: aperturasCaja, ventas, cierres });
    const activas = buscarAperturasActivas(aperturasCaja);
    if (activas.length > 0) {
      const ev = eventoDeApertura(activas[0]);
      return { ...ev, ...(lista.find((e) => e.id === ev.id) || {}), enCurso: true };
    }
    const porId = mapaAperturas(aperturasCaja);
    const conVentas = new Set(ventas.map((v) => eventoDeRegistro(v, porId).id));
    const ultimo = lista.find((e) => conVentas.has(e.id)) || lista[0];
    return ultimo ? { ...ultimo, enCurso: false } : null;
  }, [aperturasCaja, ventas, cierres]);

  const resumenHoy = useMemo(() => {
    const porId = mapaAperturas(aperturasCaja);
    const ventasHoy = evento ? ventas.filter((v) => eventoDeRegistro(v, porId).id === evento.id) : [];
    const totalQr = ventasHoy.reduce((s, v) => s + (v.montoQr || 0), 0);
    const totalEfectivo = ventasHoy.reduce((s, v) => s + (v.montoEfectivo || 0), 0);
    // Solo los productos que se agotaron del todo (sin nada en almacén ni en las barras).
    const stockBajo = productos.filter(
      (p) => stockTotal(p) <= 0
    );
    return {
      cantidadVentas: ventasHoy.length,
      totalQr,
      totalEfectivo,
      total: totalQr + totalEfectivo,
      stockBajo,
    };
  }, [ventas, productos, evento, aperturasCaja]);

  const todosLosAccesos = [
    { id: "ventas", titulo: "Registrar venta", detalle: "Nueva venta con mesero y forma de pago" },
    { id: "inventario", titulo: "Inventario", detalle: "Cargar productos y ver existencias" },
    { id: "distribucion", titulo: "Distribución", detalle: "Repartir productos a las barras" },
    { id: "recetario", titulo: "Recetario y tragos", detalle: "Costo de cada trago según sus ingredientes" },
    { id: "cierre", titulo: "Cierre de caja", detalle: "Cerrar el día y ver QR vs efectivo" },
    { id: "reportes", titulo: "Reportes", detalle: "Por mesero, por producto y saldos" },
    { id: "dashboard", titulo: "Dashboard", detalle: "Métricas generales del negocio" },
    { id: "movimientos", titulo: "Movimientos de caja", detalle: "Sueldos, proveedores y facturas" },
    { id: "semanal", titulo: "Semanales", detalle: "Ingresos y gastos de la semana" },
  ];
  // Solo las pantallas a las que este usuario puede entrar.
  const accesos = permitidas ? todosLosAccesos.filter((a) => permitidas.includes(a.id)) : todosLosAccesos;

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Menú principal</h1>
        <p>
          {evento
            ? `${evento.enCurso ? "Evento en curso" : "Último evento (sin caja abierta)"} — ${evento.etiqueta || etiquetaEvento(evento)}`
            : "Todavía no hay eventos registrados"}
        </p>
      </header>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ventas del evento</span>
          <span className="tarjeta-metrica__valor">{resumenHoy.cantidadVentas}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Total efectivo</span>
          <span className="tarjeta-metrica__valor">Bs {resumenHoy.totalEfectivo.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Total QR</span>
          <span className="tarjeta-metrica__valor">Bs {resumenHoy.totalQr.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Total del evento</span>
          <span className="tarjeta-metrica__valor">Bs {resumenHoy.total.toFixed(2)}</span>
        </div>
      </div>

      {resumenHoy.stockBajo.length > 0 && (
        <div className="aviso">
          <strong>Sin stock:</strong>{" "}
          {resumenHoy.stockBajo.map((p) => p.nombre).join(", ")}
        </div>
      )}

      <div className="grilla-accesos">
        {accesos.map((a) => (
          <button key={a.id} className="tarjeta-acceso" onClick={() => irA(a.id)}>
            <span className="tarjeta-acceso__titulo">{a.titulo}</span>
            <span className="tarjeta-acceso__detalle">{a.detalle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}