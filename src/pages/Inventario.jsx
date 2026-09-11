import { useState } from "react";
import { useData } from "../context/DataContext";

const VACIO = { nombre: "", categoria: "", precio: "", stock: "", stockMinimo: "3" };

export default function Inventario() {
  const { productos, agregarProducto, actualizarProducto, eliminarProducto } = useData();
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) return setError("Escribe el nombre del producto.");
    if (!form.precio || Number(form.precio) < 0) return setError("Ingresa un precio válido.");

    const datos = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim(),
      precio: Number(form.precio),
      stock: Number(form.stock) || 0,
      stockMinimo: Number(form.stockMinimo) || 0,
    };

    if (editandoId) {
      await actualizarProducto(editandoId, datos);
    } else {
      await agregarProducto(datos);
    }
    setForm(VACIO);
    setEditandoId(null);
  }

  function editar(p) {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre || "",
      categoria: p.categoria || "",
      precio: String(p.precio ?? ""),
      stock: String(p.stock ?? ""),
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
        <p>Carga tus productos y su precio. El stock se descuenta solo con cada venta.</p>
      </header>

      <form className="formulario" onSubmit={enviar}>
        <div className="formulario__fila">
          <label>
            Producto
            <input
              value={form.nombre}
              onChange={(e) => actualizar("nombre", e.target.value)}
              placeholder="Ej: Pique macho"
              required
            />
          </label>
          <label>
            Categoría
            <input
              value={form.categoria}
              onChange={(e) => actualizar("categoria", e.target.value)}
              placeholder="Ej: Platos, Bebidas"
            />
          </label>
        </div>
        <div className="formulario__fila">
          <label>
            Precio (Bs)
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.precio}
              onChange={(e) => actualizar("precio", e.target.value)}
              required
            />
          </label>
          <label>
            Stock inicial
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => actualizar("stock", e.target.value)}
            />
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
        {error && <div className="formulario__error">{error}</div>}
        <div className="formulario__acciones">
          <button type="submit" className="boton boton--primario">
            {editandoId ? "Guardar cambios" : "Agregar producto"}
          </button>
          {editandoId && (
            <button
              type="button"
              className="boton boton--fantasma"
              onClick={() => {
                setEditandoId(null);
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
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className={(p.stock ?? 0) <= (p.stockMinimo ?? 3) ? "tabla__fila--alerta" : ""}>
                  <td>{p.nombre}</td>
                  <td>{p.categoria || "—"}</td>
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
