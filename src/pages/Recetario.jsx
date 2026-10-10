import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { DOSIS_CASA, consumoIngrediente, volumenEnMl } from "../utils/dosis";

const UNIDADES = [
  { valor: "ml", etiqueta: "ml" },
  { valor: "dosis", etiqueta: "dosis / vaso de la casa" },
  { valor: "unidad", etiqueta: "unidad(es)" },
];

const INGREDIENTE_VACIO = { productoId: "", cantidad: "", unidad: "ml" };
const VACIO = { nombre: "", precioVenta: "", ingredientes: [{ ...INGREDIENTE_VACIO }] };

// Costo de un ingrediente: precio de la botella/unidad por la fracción que se gasta
// (ml -> ml / volumen de la botella; dosis -> dosis / dosis por botella de la casa;
// unidad -> unidades completas).
function costoIngrediente(producto, cantidad, unidad) {
  if (!producto || !cantidad) return 0;
  const precio = Number(producto.precio) || 0;
  return precio * consumoIngrediente(producto, cantidad, unidad);
}

// Por qué no se puede calcular el consumo de un ingrediente (para avisar al guardar).
function problemaIngrediente(producto, cantidad, unidad) {
  if (consumoIngrediente(producto, cantidad, unidad) > 0) return "";
  if (unidad === "dosis") {
    return `"${producto?.nombre}" no tiene dosis de la casa definidas para su tamaño (${volumenEnMl(producto) || "sin volumen"} ml). Usa ml o unidades.`;
  }
  if (unidad === "ml") return `"${producto?.nombre}" no tiene volumen cargado en Inventario, no se puede usar en ml.`;
  return `Revisa la cantidad de "${producto?.nombre}".`;
}

