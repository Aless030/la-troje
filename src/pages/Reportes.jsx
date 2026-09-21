import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { descargarCSV } from "../utils/csv";
import { descargarPDF } from "../utils/pdf";

function dentroDeRango(fechaIso, desde, hasta) {
  const f = new Date(fechaIso).getTime();
  if (desde && f < new Date(desde + "T00:00:00").getTime()) return false;
  if (hasta && f > new Date(hasta + "T23:59:59").getTime()) return false;
  return true;
}

export default function Reportes() {
  const { ventas, productos } = useData();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vista, setVista] = useState("mesero");

  const ventasFiltradas = useMemo(
    () => ventas.filter((v) => dentroDeRango(v.fecha, desde, hasta)),
    [ventas, desde, hasta]
  );

  const porMesero = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((v) => {
      if (!mapa[v.mesero]) mapa[v.mesero] = { mesero: v.mesero, ventas: 0, total: 0 };
      mapa[v.mesero].ventas += 1;
      mapa[v.mesero].total += v.total;
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [ventasFiltradas]);

  const porProducto = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((v) => {
      if (!mapa[v.producto]) mapa[v.producto] = { producto: v.producto, cantidad: 0, total: 0 };
      mapa[v.producto].cantidad += v.cantidad;
      mapa[v.producto].total += v.total;
    });
    return Object.values(mapa).sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasFiltradas]);

  const saldos = useMemo(() => {
    const totalQr = ventasFiltradas.reduce((s, v) => s + (v.montoQr || 0), 0);
    const totalEfectivo = ventasFiltradas.reduce((s, v) => s + (v.montoEfectivo || 0), 0);
    return { totalQr, totalEfectivo, totalGeneral: totalQr + totalEfectivo };
  }, [ventasFiltradas]);

  // Cuánto dinero hay parado en mercadería: por producto y por ubicación (almacén,
  // Interior, Semicubierto), a precio de venta actual de cada producto.
  const inventarioPorBarra = useMemo(() => {
    const filas = productos.map((p) => {
      const precio = Number(p.precio) || 0;
      const stockAlmacen = p.stock ?? 0;
      const stockInterior = p.stockInterior ?? 0;
      const stockSemicubierto = p.stockSemicubierto ?? 0;
      return {
        producto: p.nombre,
        almacen: stockAlmacen,
        interior: stockInterior,
        semicubierto: stockSemicubierto,
        valorAlmacen: stockAlmacen * precio,
        valorInterior: stockInterior * precio,
        valorSemicubierto: stockSemicubierto * precio,
        valorTotal: (stockAlmacen + stockInterior + stockSemicubierto) * precio,
      };
    });
    const totales = filas.reduce(
      (acc, f) => ({
        almacen: acc.almacen + f.valorAlmacen,
        interior: acc.interior + f.valorInterior,
        semicubierto: acc.semicubierto + f.valorSemicubierto,
        total: acc.total + f.valorTotal,
      }),
      { almacen: 0, interior: 0, semicubierto: 0, total: 0 }
    );
    return { filas: filas.sort((a, b) => b.valorTotal - a.valorTotal), totales };
  }, [productos]);

  const configuraciones = {
    mesero: {
      titulo: "Por mesero",
      columnas: [
        { titulo: "Mesero", clave: "mesero" },
        { titulo: "N° ventas", clave: "ventas" },
        { titulo: "Total Bs", clave: "total" },
      ],
      filas: porMesero,
    },
    producto: {
      titulo: "Por producto",
      columnas: [
        { titulo: "Producto", clave: "producto" },
        { titulo: "Cantidad", clave: "cantidad" },
        { titulo: "Total Bs", clave: "total" },
      ],
      filas: porProducto,
    },
  };

  const actual = configuraciones[vista];

  function exportarCSV() {
    const filas = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
    }));
    descargarCSV(`reporte-${vista}`, actual.columnas, filas);
  }

  function exportarPDF() {
    const filas = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
    }));
    descargarPDF(actual.titulo, actual.columnas, filas, `reporte-${vista}`);
  }

  const columnasInventario = [
    { titulo: "Producto", clave: "producto" },
    { titulo: "Almacén", clave: "almacen" },
    { titulo: "Interior", clave: "interior" },
    { titulo: "Semicubierto", clave: "semicubierto" },
    { titulo: "Valor total Bs", clave: "valorTotal" },
  ];

  function exportarInventarioCSV() {
    const filas = inventarioPorBarra.filas.map((f) => ({ ...f, valorTotal: f.valorTotal.toFixed(2) }));
    descargarCSV("reporte-inventario-barras", columnasInventario, filas);
  }

  function exportarInventarioPDF() {
    const filas = inventarioPorBarra.filas.map((f) => ({ ...f, valorTotal: f.valorTotal.toFixed(2) }));
    descargarPDF("Inventario y barras", columnasInventario, filas, "reporte-inventario-barras");
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Reportes</h1>
        <p>Filtra por fecha y descarga en CSV o PDF.</p>
      </header>

      <div className="formulario__fila">
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Saldo efectivo</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalEfectivo.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Saldo QR</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalQr.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Saldo total</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalGeneral.toFixed(2)}</span>
        </div>
      </div>

      <div className="pestañas">
        <button
          className={`pestañas__item ${vista === "mesero" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("mesero")}
        >
          Por mesero
        </button>
        <button
          className={`pestañas__item ${vista === "producto" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("producto")}
        >
          Por producto
        </button>
        <button
          className={`pestañas__item ${vista === "inventario" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("inventario")}
        >
          Inventario y barras
        </button>
      </div>

      {vista === "inventario" ? (
        <>
          <div className="tarjetas-resumen">
            <div className="tarjeta-metrica">
              <span className="tarjeta-metrica__etiqueta">Almacén general</span>
              <span className="tarjeta-metrica__valor">Bs {inventarioPorBarra.totales.almacen.toFixed(2)}</span>
            </div>
            <div className="tarjeta-metrica">
              <span className="tarjeta-metrica__etiqueta">Interior</span>
              <span className="tarjeta-metrica__valor">Bs {inventarioPorBarra.totales.interior.toFixed(2)}</span>
            </div>
            <div className="tarjeta-metrica">
              <span className="tarjeta-metrica__etiqueta">Semicubierto</span>
              <span className="tarjeta-metrica__valor">Bs {inventarioPorBarra.totales.semicubierto.toFixed(2)}</span>
            </div>
            <div className="tarjeta-metrica tarjeta-metrica--destacada">
              <span className="tarjeta-metrica__etiqueta">Valor total del inventario</span>
              <span className="tarjeta-metrica__valor">Bs {inventarioPorBarra.totales.total.toFixed(2)}</span>
            </div>
          </div>

          <section className="lista-reciente">
            {inventarioPorBarra.filas.length === 0 ? (
              <p className="texto-vacio">Todavía no hay productos cargados.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Almacén</th>
                    <th>Interior</th>
                    <th>Semicubierto</th>
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioPorBarra.filas.map((f, i) => (
                    <tr key={i}>
                      <td>{f.producto}</td>
                      <td>{f.almacen}</td>
                      <td>{f.interior}</td>
                      <td>{f.semicubierto}</td>
                      <td>Bs {f.valorTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="formulario__acciones">
            <button
              className="boton boton--primario"
              onClick={exportarInventarioCSV}
              disabled={inventarioPorBarra.filas.length === 0}
            >
              Descargar CSV
            </button>
            <button
              className="boton boton--fantasma"
              onClick={exportarInventarioPDF}
              disabled={inventarioPorBarra.filas.length === 0}
            >
              Descargar PDF
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="lista-reciente">
            {actual.filas.length === 0 ? (
              <p className="texto-vacio">No hay datos para este filtro.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    {actual.columnas.map((c) => (
                      <th key={c.clave}>{c.titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actual.filas.map((fila, i) => (
                    <tr key={i}>
                      {actual.columnas.map((c) => (
                        <td key={c.clave}>
                          {c.clave === "total" ? `Bs ${fila[c.clave].toFixed(2)}` : fila[c.clave]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="formulario__acciones">
            <button className="boton boton--primario" onClick={exportarCSV} disabled={actual.filas.length === 0}>
              Descargar CSV
            </button>
            <button className="boton boton--fantasma" onClick={exportarPDF} disabled={actual.filas.length === 0}>
              Descargar PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}