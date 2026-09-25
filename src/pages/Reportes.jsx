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
  const { ventas, productos, ajustesInventario, registrarAjusteInventario, eliminarAjusteInventario } = useData();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vista, setVista] = useState("mesero");

  // Estado local del formulario de ajuste de inventario: apertura y saldo real
  // contado, por producto. Se llenan a mano antes de guardar el ajuste.
  const [aperturas, setAperturas] = useState({});
  const [saldosAjuste, setSaldosAjuste] = useState({});
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [mensajeAjuste, setMensajeAjuste] = useState("");

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

  // Reporte de comandas: el detalle de cada línea vendida, como en la planilla
  // de comandas (N°, fecha, mesero, producto, unidad, monto, forma de pago, total).
  const comandas = useMemo(() => {
    const ordenadas = [...ventasFiltradas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return ordenadas.map((v, i) => ({
      n: i + 1,
      fecha: new Date(v.fecha).toLocaleDateString("es-BO"),
      mesero: v.mesero || "—",
      producto: v.producto,
      unidad: v.unidad || "—",
      cantidad: v.cantidad,
      monto: v.precioUnitario,
      formaPago: v.formaPago,
      total: v.total,
    }));
  }, [ventasFiltradas]);

  // Venta total por producto en el rango filtrado, para el ajuste de inventario.
  const ventaPorProducto = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((v) => {
      mapa[v.productoId] = (mapa[v.productoId] || 0) + v.cantidad;
    });
    return mapa;
  }, [ventasFiltradas]);

  const filasAjuste = useMemo(() => {
    return productos.map((p) => {
      const apertura = aperturas[p.id] !== undefined ? Number(aperturas[p.id]) || 0 : Number(p.stock) || 0;
      const venta = ventaPorProducto[p.id] || 0;
      const final = apertura - venta;
      const saldo = saldosAjuste[p.id] !== undefined && saldosAjuste[p.id] !== "" ? Number(saldosAjuste[p.id]) : final;
      const diferencia = final - saldo;
      return {
        productoId: p.id,
        producto: p.nombre,
        unidad: p.unidadVenta || "Botella",
        monto: p.precioVenta ?? p.precio ?? 0,
        apertura,
        venta,
        final,
        saldo,
        diferencia,
      };
    });
  }, [productos, aperturas, saldosAjuste, ventaPorProducto]);

  async function guardarAjusteInventario() {
    setGuardandoAjuste(true);
    setMensajeAjuste("");
    try {
      await Promise.all(
        filasAjuste.map((f) =>
          registrarAjusteInventario({
            fecha: new Date().toISOString(),
            desde: desde || null,
            hasta: hasta || null,
            productoId: f.productoId,
            producto: f.producto,
            unidad: f.unidad,
            monto: f.monto,
            apertura: f.apertura,
            venta: f.venta,
            final: f.final,
            saldo: f.saldo,
            diferencia: f.diferencia,
          })
        )
      );
      setMensajeAjuste("Ajuste de inventario guardado. Puedes revisarlo en el historial de abajo.");
    } catch (err) {
      console.error(err);
      setMensajeAjuste("No se pudo guardar el ajuste. Intenta de nuevo.");
    } finally {
      setGuardandoAjuste(false);
    }
  }

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
    comandas: {
      titulo: "Reporte de comandas",
      columnas: [
        { titulo: "N°", clave: "n" },
        { titulo: "Fecha", clave: "fecha" },
        { titulo: "Mesero", clave: "mesero" },
        { titulo: "Producto", clave: "producto" },
        { titulo: "Cantidad", clave: "cantidad" },
        { titulo: "Unidad", clave: "unidad" },
        { titulo: "Monto Bs", clave: "monto" },
        { titulo: "Forma de pago", clave: "formaPago" },
        { titulo: "Total Bs", clave: "total" },
      ],
      filas: comandas,
    },
  };

  const actual = configuraciones[vista];

  function exportarCSV() {
    const filas = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
      monto: f.monto?.toFixed ? f.monto.toFixed(2) : f.monto,
    }));
    descargarCSV(`reporte-${vista}`, actual.columnas, filas);
  }

  function exportarPDF() {
    const filas = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
      monto: f.monto?.toFixed ? f.monto.toFixed(2) : f.monto,
    }));
    descargarPDF(actual.titulo, actual.columnas, filas, `reporte-${vista}`);
  }

  function exportarAjusteCSV() {
    const columnas = [
      { titulo: "Producto", clave: "producto" },
      { titulo: "Unidad", clave: "unidad" },
      { titulo: "Monto Bs", clave: "monto" },
      { titulo: "Apertura", clave: "apertura" },
      { titulo: "Venta", clave: "venta" },
      { titulo: "Final", clave: "final" },
      { titulo: "Saldo", clave: "saldo" },
      { titulo: "Diferencia", clave: "diferencia" },
    ];
    const filas = filasAjuste.map((f) => ({
      ...f,
      monto: f.monto.toFixed(2),
      apertura: f.apertura.toFixed(2),
      venta: f.venta.toFixed(2),
      final: f.final.toFixed(2),
      saldo: f.saldo.toFixed(2),
      diferencia: f.diferencia.toFixed(2),
    }));
    descargarCSV("ajuste-inventario", columnas, filas);
  }

  function exportarAjustePDF() {
    const columnas = [
      { titulo: "Producto", clave: "producto" },
      { titulo: "Unidad", clave: "unidad" },
      { titulo: "Apertura", clave: "apertura" },
      { titulo: "Venta", clave: "venta" },
      { titulo: "Final", clave: "final" },
      { titulo: "Saldo", clave: "saldo" },
      { titulo: "Dif.", clave: "diferencia" },
    ];
    const filas = filasAjuste.map((f) => ({
      ...f,
      apertura: f.apertura.toFixed(2),
      venta: f.venta.toFixed(2),
      final: f.final.toFixed(2),
      saldo: f.saldo.toFixed(2),
      diferencia: f.diferencia.toFixed(2),
    }));
    descargarPDF("Ajuste de inventario", columnas, filas, "ajuste-inventario");
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
          className={`pestañas__item ${vista === "comandas" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("comandas")}
        >
          Comandas
        </button>
        <button
          className={`pestañas__item ${vista === "inventario" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("inventario")}
        >
          Inventario y barras
        </button>
        <button
          className={`pestañas__item ${vista === "ajuste" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("ajuste")}
        >
          Ajuste de inventario
        </button>
      </div>

      {vista === "ajuste" ? (
        <>
          <p className="texto-vacio">
            Ingresa la apertura (stock con el que empezó el evento) y, al final, el saldo real contado.
            "Final" se calcula solo (apertura − venta del rango filtrado); "Diferencia" es Final − Saldo,
            para detectar faltantes o sobrantes.
          </p>
          <section className="lista-reciente">
            {filasAjuste.length === 0 ? (
              <p className="texto-vacio">Todavía no hay productos cargados en inventario.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidad</th>
                    <th>Monto</th>
                    <th>Apertura</th>
                    <th>Venta</th>
                    <th>Final</th>
                    <th>Saldo real</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {filasAjuste.map((f) => (
                    <tr key={f.productoId} className={Math.abs(f.diferencia) > 0.01 ? "tabla__fila--alerta" : ""}>
                      <td>{f.producto}</td>
                      <td className="tabla__etiqueta">{f.unidad}</td>
                      <td>Bs {f.monto.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="celda-editable"
                          value={aperturas[f.productoId] ?? f.apertura}
                          onChange={(e) =>
                            setAperturas((a) => ({ ...a, [f.productoId]: e.target.value }))
                          }
                        />
                      </td>
                      <td>{f.venta}</td>
                      <td>{f.final.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="celda-editable"
                          value={saldosAjuste[f.productoId] ?? ""}
                          placeholder={f.final.toFixed(2)}
                          onChange={(e) => setSaldosAjuste((s) => ({ ...s, [f.productoId]: e.target.value }))}
                        />
                      </td>
                      <td>{f.diferencia.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="formulario__acciones">
            <button className="boton boton--primario" onClick={guardarAjusteInventario} disabled={guardandoAjuste}>
              {guardandoAjuste ? "Guardando…" : "Guardar ajuste de inventario"}
            </button>
            <button className="boton boton--fantasma" onClick={exportarAjusteCSV}>Descargar CSV</button>
            <button className="boton boton--fantasma" onClick={exportarAjustePDF}>Descargar PDF</button>
          </div>
          {mensajeAjuste && <div className="formulario__error formulario__error--exito">{mensajeAjuste}</div>}

          <section className="lista-reciente">
            <h2>Historial de ajustes guardados</h2>
            {ajustesInventario.length === 0 ? (
              <p className="texto-vacio">Todavía no hay ajustes guardados.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Apertura</th>
                    <th>Venta</th>
                    <th>Final</th>
                    <th>Saldo</th>
                    <th>Diferencia</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ajustesInventario.slice(0, 40).map((a) => (
                    <tr key={a.id} className={Math.abs(a.diferencia || 0) > 0.01 ? "tabla__fila--alerta" : ""}>
                      <td>{new Date(a.fecha).toLocaleString("es-BO")}</td>
                      <td>{a.producto}</td>
                      <td>{Number(a.apertura ?? 0).toFixed(2)}</td>
                      <td>{a.venta ?? 0}</td>
                      <td>{Number(a.final ?? 0).toFixed(2)}</td>
                      <td>{Number(a.saldo ?? 0).toFixed(2)}</td>
                      <td>{Number(a.diferencia ?? 0).toFixed(2)}</td>
                      <td>
                        <button
                          className="boton boton--enlace boton--peligro"
                          onClick={() => eliminarAjusteInventario(a.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : vista === "inventario" ? (
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
                        <td key={c.clave} className={c.clave === "formaPago" ? "tabla__etiqueta" : undefined}>
                          {c.clave === "total" || c.clave === "monto"
                            ? `Bs ${Number(fila[c.clave] || 0).toFixed(2)}`
                            : fila[c.clave]}
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