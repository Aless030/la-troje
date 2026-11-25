import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { BARRAS, campoBarra, etiquetaBarra } from "../utils/barras";
import SelectorProducto from "../components/SelectorProducto";
import { descargarChecklistPDF, descargarPDF } from "../utils/pdf";
import { descargarXLSX } from "../utils/xlsx";

const ACCIONES = [
  { valor: "ingreso", etiqueta: "Ingreso" },
  { valor: "traspaso", etiqueta: "Traspaso" },
  { valor: "baja", etiqueta: "Baja" },
];

function formatearStock(valor) {
  return Number(valor || 0).toFixed(2);
}

export default function Distribucion() {
  const { productos, movimientosBarra, registrarMovimientoBarra } = useData();

  const [barraActiva, setBarraActiva] = useState("interior");
  const [accionActiva, setAccionActiva] = useState("ingreso");
  // Barra a la que se traspasa (solo en "Traspaso"). Nunca es la misma que la de origen.
  const [destinoElegido, setDestinoElegido] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const campoActivo = campoBarra(barraActiva);

  // --- Descargas para imprimir / checklist físico ---
  const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const hoyTxt = () => new Date().toLocaleDateString("es-BO");
  const nombreBase = () => `distribucion-${new Date().toISOString().slice(0, 10)}`;

  // Una fila por producto con el stock de todas las ubicaciones y columnas en blanco para escribir.
  function filasChecklist() {
    return [...productosFiltrados]
      .sort((a, b) => (a.familia || "").localeCompare(b.familia || "", "es") || (a.nombre || "").localeCompare(b.nombre || "", "es"))
      .map((p) => {
        const fila = { marca: "", producto: p.nombre, familia: p.familia || "", almacen: redondear(p.stock) };
        let total = redondear(p.stock);
        BARRAS.forEach((b) => {
          fila[b.valor] = redondear(p[b.campo]);
          total += redondear(p[b.campo]);
        });
        fila.total = redondear(total);
        fila.pasar = "";
        fila.conteo = "";
        fila.obs = "";
        return fila;
      });
  }
  function columnasChecklist(paraPdf) {
    return [
      { titulo: paraPdf ? "OK" : "✓", clave: "marca", peso: 0.5, caja: true },
      { titulo: "Producto", clave: "producto", peso: 3.2 },
      { titulo: "Almacén", clave: "almacen", peso: 1 },
      ...BARRAS.map((b) => ({ titulo: b.etiqueta, clave: b.valor, peso: 1.35 })),
      { titulo: "Total", clave: "total", peso: 0.9 },
      { titulo: "Cantidad a pasar", clave: "pasar", peso: 1.6, blanco: true },
      { titulo: "Conteo físico", clave: "conteo", peso: 1.3, blanco: true },
      { titulo: "Observaciones", clave: "obs", peso: 2.2, blanco: true },
    ];
  }
  function descargarChecklist(formato) {
    const filas = filasChecklist();
    if (filas.length === 0) return;
    if (formato === "pdf") {
      descargarChecklistPDF({
        titulo: "Checklist de distribución",
        subtitulo: `Stock al ${hoyTxt()} — ${filas.length} productos`,
        columnas: columnasChecklist(true),
        filas,
        nombreArchivo: `checklist-${nombreBase()}`,
      });
    } else {
      descargarXLSX(
        `checklist-${nombreBase()}`,
        columnasChecklist(false).map((c) => ({ ...c, titulo: c.clave === "marca" ? "✓" : c.titulo })),
        filas.map((f) => ({ ...f, marca: "☐" })),
        "Checklist"
      );
    }
  }
  function filasHistorial() {
    return historial.map((m) => ({
      fecha: new Date(m.fecha).toLocaleDateString("es-BO"),
      accion: ACCIONES.find((a) => a.valor === m.tipo)?.etiqueta || m.tipo,
      producto: m.producto,
      cantidad: redondear(m.cantidad),
      detalle:
        m.tipo === "traspaso"
          ? m.destino === barraActiva && m.barra !== barraActiva
            ? `Desde ${etiquetaBarra(m.barra)}`
            : `Hacia ${etiquetaBarra(m.destino)}`
          : m.tipo === "baja"
          ? m.motivo || "—"
          : "Desde almacén",
    }));
  }
  const COLUMNAS_HISTORIAL = [
    { titulo: "Fecha", clave: "fecha" },
    { titulo: "Acción", clave: "accion" },
    { titulo: "Producto", clave: "producto" },
    { titulo: "Cantidad", clave: "cantidad" },
    { titulo: "Detalle", clave: "detalle" },
  ];
  const barrasDestino = BARRAS.filter((b) => b.valor !== barraActiva);
  const destino = barrasDestino.some((b) => b.valor === destinoElegido) ? destinoElegido : barrasDestino[0]?.valor;

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return productos;
    return productos.filter((p) => (p.nombre || "").toLowerCase().includes(texto));
  }, [productos, busqueda]);

  // Qué productos ofrecer en el desplegable, según la acción:
  // - ingreso: sale del almacén general, hace falta stock ahí.
  // - traspaso / baja: salen de la barra activa, hace falta stock en esa barra.
  const productosDisponibles = useMemo(() => {
    if (accionActiva === "ingreso") return productos.filter((p) => (p.stock || 0) > 0);
    return productos.filter((p) => (p[campoActivo] || 0) > 0);
  }, [productos, accionActiva, campoActivo]);

  const productoSel = productos.find((p) => p.id === productoId);
  const disponible = !productoSel
    ? 0
    : accionActiva === "ingreso"
    ? productoSel.stock || 0
    : productoSel[campoActivo] || 0;

  function cambiarBarra(barra) {
    setBarraActiva(barra);
    setProductoId("");
    setCantidad("");
    setMotivo("");
    setError("");
  }

  function cambiarAccion(accion) {
    setAccionActiva(accion);
    setProductoId("");
    setCantidad("");
    setMotivo("");
    setError("");
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    if (!productoSel) return setError("Selecciona un producto.");
    const cant = Number(cantidad);
    if (!cant || cant <= 0) return setError("Ingresa una cantidad válida.");
    if (cant > disponible) {
      return setError(
        accionActiva === "ingreso"
          ? `Solo hay ${disponible} en el almacén general.`
          : `Solo hay ${disponible} en ${etiquetaBarra(barraActiva)}.`
      );
    }

    setEnviando(true);
    try {
      await registrarMovimientoBarra({
        tipo: accionActiva,
        barra: barraActiva,
        destino: accionActiva === "traspaso" ? destino : undefined,
        productoId: productoSel.id,
        cantidad: cant,
        motivo: motivo.trim(),
      });
      setMensaje(
        accionActiva === "ingreso"
          ? `Se pasaron ${cant} unidad(es) de "${productoSel.nombre}" del almacén a ${etiquetaBarra(barraActiva)}.`
          : accionActiva === "traspaso"
          ? `Se traspasaron ${cant} unidad(es) de "${productoSel.nombre}" de ${etiquetaBarra(barraActiva)} a ${etiquetaBarra(destino)}.`
          : `Se dieron de baja ${cant} unidad(es) de "${productoSel.nombre}" en ${etiquetaBarra(barraActiva)}.`
      );
      setProductoId("");
      setCantidad("");
      setMotivo("");
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el movimiento. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  const historial = useMemo(
    () => movimientosBarra.filter((m) => m.barra === barraActiva || m.destino === barraActiva),
    [movimientosBarra, barraActiva]
  );

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Distribución</h1>
        <p>Reparte tus productos del almacén general a las barras, traspasa entre barras o da de baja lo que se pierde.</p>
      </header>

      <div className="pestañas">
        {BARRAS.map((b) => (
          <button
            key={b.valor}
            className={`pestañas__item ${barraActiva === b.valor ? "pestañas__item--activa" : ""}`}
            onClick={() => cambiarBarra(b.valor)}
          >
            {b.etiqueta}
          </button>
        ))}
      </div>

      <section className="lista-reciente">
        <h2>Almacén general</h2>
        <div className="formulario__acciones">
          <button type="button" className="boton" onClick={() => descargarChecklist("pdf")} disabled={productosFiltrados.length === 0}>
            Descargar checklist PDF (imprimir)
          </button>
          <button type="button" className="boton" onClick={() => descargarChecklist("xlsx")} disabled={productosFiltrados.length === 0}>
            Descargar checklist Excel
          </button>
        </div>
        <p className="texto-vacio">
          El checklist trae todos los productos con su stock en almacén y en las 3 barras, más casillas y columnas en blanco para escribir a mano. Si buscas un producto, solo baja los que se ven.
        </p>
        <div className="formulario__fila">
          <label>
            Buscar producto
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej: Flor de Caña, cerveza…"
            />
          </label>
        </div>
        {productosFiltrados.length === 0 ? (
          <p className="texto-vacio">
            {productos.length === 0 ? "Todavía no cargaste productos en Inventario." : "Ningún producto coincide con la búsqueda."}
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock almacén</th>
                <th>Stock {etiquetaBarra(barraActiva)}</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{formatearStock(p.stock)}</td>
                  <td>{formatearStock(p[campoActivo])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="pestañas">
        {ACCIONES.map((a) => (
          <button
            key={a.valor}
            className={`pestañas__item ${accionActiva === a.valor ? "pestañas__item--activa" : ""}`}
            onClick={() => cambiarAccion(a.valor)}
          >
            {a.etiqueta}
          </button>
        ))}
      </div>

      <form className="formulario" onSubmit={enviar}>
        <p className="texto-vacio">
          {accionActiva === "ingreso" && `Pasa botellas del almacén general a ${etiquetaBarra(barraActiva)}.`}
          {accionActiva === "traspaso" && `Pasa botellas de ${etiquetaBarra(barraActiva)} a ${etiquetaBarra(destino)}.`}
          {accionActiva === "baja" && `Descuenta botellas de ${etiquetaBarra(barraActiva)} (rotura, derrame, etc.).`}
        </p>

        <div className="formulario__fila">
          <SelectorProducto
            etiqueta="Producto (escribe para buscar)"
            value={productoId}
            onChange={setProductoId}
            opciones={productosDisponibles.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              detalle: `disponible: ${formatearStock(accionActiva === "ingreso" ? p.stock : p[campoActivo])}`,
            }))}
            placeholder={accionActiva === "ingreso" ? "Ej: fernet, paceña…" : `Productos con stock en ${etiquetaBarra(barraActiva)}…`}
            vacio={accionActiva === "ingreso" ? "Ningún producto con stock en almacén coincide." : `Ningún producto con stock en ${etiquetaBarra(barraActiva)} coincide.`}
          />
          <label>
            Cantidad
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Ej: 10.75"
              required
            />
          </label>
          {accionActiva === "traspaso" && (
            <label>
              Hacia
              <select value={destino} onChange={(e) => setDestinoElegido(e.target.value)}>
                {barrasDestino.map((b) => (
                  <option key={b.valor} value={b.valor}>{b.etiqueta}</option>
                ))}
              </select>
            </label>
          )}
          {accionActiva === "baja" && (
            <label>
              Motivo (opcional)
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: botella rota"
              />
            </label>
          )}
        </div>

        {error && <div className="formulario__error">{error}</div>}
        {mensaje && <div className="formulario__error formulario__error--exito">{mensaje}</div>}

        <button type="submit" className="boton boton--primario" disabled={enviando}>
          {enviando ? "Guardando…" : ACCIONES.find((a) => a.valor === accionActiva).etiqueta}
        </button>
      </form>

      <section className="lista-reciente">
        <h2>Historial en {etiquetaBarra(barraActiva)}</h2>
        {historial.length > 0 && (
          <div className="formulario__acciones">
            <button type="button" className="boton" onClick={() => descargarPDF(`Historial de distribución — ${etiquetaBarra(barraActiva)}`, COLUMNAS_HISTORIAL, filasHistorial(), `historial-distribucion-${barraActiva}-${new Date().toISOString().slice(0, 10)}`)}>
              Descargar PDF
            </button>
            <button type="button" className="boton" onClick={() => descargarXLSX(`historial-distribucion-${barraActiva}-${new Date().toISOString().slice(0, 10)}`, COLUMNAS_HISTORIAL, filasHistorial(), "Historial")}>
              Descargar Excel
            </button>
          </div>
        )}
        {historial.length === 0 ? (
          <p className="texto-vacio">Todavía no hay movimientos en esta barra.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.fecha).toLocaleDateString("es-BO")}</td>
                  <td className="tabla__etiqueta">{ACCIONES.find((a) => a.valor === m.tipo)?.etiqueta || m.tipo}</td>
                  <td>{m.producto}</td>
                  <td>{m.cantidad}</td>
                  <td>
                    {m.tipo === "traspaso" &&
                      (m.destino === barraActiva && m.barra !== barraActiva
                        ? `Desde ${etiquetaBarra(m.barra)}`
                        : `Hacia ${etiquetaBarra(m.destino)}`)}
                    {m.tipo === "baja" && (m.motivo || "—")}
                    {m.tipo === "ingreso" && "Desde almacén"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}