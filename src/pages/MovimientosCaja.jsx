import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { descargarCSV } from "../utils/csv";

const TIPOS = [
  { valor: "sueldo", etiqueta: "Sueldo" },
  { valor: "proveedor", etiqueta: "Proveedor" },
  { valor: "factura", etiqueta: "Factura" },
  { valor: "otro", etiqueta: "Otro" },
  { valor: "ingreso", etiqueta: "Ingreso" },
];

const PLURAL = { sueldo: "Sueldos", proveedor: "Proveedores", factura: "Facturas", otro: "Otros", ingreso: "Ingresos" };

// Un proveedor en "deuda" todavía no salió de caja; en "pagado" sí. Los registros
// viejos de proveedor (sin estado) se consideran pagados.
const estadoDe = (m) => (m.tipo === "proveedor" ? m.estado || "pagado" : null);

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nuevoForm = () => ({ tipo: "sueldo", fecha: hoyLocal(), descripcion: "", numeroFactura: "", monto: "", estado: "deuda" });

// Si la fecha elegida es hoy se guarda con la hora actual; si es otro día, al mediodía.
const fechaAISO = (yyyyMmDd) => {
  if (!yyyyMmDd || yyyyMmDd === hoyLocal()) return new Date().toISOString();
  return new Date(`${yyyyMmDd}T12:00:00`).toISOString();
};

const fmtFecha = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return { dia: "—", hora: "" };
  return {
    dia: d.toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" }),
    hora: d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }),
  };
};

