import { useMemo } from "react";
import { useData } from "../context/DataContext";

function esHoy(fechaIso) {
  if (!fechaIso) return false;
  const hoy = new Date();
  const f = new Date(fechaIso);
  return (
    f.getFullYear() === hoy.getFullYear() &&
    f.getMonth() === hoy.getMonth() &&
    f.getDate() === hoy.getDate()
  );
}

export default function MenuPrincipal({ irA }) {
  const { ventas, productos, movimientos } = useData();

  const resumenHoy = useMemo(() => {
    const ventasHoy = ventas.filter((v) => esHoy(v.fecha));
    const totalQr = ventasHoy.reduce((s, v) => s + (v.montoQr || 0), 0);
    const totalEfectivo = ventasHoy.reduce((s, v) => s + (v.montoEfectivo || 0), 0);
    const stockBajo = productos.filter((p) => (p.stock ?? 0) <= (p.stockMinimo ?? 3));
    return {
      cantidadVentas: ventasHoy.length,
      totalQr,
      totalEfectivo,
      total: totalQr + totalEfectivo,
      stockBajo,
    };
  }, [ventas, productos]);

  const accesos = [
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

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Menú principal</h1>
        <p>Resumen del día — {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}</p>
      </header>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ventas de hoy</span>
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
          <span className="tarjeta-metrica__etiqueta">Total del día</span>
          <span className="tarjeta-metrica__valor">Bs {resumenHoy.total.toFixed(2)}</span>
        </div>
      </div>

      {resumenHoy.stockBajo.length > 0 && (
        <div className="aviso">
          <strong>Stock bajo:</strong>{" "}
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