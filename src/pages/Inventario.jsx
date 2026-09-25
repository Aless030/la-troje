import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";

const FAMILIAS = ["Licores", "Cervezas", "Refrescos", "Comida"];
const UNIDADES_VENTA = ["Botella", "Vaso", "Lata", "Jarra", "Copa", "Shot", "Cántaro", "Porción"];
const DESTINOS = [
  { valor: "general", etiqueta: "Almacén general" },
  { valor: "interior", etiqueta: "Interior" },
  { valor: "semicubierto", etiqueta: "Semicubierto" },
];

const VACIO = {
  nombre: "",
  familia: "Licores",
  volumenCantidad: "",
  volumenUnidad: "ml",
  tipoEmpaque: "botella",
  cantidadBotellas: "",
  cantidadCajas: "",
  botellasPorCaja: "",
  botellasSueltas: "",
  precio: "",
  precioCaja: "",
  precioVenta: "",
  unidadVenta: "Botella",
  stockMinimo: "3",
  destino: "general",
  factura: "",
};

export default function Inventario() {
  const { productos, comprasInventario, actualizarProducto, eliminarProducto, registrarCompra } = useData();
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [avisoAuto, setAvisoAuto] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const esBebida = form.familia !== "Comida";
  const esCaja = form.tipoEmpaque === "caja";

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // Cantidad total en botellas/unidades, sea que se cargue por botella suelta o por caja.
  const cantidadTotal = useMemo(() => {
    if (esBebida && esCaja) {
      const cajas = Number(form.cantidadCajas) || 0;
      const porCaja = Number(form.botellasPorCaja) || 0;
      const sueltas = Number(form.botellasSueltas) || 0;
      return cajas * porCaja + sueltas;
    }
    return Number(form.cantidadBotellas) || 0;
  }, [esBebida, esCaja, form.cantidadCajas, form.botellasPorCaja, form.botellasSueltas, form.cantidadBotellas]);

  // Si se cargó por caja, el precio por unidad sale de dividir el precio de la caja
  // entre las botellas que trae esa caja.
  const precioUnitarioCalculado = useMemo(() => {
    if (esBebida && esCaja) {
      const porCaja = Number(form.botellasPorCaja) || 0;
      const precioCaja = Number(form.precioCaja) || 0;
      return porCaja > 0 ? precioCaja / porCaja : 0;
    }
    return Number(form.precio) || 0;
  }, [esBebida, esCaja, form.botellasPorCaja, form.precioCaja, form.precio]);

  // Si el nombre coincide con un producto que ya existe, es una reposición
  // (nueva factura del mismo producto), no un producto nuevo.
  const productoExistente = useMemo(() => {
    const nombre = form.nombre.trim().toLowerCase();
    if (!nombre) return null;
    return (
      productos.find(
        (p) => p.id !== editandoId && (p.nombre || "").trim().toLowerCase() === nombre
      ) || null
    );
  }, [form.nombre, productos, editandoId]);

  function autocompletarSiExiste() {
    if (!productoExistente || editandoId) return;
    setForm((f) => ({
      ...f,
      familia: productoExistente.familia || f.familia,
      volumenCantidad: String(productoExistente.volumenCantidad ?? ""),
      volumenUnidad: productoExistente.volumenUnidad || "ml",
      tipoEmpaque: productoExistente.tipoEmpaque || "botella",
      botellasPorCaja: String(productoExistente.botellasPorCaja ?? ""),
      precio: String(productoExistente.precio ?? ""),
      precioCaja: String(productoExistente.precioCaja ?? ""),
      precioVenta: String(productoExistente.precioVenta ?? ""),
      unidadVenta: productoExistente.unidadVenta || "Botella",
      stockMinimo: String(productoExistente.stockMinimo ?? "3"),
      // La cantidad, la factura y las botellas sueltas se dejan en blanco: eso es lo nuevo que llegó.
      cantidadBotellas: "",
      cantidadCajas: "",
      botellasSueltas: "",
      factura: "",
    }));
    setAvisoAuto(
      `Se cargaron los datos de la última compra de "${productoExistente.nombre}". Solo completa la cantidad, la factura y el almacén destino.`
    );
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) return setError("Escribe el nombre del producto.");

    if (esBebida && esCaja) {
      if (!form.precioCaja || Number(form.precioCaja) <= 0) return setError("Ingresa el precio de la caja.");
      if (!form.botellasPorCaja || Number(form.botellasPorCaja) <= 0)
        return setError("Ingresa cuántas botellas trae cada caja.");
    } else {
      if (!form.precio || Number(form.precio) < 0) return setError("Ingresa un precio válido.");
    }
    if (!form.precioVenta || Number(form.precioVenta) < 0)
      return setError("Ingresa el precio de venta al público.");

    const datos = {
      nombre: form.nombre.trim(),
      familia: form.familia,
      volumenCantidad: esBebida && form.volumenCantidad ? Number(form.volumenCantidad) : null,
      volumenUnidad: esBebida && form.volumenCantidad ? form.volumenUnidad : null,
      tipoEmpaque: esBebida ? form.tipoEmpaque : "botella",
      cantidadCajas: esBebida && esCaja ? Number(form.cantidadCajas) || 0 : 0,
      botellasPorCaja: esBebida && esCaja ? Number(form.botellasPorCaja) || 0 : 0,
      botellasSueltas: esBebida && esCaja ? Number(form.botellasSueltas) || 0 : 0,
      precioCaja: esBebida && esCaja ? Number(form.precioCaja) || 0 : 0,
      precio: Number(precioUnitarioCalculado.toFixed(2)),
      precioVenta: Number(Number(form.precioVenta).toFixed(2)),
      unidadVenta: form.unidadVenta.trim() || "Botella",
      stockMinimo: Number(form.stockMinimo) || 0,
    };

    if (editandoId) {
      // Edición directa de un producto: la cantidad ingresada reemplaza el stock del almacén general.
      await actualizarProducto(editandoId, { ...datos, stock: cantidadTotal });
    } else {
      // Compra nueva (o reposición): se suma al almacén elegido y queda registrada con su factura.
      await registrarCompra({
        productoExistenteId: productoExistente?.id || null,
        datosProducto: datos,
        destino: form.destino,
        cantidad: cantidadTotal,
        factura: form.factura.trim(),
      });
    }
    setForm(VACIO);
    setEditandoId(null);
    setAvisoAuto("");
  }

  function editar(p) {
    setEditandoId(p.id);
    setAvisoAuto("");
    setForm({
      nombre: p.nombre || "",
      familia: p.familia || "Licores",
      volumenCantidad: String(p.volumenCantidad ?? ""),
      volumenUnidad: p.volumenUnidad || "ml",
      // Al editar se corrige directo la cantidad total del almacén general, sin recalcular por caja.
      tipoEmpaque: "botella",
      cantidadBotellas: String(p.stock ?? ""),
      cantidadCajas: "",
      botellasPorCaja: String(p.botellasPorCaja ?? ""),
      botellasSueltas: "",
      precio: String(p.precio ?? ""),
      precioCaja: "",
      precioVenta: String(p.precioVenta ?? p.precio ?? ""),
      unidadVenta: p.unidadVenta || "Botella",
      stockMinimo: String(p.stockMinimo ?? "3"),
      destino: "general",
      factura: "",
    });
  }

  async function ajustarStock(p, delta) {
    const nuevo = Math.max(0, (p.stock ?? 0) + delta);
    await actualizarProducto(p.id, { stock: nuevo });
  }

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return productos;
    return productos.filter(
      (p) =>
        (p.nombre || "").toLowerCase().includes(texto) || (p.familia || "").toLowerCase().includes(texto)
    );
  }, [productos, busqueda]);

  const comprasRecientes = useMemo(() => comprasInventario.slice(0, 15), [comprasInventario]);

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Inventario</h1>
        <p>Carga tus productos por familia y manda la cantidad directo al almacén general o a una barra.</p>
      </header>

      <form className="formulario" onSubmit={enviar}>
        <div className="formulario__fila">
          <label>
            Producto
            <input
              list="productos-lista"
              value={form.nombre}
              onChange={(e) => actualizar("nombre", e.target.value)}
              onBlur={autocompletarSiExiste}
              placeholder="Ej: Flor de Caña 5 años"
              required
            />
            <datalist id="productos-lista">
              {productos.map((p) => (
                <option key={p.id} value={p.nombre} />
              ))}
            </datalist>
          </label>
          <label>
            Familia
            <select value={form.familia} onChange={(e) => actualizar("familia", e.target.value)}>
              {FAMILIAS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>

        {esBebida && (
          <div className="formulario__fila">
            <label>
              Volumen
              <input
                type="number"
                step="1"
                min="0"
                value={form.volumenCantidad}
                onChange={(e) => actualizar("volumenCantidad", e.target.value)}
                placeholder="Ej: 750"
              />
            </label>
            <label>
              Unidad
              <select value={form.volumenUnidad} onChange={(e) => actualizar("volumenUnidad", e.target.value)}>
                <option value="ml">ml</option>
                <option value="L">L</option>
              </select>
            </label>
            <label>
              Se carga por
              <select value={form.tipoEmpaque} onChange={(e) => actualizar("tipoEmpaque", e.target.value)}>
                <option value="botella">Botella</option>
                <option value="caja">Caja</option>
              </select>
            </label>
          </div>
        )}

        {esBebida && esCaja ? (
          <div className="formulario__fila">
            <label>
              Cantidad de cajas
              <input
                type="number"
                min="0"
                value={form.cantidadCajas}
                onChange={(e) => actualizar("cantidadCajas", e.target.value)}
              />
            </label>
            <label>
              Botellas por caja
              <input
                type="number"
                min="1"
                value={form.botellasPorCaja}
                onChange={(e) => actualizar("botellasPorCaja", e.target.value)}
                required
              />
            </label>
            <label>
              Botellas sueltas (opcional, admite decimales/porcentaje ej. 0.15)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.botellasSueltas}
                onChange={(e) => actualizar("botellasSueltas", e.target.value)}
              />
            </label>
            <label>
              Precio de la caja (Bs)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.precioCaja}
                onChange={(e) => actualizar("precioCaja", e.target.value)}
                required
              />
            </label>
          </div>
        ) : (
          <div className="formulario__fila">
            <label>
              Cantidad (admite decimales/porcentaje ej. 31.15)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cantidadBotellas}
                onChange={(e) => actualizar("cantidadBotellas", e.target.value)}
              />
            </label>
            <label>
              Precio de compra {esBebida ? "por botella" : ""} (Bs)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.precio}
                onChange={(e) => actualizar("precio", e.target.value)}
                required
              />
            </label>
          </div>
        )}

        <div className="formulario__fila">
          <label>
            Unidad de venta
            <input
              list="unidades-venta-lista"
              value={form.unidadVenta}
              onChange={(e) => actualizar("unidadVenta", e.target.value)}
              placeholder="Ej: Botella, Vaso, Lata…"
            />
            <datalist id="unidades-venta-lista">
              {UNIDADES_VENTA.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
          <label>
            Precio de venta al público (Bs)
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.precioVenta}
              onChange={(e) => actualizar("precioVenta", e.target.value)}
              placeholder="Ej: 35.00"
              required
            />
          </label>
        </div>

        {!editandoId && (
          <div className="formulario__fila">
            <label>
              Almacén destino
              <select value={form.destino} onChange={(e) => actualizar("destino", e.target.value)}>
                {DESTINOS.map((d) => (
                  <option key={d.valor} value={d.valor}>{d.etiqueta}</option>
                ))}
              </select>
            </label>
            <label>
              N° de factura (opcional)
              <input
                value={form.factura}
                onChange={(e) => actualizar("factura", e.target.value)}
                placeholder="Ej: 4546"
              />
            </label>
          </div>
        )}

        <div className="formulario__fila">
          {esBebida && esCaja && (
            <label>
              Precio por botella (calculado)
              <input type="text" value={`Bs ${precioUnitarioCalculado.toFixed(2)}`} disabled />
            </label>
          )}
          <label>
            Cantidad total que entra
            <input type="text" value={`${cantidadTotal} unidad(es)`} disabled />
          </label>
          <label>
            Aviso de stock bajo
            <input
              type="number"
              min="0"
              value={form.stockMinimo}
              onChange={(e) => actualizar("stockMinimo", e.target.value)}
            />
          </label>
        </div>

        {avisoAuto && <div className="formulario__error formulario__error--exito">{avisoAuto}</div>}
        {error && <div className="formulario__error">{error}</div>}

        <div className="formulario__acciones">
          <button type="submit" className="boton boton--primario">
            {editandoId ? "Guardar cambios" : productoExistente ? "Sumar al almacén elegido" : "Agregar producto"}
          </button>
          {editandoId && (
            <button
              type="button"
              className="boton boton--fantasma"
              onClick={() => {
                setEditandoId(null);
                setAvisoAuto("");
                setForm(VACIO);
              }}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <section className="lista-reciente">
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

        <h2>Productos ({productosFiltrados.length})</h2>
        {productosFiltrados.length === 0 ? (
          <p className="texto-vacio">
            {productos.length === 0 ? "Todavía no cargaste productos." : "Ningún producto coincide con la búsqueda."}
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Familia</th>
                <th>Unidad</th>
                <th>Precio compra</th>
                <th>Precio venta</th>
                <th>Almacén</th>
                <th>Interior</th>
                <th>Semicubierto</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p) => (
                <tr key={p.id} className={(p.stock ?? 0) <= (p.stockMinimo ?? 3) ? "tabla__fila--alerta" : ""}>
                  <td>{p.nombre}</td>
                  <td className="tabla__etiqueta">{p.familia || "—"}</td>
                  <td className="tabla__etiqueta">{p.unidadVenta || "Botella"}</td>
                  <td>Bs {Number(p.precio || 0).toFixed(2)}</td>
                  <td>
                    <input
                      key={`precioVenta-${p.id}-${p.precioVenta}`}
                      type="number"
                      step="0.01"
                      min="0"
                      className="celda-editable"
                      defaultValue={p.precioVenta ?? p.precio ?? 0}
                      onBlur={(e) => {
                        const nuevo = Number(e.target.value) || 0;
                        if (nuevo !== (p.precioVenta ?? p.precio ?? 0)) actualizarProducto(p.id, { precioVenta: nuevo });
                      }}
                    />
                  </td>
                  <td>
                    <div className="ajuste-stock">
                      <button type="button" onClick={() => ajustarStock(p, -1)}>−</button>
                      <input
                        key={`stock-${p.id}-${p.stock}`}
                        type="number"
                        step="0.01"
                        className="celda-editable celda-editable--stock"
                        defaultValue={p.stock ?? 0}
                        onBlur={(e) => {
                          const nuevo = Number(e.target.value) || 0;
                          if (nuevo !== (p.stock ?? 0)) actualizarProducto(p.id, { stock: nuevo });
                        }}
                      />
                      <button type="button" onClick={() => ajustarStock(p, 1)}>+</button>
                    </div>
                  </td>
                  <td>{p.stockInterior ?? 0}</td>
                  <td>{p.stockSemicubierto ?? 0}</td>
                  <td>
                    <button className="boton boton--enlace" onClick={() => editar(p)}>Editar</button>
                  </td>
                  <td>
                    <button
                      className="boton boton--enlace boton--peligro"
                      onClick={() => eliminarProducto(p.id)}
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

      <section className="lista-reciente">
        <h2>Últimas compras registradas</h2>
        {comprasRecientes.length === 0 ? (
          <p className="texto-vacio">Todavía no hay compras registradas.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Destino</th>
                <th>Cantidad</th>
                <th>Factura</th>
              </tr>
            </thead>
            <tbody>
              {comprasRecientes.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.fecha).toLocaleDateString("es-BO")}</td>
                  <td>{c.producto}</td>
                  <td className="tabla__etiqueta">
                    {DESTINOS.find((d) => d.valor === c.destino)?.etiqueta || c.destino}
                  </td>
                  <td>{c.cantidad}</td>
                  <td>{c.factura || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}