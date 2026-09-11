import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { descargarPDF } from "../utils/pdf";

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

export default function CierreCaja() {
  const { ventas, cierres, registrarCierre } = useData();
  const [cerrando, setCerrando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const ventasHoy = useMemo(() => ventas.filter((v) => esHoy(v.fecha)), [ventas]);

  const resumen = useMemo(() => {
    const totalQr = ventasHoy.reduce((s, v) => s + (v.montoQr || 0), 0);
    const totalEfectivo = ventasHoy.reduce((s, v) => s + (v.montoEfectivo || 0), 0);

    const porProducto = {};
    ventasHoy.forEach((v) => {
      if (!porProducto[v.producto]) {
        porProducto[v.producto] = { producto: v.producto, cantidad: 0, total: 0 };
      }
      porProducto[v.producto].cantidad += v.cantidad;
      porProducto[v.producto].total += v.total;
    });

    return {
      totalQr,
      totalEfectivo,
      totalGeneral: totalQr + totalEfectivo,
      productos: Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad),
    };
  }, [ventasHoy]);

  const yaCerradoHoy = cierres.some((c) => esHoy(c.fecha));

  async function cerrarCaja() {
    setCerrando(true);
    setMensaje("");
    try {
      await registrarCierre({
        fecha: new Date().toISOString(),
        totalQr: resumen.totalQr,
        totalEfectivo: resumen.totalEfectivo,
        totalGeneral: resumen.totalGeneral,
        cantidadVentas: ventasHoy.length,
        productosVendidos: resumen.productos,
      });
      setMensaje("Caja cerrada y guardada correctamente.");
    } catch (err) {
      console.error(err);
      setMensaje("No se pudo cerrar la caja. Intenta de nuevo.");
    } finally {
      setCerrando(false);
    }
  }

  function exportarPDF() {
    descargarPDF(
      `Cierre de caja — ${new Date().toLocaleDateString("es-BO")}`,
      [
        { titulo: "Producto", clave: "producto" },
        { titulo: "Cantidad", clave: "cantidad" },
        { titulo: "Total Bs", clave: "total" },
      ],
      resumen.productos.map((p) => ({ ...p, total: p.total.toFixed(2) })),
      `cierre-caja-${new Date().toISOString().slice(0, 10)}`
    );
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Cierre de caja</h1>
        <p>Resumen de todo lo vendido hoy, listo para cerrar el día.</p>
      </header>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ventas hoy</span>
          <span className="tarjeta-metrica__valor">{ventasHoy.length}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Efectivo</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.totalEfectivo.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">QR</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.totalQr.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Total general</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.totalGeneral.toFixed(2)}</span>
        </div>
      </div>

      <section className="lista-reciente">
        <h2>Productos vendidos hoy</h2>
        {resumen.productos.length === 0 ? (
          <p className="texto-vacio">Todavía no hay ventas hoy para cerrar.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad vendida</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.productos.map((p) => (
                <tr key={p.producto}>
                  <td>{p.producto}</td>
                  <td>{p.cantidad}</td>
                  <td>Bs {p.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="formulario__acciones">
        <button
          className="boton boton--primario"
          onClick={cerrarCaja}
          disabled={cerrando || ventasHoy.length === 0 || yaCerradoHoy}
        >
          {yaCerradoHoy ? "Caja ya cerrada hoy" : cerrando ? "Cerrando…" : "Cerrar caja de hoy"}
        </button>
        <button className="boton boton--fantasma" onClick={exportarPDF} disabled={resumen.productos.length === 0}>
          Descargar PDF
        </button>
      </div>
      {mensaje && <div className="formulario__error formulario__error--exito">{mensaje}</div>}
    </div>
  );
}
