import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";

const FAMILIAS = ["Licores", "Cervezas", "Refrescos", "Comida"];

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
  stockMinimo: "3",
};

export default function Inventario() {
  const { productos, agregarProducto, actualizarProducto, eliminarProducto } = useData();
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [avisoAuto, setAvisoAuto] = useState("");
  const [editandoId, setEditandoId] = useState(null);

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
      stockMinimo: String(productoExistente.stockMinimo ?? "3"),
      // La cantidad y las botellas sueltas se dejan en blanco: eso es lo nuevo que llegó.
      cantidadBotellas: "",
      cantidadCajas: "",
      botellasSueltas: "",
    }));
    setAvisoAuto(
      `Se cargaron los datos de la última compra de "${productoExistente.nombre}". Solo completa la cantidad que llegó ahora.`
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
      stockMinimo: Number(form.stockMinimo) || 0,
    };

    if (editandoId) {
      // Edición directa de un producto: la cantidad ingresada reemplaza el stock actual.
      await actualizarProducto(editandoId, { ...datos, stock: cantidadTotal });
    } else if (productoExistente) {
      // Reposición: se suma la cantidad nueva al stock que ya había.
      await actualizarProducto(productoExistente.id, {
        ...datos,
        stock: (productoExistente.stock || 0) + cantidadTotal,
      });
    } else {
      await agregarProducto({ ...datos, stock: cantidadTotal });
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
      // Al editar se corrige directo la cantidad total en botellas, sin recalcular por caja.
      tipoEmpaque: "botella",
      cantidadBotellas: String(p.stock ?? ""),
      cantidadCajas: "",
      botellasPorCaja: String(p.botellasPorCaja ?? ""),
      botellasSueltas: "",
      precio: String(p.precio ?? ""),
      precioCaja: "",
      stockMinimo: String(p.stockMinimo ?? "3"),
    });
  }

  async function ajustarStock(p, delta) {
    const nuevo = Math.max(0, (p.stock ?? 0) + delta);
    await actualizarProducto(p.id, { stock: nuevo });
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Inventario</h1>
        <p>Carga tus productos por familia. El stock se descuenta solo con cada venta.</p>
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
              Botellas sueltas (opcional)
              <input
                type="number"
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
              Cantidad
              <input
                type="number"
                min="0"
                value={form.cantidadBotellas}
                onChange={(e) => actualizar("cantidadBotellas", e.target.value)}
              />
            </label>
            <label>
              Precio {esBebida ? "por botella" : ""} (Bs)
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
            {editandoId ? "Guardar cambios" : productoExistente ? "Sumar al stock existente" : "Agregar producto"}
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
        <h2>Productos ({productos.length})</h2>
        {productos.length === 0 ? (
          <p className="texto-vacio">Todavía no cargaste productos.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Familia</th>
                <th>Volumen</th>
                <th>Precio</th>
                <th>Cantidad</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className={(p.stock ?? 0) <= (p.stockMinimo ?? 3) ? "tabla__fila--alerta" : ""}>
                  <td>{p.nombre}</td>
                  <td className="tabla__etiqueta">{p.familia || "—"}</td>
                  <td>{p.volumenCantidad ? `${p.volumenCantidad} ${p.volumenUnidad}` : "—"}</td>
                  <td>Bs {Number(p.precio).toFixed(2)}</td>
                  <td>
                    <div className="ajuste-stock">
                      <button type="button" onClick={() => ajustarStock(p, -1)}>−</button>
                      <span>{p.stock ?? 0}</span>
                      <button type="button" onClick={() => ajustarStock(p, 1)}>+</button>
                    </div>
                  </td>
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
    </div>
  );
}