export default function Recetario() {
  const { productos, recetas, registrarReceta, actualizarReceta, eliminarReceta } = useData();
  const [form, setForm] = useState(VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  function actualizarIngrediente(i, campo, valor) {
    setForm((f) => {
      const ingredientes = [...f.ingredientes];
      ingredientes[i] = { ...ingredientes[i], [campo]: valor };
      return { ...f, ingredientes };
    });
  }

  function agregarIngrediente() {
    setForm((f) => ({ ...f, ingredientes: [...f.ingredientes, { ...INGREDIENTE_VACIO }] }));
  }

  function quitarIngrediente(i) {
    setForm((f) => ({ ...f, ingredientes: f.ingredientes.filter((_, idx) => idx !== i) }));
  }

  const costoTotal = useMemo(() => {
    return form.ingredientes.reduce((suma, ing) => {
      const producto = productos.find((p) => p.id === ing.productoId);
      return suma + costoIngrediente(producto, Number(ing.cantidad) || 0, ing.unidad);
    }, 0);
  }, [form.ingredientes, productos]);

  const margen = useMemo(() => {
    const venta = Number(form.precioVenta) || 0;
    if (!venta) return null;
    return { bs: venta - costoTotal, porcentaje: venta > 0 ? ((venta - costoTotal) / venta) * 100 : 0 };
  }, [form.precioVenta, costoTotal]);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) return setError("Escribe el nombre del trago.");

    const ingredientesValidos = form.ingredientes.filter((i) => i.productoId && Number(i.cantidad) > 0);
    if (ingredientesValidos.length === 0) return setError("Agrega al menos un ingrediente con cantidad.");

    if (!(Number(form.precioVenta) > 0)) return setError("Ingresa el precio de venta del trago (es lo que se cobra en Ventas).");

    for (const ing of ingredientesValidos) {
      const producto = productos.find((p) => p.id === ing.productoId);
      const problema = problemaIngrediente(producto, Number(ing.cantidad), ing.unidad);
      if (problema) return setError(problema);
    }

    const ingredientes = ingredientesValidos.map((i) => {
      const producto = productos.find((p) => p.id === i.productoId);
      return {
        productoId: i.productoId,
        producto: producto?.nombre || "",
        cantidad: Number(i.cantidad),
        unidad: i.unidad,
      };
    });

    const datos = {
      nombre: form.nombre.trim(),
      ingredientes,
      costoTotal: Number(costoTotal.toFixed(2)),
      precioVenta: Number(form.precioVenta) || 0,
    };

    if (editandoId) {
      await actualizarReceta(editandoId, datos);
    } else {
      await registrarReceta(datos);
    }
    setForm(VACIO);
    setEditandoId(null);
  }

  function editar(r) {
    setEditandoId(r.id);
    setForm({
      nombre: r.nombre || "",
      precioVenta: String(r.precioVenta || ""),
      ingredientes:
        r.ingredientes?.length > 0
          ? r.ingredientes.map((i) => ({ productoId: i.productoId, cantidad: String(i.cantidad), unidad: i.unidad }))
          : [{ ...INGREDIENTE_VACIO }],
    });
  }

  function cancelar() {
    setEditandoId(null);
    setForm(VACIO);
    setError("");
  }

  const recetasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return recetas;
    return recetas.filter((r) => (r.nombre || "").toLowerCase().includes(texto));
  }, [recetas, busqueda]);

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Recetario y tragos</h1>
        <p>Cada trago que guardes aparece en Ventas para venderlo, y al venderlo descuenta del inventario lo que gasta (por ejemplo, 15 tragos con 50 ml de ron gastan 750 ml, casi una botella).</p>
      </header>

      <section className="lista-reciente">
        <h2>Dosis de la casa</h2>
        <p className="texto-vacio">
          Según el tamaño de la botella cargada en Inventario. Al armar un trago, elige la unidad «dosis / vaso de la
          casa» y el sistema descuenta la fracción de botella que corresponde.
        </p>
        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Rinde</th>
              <th>Cada dosis / vaso</th>
            </tr>
          </thead>
          <tbody>
            {DOSIS_CASA.map((d) => (
              <tr key={d.botellaMl}>
                <td>{d.nombre}</td>
                <td>{d.detalle}</td>
                <td>{(d.botellaMl / d.dosis).toFixed(0)} ml</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form className="formulario" onSubmit={enviar}>
        <div className="formulario__fila">
          <label>
            Nombre del trago
            <input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Mojito"
              required
            />
          </label>
          <label>
            Precio de venta (Bs)
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.precioVenta}
              onChange={(e) => setForm((f) => ({ ...f, precioVenta: e.target.value }))}
              placeholder="Ej: 35"
            />
          </label>
        </div>

        <h2>Ingredientes</h2>
        {form.ingredientes.map((ing, i) => {
          const producto = productos.find((p) => p.id === ing.productoId);
          const costo = costoIngrediente(producto, Number(ing.cantidad) || 0, ing.unidad);
          const descuenta = consumoIngrediente(producto, Number(ing.cantidad) || 0, ing.unidad);
          return (
            <div className="formulario__fila" key={i}>
              <label>
                Producto
                <select
                  value={ing.productoId}
                  onChange={(e) => actualizarIngrediente(i, "productoId", e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={ing.cantidad}
                  onChange={(e) => actualizarIngrediente(i, "cantidad", e.target.value)}
                  placeholder="Ej: 45"
                />
              </label>
              <label>
                Unidad
                <select value={ing.unidad} onChange={(e) => actualizarIngrediente(i, "unidad", e.target.value)}>
                  {UNIDADES.map((u) => (
                    <option key={u.valor} value={u.valor}>{u.etiqueta}</option>
                  ))}
                </select>
              </label>
              <label>
                Descuenta del inventario
                <input type="text" value={`${descuenta.toFixed(4)} botella(s)`} disabled />
              </label>
              <label>
                Costo
                <input type="text" value={`Bs ${costo.toFixed(2)}`} disabled />
              </label>
              {form.ingredientes.length > 1 && (
                <button
                  type="button"
                  className="boton boton--enlace boton--peligro"
                  onClick={() => quitarIngrediente(i)}
                >
                  Quitar
                </button>
              )}
            </div>
          );
        })}
        <button type="button" className="boton boton--fantasma" onClick={agregarIngrediente}>
          + Agregar ingrediente
        </button>

        <div className="formulario__total">
          Costo total: Bs {costoTotal.toFixed(2)}
          {margen && (
            <span> — Margen: Bs {margen.bs.toFixed(2)} ({margen.porcentaje.toFixed(0)}%)</span>
          )}
        </div>

        {error && <div className="formulario__error">{error}</div>}

        <div className="formulario__acciones">
          <button type="submit" className="boton boton--primario">
            {editandoId ? "Guardar cambios" : "Guardar receta"}
          </button>
          {editandoId && (
            <button type="button" className="boton boton--fantasma" onClick={cancelar}>
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <section className="lista-reciente">
        <div className="formulario__fila">
          <label>
            Buscar trago
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej: Mojito, Piña colada…"
            />
          </label>
        </div>

        <h2>Tragos ({recetasFiltradas.length})</h2>
        {recetasFiltradas.length === 0 ? (
          <p className="texto-vacio">
            {recetas.length === 0 ? "Todavía no armaste ningún trago." : "Ningún trago coincide con la búsqueda."}
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Trago</th>
                <th>Ingredientes</th>
                <th>Costo</th>
                <th>Precio venta</th>
                <th>Margen</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recetasFiltradas.map((r) => {
                const m = r.precioVenta ? r.precioVenta - (r.costoTotal || 0) : null;
                return (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td>{r.ingredientes?.map((i) => i.producto).join(", ") || "—"}</td>
                    <td>Bs {Number(r.costoTotal || 0).toFixed(2)}</td>
                    <td>{r.precioVenta ? `Bs ${Number(r.precioVenta).toFixed(2)}` : "—"}</td>
                    <td>{m !== null ? `Bs ${m.toFixed(2)}` : "—"}</td>
                    <td>
                      <button className="boton boton--enlace" onClick={() => editar(r)}>Editar</button>
                    </td>
                    <td>
                      <button
                        className="boton boton--enlace boton--peligro"
                        onClick={() => eliminarReceta(r.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}