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

const VACIO = { tipo: "sueldo", descripcion: "", numeroFactura: "", monto: "", estado: "deuda" };

export default function MovimientosCaja() {
  const { movimientos, registrarMovimiento, actualizarMovimiento, ventas, gastos, gastosCaja } = useData();
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState(VACIO);
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
        fecha: new Date().toISOString(),
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        numeroFactura: form.numeroFactura.trim(),
        monto: Number(form.monto),
        ...(form.tipo === "proveedor" ? { estado: form.estado } : {}),
      });
      setForm(VACIO);
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

  const movimientosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return movimientos;
    return movimientos.filter((m) =>
      [m.descripcion, m.numeroFactura, m.tipo, estadoDe(m), String(m.monto)]
        .filter(Boolean)
        .some((c) => String(c).toLowerCase().includes(q))
    );
  }, [movimientos, busqueda]);

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
    return { ventasTotales, ventasQr, ventasEfectivo, movs, ingresosExtra, gastosSemanales, gastosDeCaja, salidas, saldo: ventasTotales + ingresosExtra - salidas };
  }, [ventas, gastos, gastosCaja, totales]);

  function exportarCSV() {
    descargarCSV(
      "movimientos-caja",
      [
        { titulo: "Fecha", clave: "fechaTexto" },
        { titulo: "Tipo", clave: "tipo" },
        { titulo: "Descripción", clave: "descripcion" },
        { titulo: "N° Factura", clave: "numeroFactura" },
        { titulo: "Monto", clave: "monto" },
        { titulo: "Estado", clave: "estadoTexto" },
      ],
      movimientos.map((m) => ({
        ...m,
        fechaTexto: new Date(m.fecha).toLocaleDateString("es-BO"),
        monto: Number(m.monto).toFixed(2),
        estadoTexto: estadoDe(m) || "",
      }))
    );
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Movimientos de caja</h1>
        <p>Ventas totales generadas y, de ahí, lo que se paga: sueldos, proveedores y facturas.</p>
      </header>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ventas totales (todos los eventos)</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.ventasTotales.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Efectivo</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.ventasEfectivo.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">QR</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.ventasQr.toFixed(2)}</span>
        </div>
        {resumen.ingresosExtra > 0 && (
          <div className="tarjeta-metrica">
            <span className="tarjeta-metrica__etiqueta">+ Ingresos registrados</span>
            <span className="tarjeta-metrica__valor">Bs {resumen.ingresosExtra.toFixed(2)}</span>
          </div>
        )}
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">− Movimientos pagados (sueldos, proveedores…)</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.movs.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">− Gastos semanales</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.gastosSemanales.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">− Gastos de caja</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.gastosDeCaja.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Saldo disponible (deudas pendientes no restan)</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.saldo.toFixed(2)}</span>
        </div>
      </div>

      <form className="formulario" onSubmit={enviar}>
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
            <span className="tarjeta-metrica__valor">Bs {(totales.porTipo[t.valor] || 0).toFixed(2)}</span>
          </div>
        ))}
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Total salidas</span>
          <span className="tarjeta-metrica__valor">Bs {totales.total.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Deuda con proveedores</span>
          <span className="tarjeta-metrica__valor">Bs {totales.deuda.toFixed(2)}</span>
        </div>
      </div>

      <section className="lista-reciente">
        <h2>Historial</h2>
        <input
          type="search"
          className="buscador__input"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por factura, descripción, tipo, estado o monto…"
          style={{ width: "100%", marginBottom: "0.75rem" }}
        />
        {movimientos.length === 0 ? (
          <p className="texto-vacio">Todavía no hay movimientos registrados.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>N° Factura</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.fecha).toLocaleDateString("es-BO")}</td>
                  <td className="tabla__etiqueta">{m.tipo}</td>
                  <td>{m.descripcion}</td>
                  <td>{m.numeroFactura || "—"}</td>
                  <td>{m.tipo === "ingreso" ? "+ " : ""}Bs {Number(m.monto).toFixed(2)}</td>
                  <td>
                    {m.tipo === "proveedor" ? (
                      <select value={estadoDe(m)} onChange={(e) => cambiarEstado(m, e.target.value)}>
                        <option value="deuda">Deuda</option>
                        <option value="pagado">Ya pagado</option>
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {movimientos.length > 0 && movimientosFiltrados.length === 0 && (
          <p className="texto-vacio">Ningún movimiento coincide con la búsqueda.</p>
        )}
        <button className="boton boton--fantasma" onClick={exportarCSV} disabled={movimientos.length === 0}>
          Descargar CSV
        </button>
      </section>
    </div>
  );
}