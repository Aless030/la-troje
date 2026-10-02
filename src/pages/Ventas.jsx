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

const BARRAS = [
  { valor: "interior", etiqueta: "Interior" },
  { valor: "semicubierto", etiqueta: "Semicubierto" },
];

function campoBarra(barra) {
  return barra === "interior" ? "stockInterior" : "stockSemicubierto";
}

const VACIO = {
  cajera: "",
  comanda: "",
  barra: "interior",
  mesero: "",
  productoId: "",
  cantidad: 1,
  formaPago: "efectivo",
  montoQr: "",
  montoEfectivo: "",
  observaciones: "",
  complemento: "",
};

export default function Ventas() {
  const {
    productos, ventas, aperturasCaja, gastosCaja,
    registrarVenta, registrarAperturaCaja, registrarGastoCaja
  } = useData();
  const [form, setForm] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [precioEditado, setPrecioEditado] = useState("");
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [aperturaForm, setAperturaForm] = useState({ cajera: "", cajaChica: "", barra: "interior", meseros: "" });
  const [gastoForm, setGastoForm] = useState({ concepto: "", monto: "", observaciones: "" });
  const [mensajeApertura, setMensajeApertura] = useState("");
  const [mensajeGasto, setMensajeGasto] = useState("");

  const campoActivo = campoBarra(form.barra);
  const productoSel = productos.find((p) => p.id === form.productoId);
  const stockDisponible = productoSel ? productoSel[campoActivo] || 0 : 0;
  const precioSugerido = productoSel ? (productoSel.precioVenta ?? productoSel.precio ?? 0) : 0;
  const precioUnitario = editandoPrecio && precioEditado !== "" ? Number(precioEditado) : precioSugerido;
  const total = precioUnitario * (Number(form.cantidad) || 0);

  const efectivoRecibido = form.formaPago === "efectivo" ? Number(form.montoEfectivo) || 0 : 0;
  const cambio = form.formaPago === "efectivo" && efectivoRecibido > 0 ? Math.max(0, efectivoRecibido - total) : 0;

  const meserosPrevios = useMemo(() => {
    const nombres = new Set(ventas.map((v) => v.mesero).filter(Boolean));
    return Array.from(nombres);
  }, [ventas]);

  const cajerasPrevias = useMemo(() => {
    const nombres = new Set(ventas.map((v) => v.cajera).filter(Boolean));
    return Array.from(nombres);
  }, [ventas]);

  const aperturaActiva = useMemo(
    () => aperturasCaja.find((a) => a.estado === "abierta" && esHoy(a.fecha)) || null,
    [aperturasCaja]
  );

  const cajerasAperturaPrevias = useMemo(() => {
    const nombres = new Set([
      ...cajerasPrevias,
      ...aperturasCaja.map((a) => a.cajera).filter(Boolean),
    ]);
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, "es"));
  }, [cajerasPrevias, aperturasCaja]);

  const meserosAperturaPrevios = useMemo(() => {
    const nombres = new Set(meserosPrevios);
    aperturasCaja.forEach((a) => {
      (a.meseros || []).forEach((m) => nombres.add(m));
    });
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, "es"));
  }, [meserosPrevios, aperturasCaja]);

  const ventasHoy = useMemo(
    () => ventas.filter((v) => esHoy(v.fecha)).slice(0, 12),
    [ventas]
  );

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function cambiarBarra(barra) {
    setForm((f) => ({ ...f, barra, productoId: "" }));
  }

  async function abrirCaja(e) {
    e.preventDefault();
    setMensajeApertura("");
    const cajera = aperturaForm.cajera.trim();
    const meseros = aperturaForm.meseros.split(",").map((m) => m.trim()).filter(Boolean);
    const cajaChica = Number(aperturaForm.cajaChica) || 0;
    if (!cajera) return setMensajeApertura("Escribe el nombre de la persona que abre la caja.");
    if (cajaChica < 0) return setMensajeApertura("La caja chica no puede ser negativa.");
    if (meseros.length === 0) return setMensajeApertura("Escribe al menos un mesero.");
    try {
      await registrarAperturaCaja({
        fecha: fechaHoyISO(), cajera, barra: aperturaForm.barra, meseros, cajaChica,
      });
      setForm((f) => ({ ...f, cajera, barra: aperturaForm.barra, mesero: meseros[0] || "" }));
      setMensajeApertura("Caja abierta correctamente.");
    } catch (err) {
      console.error(err);
      setMensajeApertura("No se pudo abrir la caja.");
    }
  }

  async function guardarGasto(e) {
    e.preventDefault();
    setMensajeGasto("");
    if (!aperturaActiva) return setMensajeGasto("Primero debes abrir la caja.");
    if (!gastoForm.concepto.trim()) return setMensajeGasto("Escribe el concepto del gasto.");
    const monto = Number(gastoForm.monto) || 0;
    if (monto <= 0) return setMensajeGasto("Ingresa un monto mayor a 0.");
    try {
      await registrarGastoCaja({
        fecha: fechaHoyISO(), aperturaId: aperturaActiva.id, barra: aperturaActiva.barra,
        concepto: gastoForm.concepto.trim(), monto, observaciones: gastoForm.observaciones.trim(),
      });
      setGastoForm({ concepto: "", monto: "", observaciones: "" });
      setMensajeGasto("Gasto registrado.");
    } catch (err) {
      console.error(err);
      setMensajeGasto("No se pudo registrar el gasto.");
    }
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");

    if (!aperturaActiva) return setError("Primero debes realizar la apertura de caja.");
    if (!form.mesero.trim()) return setError("Escribe el nombre del mesero.");
    if (!productoSel) return setError("Selecciona un producto.");
    if (!form.cantidad || Number(form.cantidad) <= 0)
      return setError("La cantidad debe ser mayor a 0.");
    if (stockDisponible < Number(form.cantidad))
      return setError(
        `Solo hay ${stockDisponible} unidades de "${productoSel.nombre}" en ${BARRAS.find((b) => b.valor === form.barra).etiqueta}.`
      );

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
        cajera: form.cajera.trim(),
        comanda: form.comanda.trim(),
        barra: form.barra,
        mesero: form.mesero.trim(),
        productoId: productoSel.id,
        producto: productoSel.nombre,
        unidad: productoSel.unidadVenta || "Botella",
        cantidad: Number(form.cantidad),
        precioUnitario,
        total,
        formaPago: form.formaPago,
        montoQr,
        montoEfectivo,
        observaciones: form.observaciones.trim(),
        complemento: form.complemento.trim(),
        aperturaId: aperturaActiva.id,
      });
      setForm({ ...VACIO, cajera: form.cajera, mesero: form.mesero, barra: form.barra, complemento: "" });
      setEditandoPrecio(false);
      setPrecioEditado("");
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

      {!aperturaActiva ? (
        <form className="formulario" onSubmit={abrirCaja}>
          <h2>Apertura de caja</h2>
          <div className="formulario__fila">
            <label>
              Nombre de quien apertura
              <input list="cajeras-apertura-lista" value={aperturaForm.cajera} onChange={(e) => setAperturaForm((f) => ({ ...f, cajera: e.target.value }))} placeholder="Ej: María" required />
              <datalist id="cajeras-apertura-lista">{cajerasAperturaPrevias.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>
              Caja chica / Con cuánto abre (Bs)
              <input type="number" step="0.01" min="0" value={aperturaForm.cajaChica} onChange={(e) => setAperturaForm((f) => ({ ...f, cajaChica: e.target.value }))} placeholder="Ej: 150" required />
            </label>
            <label>
              Barra
              <select value={aperturaForm.barra} onChange={(e) => setAperturaForm((f) => ({ ...f, barra: e.target.value }))}>
                {BARRAS.map((b) => <option key={b.valor} value={b.valor}>{b.etiqueta}</option>)}
              </select>
            </label>
          </div>
          <div className="formulario__fila">
            <label>
              Meseros del turno
              <input list="meseros-apertura-lista" value={aperturaForm.meseros} onChange={(e) => setAperturaForm((f) => ({ ...f, meseros: e.target.value }))} placeholder="Ej: Carla, José, Luis" required />
              <datalist id="meseros-apertura-lista">{meserosAperturaPrevios.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
          </div>
          {mensajeApertura && <div className="formulario__error">{mensajeApertura}</div>}
          <button type="submit" className="boton boton--primario">Abrir caja</button>
        </form>
      ) : (
        <section className="lista-reciente">
          <h2>Caja abierta</h2>
          <p><strong>{aperturaActiva.cajera}</strong> · {BARRAS.find((b) => b.valor === aperturaActiva.barra)?.etiqueta || aperturaActiva.barra} · Caja chica: Bs {Number(aperturaActiva.cajaChica || 0).toFixed(2)} · Meseros: {(aperturaActiva.meseros || []).join(", ")}</p>
        </section>
      )}

      {aperturaActiva && (
      <form className="formulario" onSubmit={enviar}>
        <div className="formulario__fila">
          <label>
            Cajera
            <input
              list="cajeras-lista"
              value={form.cajera}
              onChange={(e) => actualizar("cajera", e.target.value)}
              placeholder="Ej: Maria"
            />
            <datalist id="cajeras-lista">
              {cajerasPrevias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Barra
            <select value={form.barra} onChange={(e) => cambiarBarra(e.target.value)}>
              {BARRAS.map((b) => (
                <option key={b.valor} value={b.valor}>{b.etiqueta}</option>
              ))}
            </select>
          </label>
          <label>
            N° de comanda (opcional)
            <input
              value={form.comanda}
              onChange={(e) => actualizar("comanda", e.target.value)}
              placeholder="Ej: 128"
            />
          </label>
        </div>

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
              onChange={(e) => {
                actualizar("productoId", e.target.value);
                setEditandoPrecio(false);
                setPrecioEditado("");
              }}
              required
            >
              <option value="">Selecciona un producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id} disabled={(p[campoActivo] ?? 0) <= 0}>
                  {p.nombre} {(p[campoActivo] ?? 0) <= 0 ? "(sin stock aquí)" : `— stock: ${p[campoActivo] ?? 0}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unidad
            <input type="text" value={productoSel?.unidadVenta || "—"} disabled />
          </label>
          <label>
            Precio de venta
            {editandoPrecio ? (
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={precioEditado}
                onChange={(e) => setPrecioEditado(e.target.value)}
                onBlur={() => {
                  if (precioEditado === "") setEditandoPrecio(false);
                }}
              />
            ) : (
              <div className="precio-con-editar">
                <input type="text" value={precioSugerido ? `Bs ${precioSugerido.toFixed(2)}` : "—"} disabled />
                <button
                  type="button"
                  className="boton boton--enlace"
                  onClick={() => {
                    setPrecioEditado(String(precioSugerido || ""));
                    setEditandoPrecio(true);
                  }}
                  disabled={!productoSel}
                >
                  Cambiar
                </button>
              </div>
            )}
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

        {productoSel && (
          <div className="formulario__fila">
            <label>
              Complemento (opcional)
              <input value={form.complemento} onChange={(e) => actualizar("complemento", e.target.value)} placeholder="Ej: Sprite, Schweppes, tónica…" />
            </label>
          </div>
        )}

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
          {form.formaPago === "efectivo" && (
            <>
              <label>
                Efectivo recibido
                <input
                  type="number"
                  step="0.01"
                  value={form.montoEfectivo}
                  onChange={(e) => actualizar("montoEfectivo", e.target.value)}
                  placeholder={total ? total.toFixed(2) : ""}
                />
              </label>
              <label>
                Cambio
                <input type="text" value={`Bs ${cambio.toFixed(2)}`} disabled />
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
      )}

      {aperturaActiva && (
      <form className="formulario" onSubmit={guardarGasto}>
        <h2>Gastos</h2>
        <div className="formulario__fila">
          <label>Concepto<input value={gastoForm.concepto} onChange={(e) => setGastoForm((f) => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Sonido" /></label>
          <label>Monto (Bs)<input type="number" step="0.01" min="0" value={gastoForm.monto} onChange={(e) => setGastoForm((f) => ({ ...f, monto: e.target.value }))} /></label>
          <label>Observaciones<input value={gastoForm.observaciones} onChange={(e) => setGastoForm((f) => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" /></label>
        </div>
        {mensajeGasto && <div className="formulario__error formulario__error--exito">{mensajeGasto}</div>}
        <button type="submit" className="boton boton--primario">Registrar gasto</button>
      </form>
      )}

      {aperturaActiva && gastosCaja.filter((g) => g.aperturaId === aperturaActiva.id).length > 0 && (
        <section className="lista-reciente">
          <h2>Gastos de esta caja</h2>
          <table className="tabla"><thead><tr><th>Concepto</th><th>Monto</th><th>Observaciones</th></tr></thead><tbody>
            {gastosCaja.filter((g) => g.aperturaId === aperturaActiva.id).map((g) => <tr key={g.id}><td>{g.concepto}</td><td>Bs {Number(g.monto || 0).toFixed(2)}</td><td>{g.observaciones || "—"}</td></tr>)}
          </tbody></table>
        </section>
      )}

      <section className="lista-reciente">
        <h2>Ventas de hoy</h2>
        {ventasHoy.length === 0 ? (
          <p className="texto-vacio">Todavía no hay ventas registradas hoy.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Barra</th>
                <th>Mesero</th>
                <th>Producto</th>
                <th>Unidad</th>
                <th>Cant.</th>
                <th>Total</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {ventasHoy.map((v) => (
                <tr key={v.id}>
                  <td>{new Date(v.fecha).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="tabla__etiqueta">{BARRAS.find((b) => b.valor === v.barra)?.etiqueta || "—"}</td>
                  <td>{v.mesero}</td>
                  <td>{v.producto}</td>
                  <td className="tabla__etiqueta">{v.unidad || "—"}</td>
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