const bs = (n) => `Bs ${Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MovimientosCaja() {
  const { movimientos, registrarMovimiento, actualizarMovimiento, ventas, gastos, gastosCaja } = useData();
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [form, setForm] = useState(nuevoForm);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!form.descripcion.trim()) return setError("Describe el movimiento (a quién o qué se paga).");
    if (!form.monto || Number(form.monto) <= 0) return setError("Ingresa un monto válido.");

    setEnviando(true);
    try {
      await registrarMovimiento({
        fecha: fechaAISO(form.fecha),
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        numeroFactura: form.numeroFactura.trim(),
        monto: Number(form.monto),
        ...(form.tipo === "proveedor" ? { estado: form.estado } : {}),
      });
      setForm(nuevoForm());
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el movimiento.");
    } finally {
      setEnviando(false);
    }
  }

  // porTipo: monto de cada tipo (proveedor solo cuenta lo ya pagado).
  // deuda: lo que se debe a proveedores. total: salidas reales (sin ingresos ni deudas).
  const totales = useMemo(() => {
    const porTipo = { sueldo: 0, proveedor: 0, factura: 0, otro: 0, ingreso: 0 };
    let deuda = 0;
    movimientos.forEach((m) => {
      const monto = Number(m.monto || 0);
      if (estadoDe(m) === "deuda") deuda += monto;
      else porTipo[m.tipo] = (porTipo[m.tipo] || 0) + monto;
    });
    const total = porTipo.sueldo + porTipo.proveedor + porTipo.factura + porTipo.otro;
    return { porTipo, total, deuda, ingresos: porTipo.ingreso };
  }, [movimientos]);

  async function cambiarEstado(m, estado) {
    try {
      await actualizarMovimiento(m.id, { estado, pagadoEn: estado === "pagado" ? new Date().toISOString() : null });
    } catch (err) {
      console.error(err);
      window.alert("No se pudo cambiar el estado.");
    }
  }

  // Más recientes primero; se puede filtrar por tipo y buscar por texto.
  const movimientosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return [...movimientos]
      .filter((m) => filtroTipo === "todos" || m.tipo === filtroTipo)
      .filter((m) =>
        !q ||
        [m.descripcion, m.numeroFactura, m.tipo, estadoDe(m), String(m.monto)]
          .filter(Boolean)
          .some((c) => String(c).toLowerCase().includes(q))
      )
      .sort((a, b) => (new Date(b.fecha).getTime() || 0) - (new Date(a.fecha).getTime() || 0));
  }, [movimientos, busqueda, filtroTipo]);

  // Todo lo vendido (de cualquier evento, sin anuladas ni cortesías) menos todas las salidas:
  // movimientos (sueldos, proveedores, facturas), gastos semanales y gastos de caja.
  const resumen = useMemo(() => {
    const suma = (lista, campo) => lista.reduce((a, x) => a + Number(x[campo] || 0), 0);
    const ventasTotales = suma(ventas, "total");
    const ventasQr = suma(ventas, "montoQr");
    const ventasEfectivo = suma(ventas, "montoEfectivo");
    const movs = totales.total;
    const gastosSemanales = suma(gastos, "monto");
    const gastosDeCaja = suma(gastosCaja, "monto");
    const ingresosExtra = totales.ingresos;
    const salidas = movs + gastosSemanales + gastosDeCaja;
    const entradas = ventasTotales + ingresosExtra;
    return { ventasTotales, ventasQr, ventasEfectivo, movs, ingresosExtra, gastosSemanales, gastosDeCaja, entradas, salidas, saldo: entradas - salidas };
  }, [ventas, gastos, gastosCaja, totales]);

  function exportarCSV() {
    descargarCSV(
      "movimientos-caja",
      [
        { titulo: "Fecha", clave: "fechaTexto" },
        { titulo: "Hora", clave: "horaTexto" },
        { titulo: "Tipo", clave: "tipo" },
        { titulo: "Descripción", clave: "descripcion" },
        { titulo: "N° Factura", clave: "numeroFactura" },
        { titulo: "Monto", clave: "monto" },
        { titulo: "Estado", clave: "estadoTexto" },
      ],
      movimientosFiltrados.map((m) => ({
        ...m,
        fechaTexto: fmtFecha(m.fecha).dia,
        horaTexto: fmtFecha(m.fecha).hora,
        monto: Number(m.monto).toFixed(2),
        estadoTexto: estadoDe(m) || "",
      }))
    );
  }

  const fila = (etiqueta, valor, extra = "") => (
    <div className={`mov-fila ${extra}`}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Movimientos de caja</h1>
        <p>Lo que entró, lo que salió y lo que queda en caja.</p>
      </header>

      <section className="mov-balance">
        <div className="mov-balance__col mov-balance__col--entra">
          <h2>Ingresos</h2>
          {fila("Ventas en efectivo", bs(resumen.ventasEfectivo))}
          {fila("Ventas por QR", bs(resumen.ventasQr))}
          {resumen.ingresosExtra > 0 && fila("Otros ingresos registrados", bs(resumen.ingresosExtra))}
          {fila("Total ingresos", bs(resumen.entradas), "mov-fila--total")}
        </div>
        <div className="mov-balance__signo">−</div>
        <div className="mov-balance__col mov-balance__col--sale">
          <h2>Salidas</h2>
          {fila("Sueldos, proveedores y facturas pagados", bs(resumen.movs))}
          {fila("Gastos semanales", bs(resumen.gastosSemanales))}
          {fila("Gastos de caja", bs(resumen.gastosDeCaja))}
          {fila("Total salidas", bs(resumen.salidas), "mov-fila--total")}
        </div>
        <div className="mov-balance__signo">=</div>
        <div className={`mov-balance__saldo ${resumen.saldo < 0 ? "mov-balance__saldo--negativo" : ""}`}>
          <span>Saldo en caja</span>
          <strong>{bs(resumen.saldo)}</strong>
          <small>Ingresos − salidas</small>
          {totales.deuda > 0 && (
            <em>Deuda pendiente con proveedores: {bs(totales.deuda)} (aún no resta)</em>
          )}
        </div>
      </section>

      <form className="formulario" onSubmit={enviar}>
        <h2>Registrar movimiento</h2>
        <div className="formulario__fila">
          <label>
            Tipo
            <select value={form.tipo} onChange={(e) => actualizar("tipo", e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input
              type="date"
              value={form.fecha}
              max={hoyLocal()}
              onChange={(e) => actualizar("fecha", e.target.value)}
              required
            />
          </label>
          <label>
            Descripción
            <input
              value={form.descripcion}
              onChange={(e) => actualizar("descripcion", e.target.value)}
              placeholder="Ej: Sueldo mesero Juan, Proveedor de verduras…"
              required
            />
          </label>
        </div>
        {form.tipo === "proveedor" && (
          <div className="formulario__fila">
            <label>
              Estado
              <select value={form.estado} onChange={(e) => actualizar("estado", e.target.value)}>
                <option value="deuda">Deuda (aún no se paga)</option>
                <option value="pagado">Ya pagado</option>
              </select>
            </label>
          </div>
        )}
        <div className="formulario__fila">
          <label>
            N° de factura (opcional)
            <input
              value={form.numeroFactura}
              onChange={(e) => actualizar("numeroFactura", e.target.value)}
              placeholder="Ej: 00123"
            />
          </label>
          <label>
            Monto (Bs)
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.monto}
              onChange={(e) => actualizar("monto", e.target.value)}
              required
            />
          </label>
        </div>
        {error && <div className="formulario__error">{error}</div>}
        <button type="submit" className="boton boton--primario" disabled={enviando}>
          {enviando ? "Guardando…" : "Registrar movimiento"}
        </button>
      </form>

      <div className="tarjetas-resumen">
        {TIPOS.map((t) => (
          <div className="tarjeta-metrica" key={t.valor}>
            <span className="tarjeta-metrica__etiqueta">{PLURAL[t.valor]}{t.valor === "proveedor" ? " (pagados)" : ""}</span>
            <span className="tarjeta-metrica__valor">{bs(totales.porTipo[t.valor])}</span>
          </div>
        ))}
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Deuda con proveedores</span>
          <span className="tarjeta-metrica__valor">{bs(totales.deuda)}</span>
        </div>
      </div>

      <section className="lista-reciente">
        <h2>Historial</h2>
        <div className="mov-filtros">
          <input
            type="search"
            className="buscador__input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por factura, descripción, tipo, estado o monto…"
          />
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>{PLURAL[t.valor]}</option>
            ))}
          </select>
        </div>
        {movimientos.length === 0 ? (
          <p className="texto-vacio">Todavía no hay movimientos registrados.</p>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>N° Factura</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((m) => {
                  const f = fmtFecha(m.fecha);
                  const esIngreso = m.tipo === "ingreso";
                  return (
                    <tr key={m.id}>
                      <td className="mov-fecha">
                        <strong>{f.dia}</strong>
                        <span>{f.hora}</span>
                      </td>
                      <td><span className={`mov-chip mov-chip--${m.tipo}`}>{m.tipo}</span></td>
                      <td>{m.descripcion}</td>
                      <td>{m.numeroFactura || "—"}</td>
                      <td className={`mov-monto ${esIngreso ? "mov-monto--entra" : "mov-monto--sale"}`}>
                        {esIngreso ? "+" : "−"} {bs(m.monto)}
                      </td>
                      <td>
                        {m.tipo === "proveedor" ? (
                          <select
                            className={`mov-estado mov-estado--${estadoDe(m)}`}
                            value={estadoDe(m)}
                            onChange={(e) => cambiarEstado(m, e.target.value)}
                          >
                            <option value="deuda">Deuda</option>
                            <option value="pagado">Ya pagado</option>
                          </select>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {movimientos.length > 0 && movimientosFiltrados.length === 0 && (
          <p className="texto-vacio">Ningún movimiento coincide con la búsqueda.</p>
        )}
        <button className="boton boton--fantasma" onClick={exportarCSV} disabled={movimientosFiltrados.length === 0}>
          Descargar CSV
        </button>
      </section>
    </div>
  );
}