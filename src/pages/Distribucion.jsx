import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";

const BARRAS = [
  { valor: "interior", etiqueta: "Interior" },
  { valor: "semicubierto", etiqueta: "Semicubierto" },
];

const ACCIONES = [
  { valor: "ingreso", etiqueta: "Ingreso" },
  { valor: "traspaso", etiqueta: "Traspaso" },
  { valor: "baja", etiqueta: "Baja" },
];

function campoBarra(barra) {
  return barra === "interior" ? "stockInterior" : "stockSemicubierto";
}

function otraBarra(barra) {
  return barra === "interior" ? "semicubierto" : "interior";
}

function etiquetaBarra(barra) {
  return barra === "interior" ? "Interior" : "Semicubierto";
}

export default function Distribucion() {
  const { productos, movimientosBarra, registrarMovimientoBarra } = useData();

  const [barraActiva, setBarraActiva] = useState("interior");
  const [accionActiva, setAccionActiva] = useState("ingreso");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const campoActivo = campoBarra(barraActiva);

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
        productoId: productoSel.id,
        cantidad: cant,
        motivo: motivo.trim(),
      });
      setMensaje(
        accionActiva === "ingreso"
          ? `Se pasaron ${cant} unidad(es) de "${productoSel.nombre}" del almacén a ${etiquetaBarra(barraActiva)}.`
          : accionActiva === "traspaso"
          ? `Se traspasaron ${cant} unidad(es) de "${productoSel.nombre}" de ${etiquetaBarra(barraActiva)} a ${etiquetaBarra(otraBarra(barraActiva))}.`
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
    () => movimientosBarra.filter((m) => m.barra === barraActiva),
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
                  <td>{p.stock ?? 0}</td>
                  <td>{p[campoActivo] ?? 0}</td>
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
          {accionActiva === "traspaso" && `Pasa botellas de ${etiquetaBarra(barraActiva)} a ${etiquetaBarra(otraBarra(barraActiva))}.`}
          {accionActiva === "baja" && `Descuenta botellas de ${etiquetaBarra(barraActiva)} (rotura, derrame, etc.).`}
        </p>

        <div className="formulario__fila">
          <label>
            Producto
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
              <option value="">Selecciona un producto…</option>
              {productosDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — disponible: {accionActiva === "ingreso" ? p.stock ?? 0 : p[campoActivo] ?? 0}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cantidad
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Ej: 15"
              required
            />
          </label>
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
                    {m.tipo === "traspaso" && `Hacia ${etiquetaBarra(m.destino)}`}
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