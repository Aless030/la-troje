import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";

function fechaHoyISO() {
  return new Date().toISOString();
}

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

const VACIO = {
  mesero: "",
  productoId: "",
  cantidad: 1,
  formaPago: "efectivo",
  montoQr: "",
  montoEfectivo: "",
  observaciones: "",
};

export default function Ventas() {
  const { productos, ventas, registrarVenta } = useData();
  const [form, setForm] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const productoSel = productos.find((p) => p.id === form.productoId);
  const precioUnitario = productoSel?.precio || 0;
  const total = precioUnitario * (Number(form.cantidad) || 0);

  const meserosPrevios = useMemo(() => {
    const nombres = new Set(ventas.map((v) => v.mesero).filter(Boolean));
    return Array.from(nombres);
  }, [ventas]);

  const ventasHoy = useMemo(
    () => ventas.filter((v) => esHoy(v.fecha)).slice(0, 12),
    [ventas]
  );

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");

    if (!form.mesero.trim()) return setError("Escribe el nombre del mesero.");
    if (!productoSel) return setError("Selecciona un producto.");
    if (!form.cantidad || Number(form.cantidad) <= 0)
      return setError("La cantidad debe ser mayor a 0.");
    if ((productoSel.stock ?? 0) < Number(form.cantidad))
      return setError(`Solo hay ${productoSel.stock ?? 0} unidades de "${productoSel.nombre}" en inventario.`);

    let montoQr = 0;
    let montoEfectivo = 0;
    if (form.formaPago === "qr") montoQr = total;
    if (form.formaPago === "efectivo") montoEfectivo = total;
    if (form.formaPago === "ambos") {
      montoQr = Number(form.montoQr) || 0;
      montoEfectivo = Number(form.montoEfectivo) || 0;
      if (Math.abs(montoQr + montoEfectivo - total) > 0.01) {
        return setError(
          `La suma de QR (Bs ${montoQr.toFixed(2)}) + efectivo (Bs ${montoEfectivo.toFixed(2)}) debe ser igual al total (Bs ${total.toFixed(2)}).`
        );
      }
    }

    setEnviando(true);
    try {
      await registrarVenta({
        fecha: fechaHoyISO(),
        mesero: form.mesero.trim(),
        productoId: productoSel.id,
        producto: productoSel.nombre,
        cantidad: Number(form.cantidad),
        precioUnitario,
        total,
        formaPago: form.formaPago,
        montoQr,
        montoEfectivo,
        observaciones: form.observaciones.trim(),
      });
      setForm({ ...VACIO, mesero: form.mesero });
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar la venta. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Venta</h1>
        <p>{new Date().toLocaleString("es-BO", { dateStyle: "full", timeStyle: "short" })}</p>
      </header>

      <form className="formulario" onSubmit={enviar}>
        <div className="formulario__fila">
          <label>
            Fecha y hora
            <input type="text" value={new Date().toLocaleString("es-BO")} disabled />
          </label>
          <label>
            Nombre del mesero
            <input
              list="meseros-lista"
              value={form.mesero}
              onChange={(e) => actualizar("mesero", e.target.value)}
              placeholder="Ej: Carla"
              required
            />
            <datalist id="meseros-lista">
              {meserosPrevios.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="formulario__fila">
          <label>
            Producto
            <select
              value={form.productoId}
              onChange={(e) => actualizar("productoId", e.target.value)}
              required
            >
              <option value="">Selecciona un producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id} disabled={(p.stock ?? 0) <= 0}>
                  {p.nombre} {(p.stock ?? 0) <= 0 ? "(sin stock)" : `— stock: ${p.stock ?? 0}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Precio (automático)
            <input type="text" value={precioUnitario ? `Bs ${precioUnitario.toFixed(2)}` : "—"} disabled />
          </label>
          <label>
            Cantidad
            <input
              type="number"
              min="1"
              value={form.cantidad}
              onChange={(e) => actualizar("cantidad", e.target.value)}
              required
            />
          </label>
        </div>

        <div className="formulario__total">Total: Bs {total.toFixed(2)}</div>

        <div className="formulario__fila">
          <label>
            Forma de pago
            <select
              value={form.formaPago}
              onChange={(e) => actualizar("formaPago", e.target.value)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
              <option value="ambos">Ambos</option>
            </select>
          </label>
          {form.formaPago === "ambos" && (
            <>
              <label>
                Monto QR
                <input
                  type="number"
                  step="0.01"
                  value={form.montoQr}
                  onChange={(e) => actualizar("montoQr", e.target.value)}
                />
              </label>
              <label>
                Monto efectivo
                <input
                  type="number"
                  step="0.01"
                  value={form.montoEfectivo}
                  onChange={(e) => actualizar("montoEfectivo", e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        <label>
          Observaciones
          <textarea
            rows={2}
            value={form.observaciones}
            onChange={(e) => actualizar("observaciones", e.target.value)}
            placeholder="Ej: mesa 4, sin cebolla, cliente frecuente…"
          />
        </label>

        {error && <div className="formulario__error">{error}</div>}

        <button type="submit" className="boton boton--primario" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar venta"}
        </button>
      </form>

      <section className="lista-reciente">
        <h2>Ventas de hoy</h2>
        {ventasHoy.length === 0 ? (
          <p className="texto-vacio">Todavía no hay ventas registradas hoy.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Mesero</th>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Total</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {ventasHoy.map((v) => (
                <tr key={v.id}>
                  <td>{new Date(v.fecha).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{v.mesero}</td>
                  <td>{v.producto}</td>
                  <td>{v.cantidad}</td>
                  <td>Bs {Number(v.total).toFixed(2)}</td>
                  <td className="tabla__etiqueta">{v.formaPago}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
