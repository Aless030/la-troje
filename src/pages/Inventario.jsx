import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";

const FAMILIAS = ["Licores", "Cervezas", "Refrescos", "Energizantes", "Vinos", "Comida"];
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
  precioVaso: "",
  unidadVenta: "Botella",
  stockMinimo: "3",
  destino: "general",
  factura: "",
  // Solo al editar: cantidad en cada ubicación.
  stockGeneral: "",
  stockInterior: "",
  stockSemicubierto: "",
};

const redondear4 = (n) => Math.round(Number(n || 0) * 10000) / 10000;

// Celda de stock editable en la tabla (−, número, +). Se usa para Almacén, Interior y Semicubierto.
function CeldaStock({ valor, onCambiar }) {
  const actual = Number(valor || 0);
  return (
    <div className="ajuste-stock">
      <button type="button" onClick={() => onCambiar(Math.max(0, actual - 1))}>−</button>
      <input
        key={`stock-${actual}`}
        type="number"
        step="0.01"
        min="0"
        className="celda-editable celda-editable--stock"
        defaultValue={actual.toFixed(2)}
        onBlur={(e) => {
          const nuevo = Math.max(0, Number(e.target.value) || 0);
          if (nuevo !== actual) onCambiar(nuevo);
        }}
      />
      <button type="button" onClick={() => onCambiar(actual + 1)}>+</button>
    </div>
  );
}

export default function Inventario() {
  const { productos, comprasInventario, actualizarProducto, eliminarProducto, registrarCompra, ponerStockEnCero } = useData();
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [avisoAuto, setAvisoAuto] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  // Stock de cada ubicación al abrir la edición (para no pisar ventas hechas mientras se edita).
  const [stockOriginalEdicion, setStockOriginalEdicion] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  // Filtros del historial de compras (qué se registró en el inventario y cuándo).
  const [compraDesde, setCompraDesde] = useState("");
  const [compraHasta, setCompraHasta] = useState("");
  const [compraBusqueda, setCompraBusqueda] = useState("");
  const [compraDestino, setCompraDestino] = useState("todos");

  const esBebida = form.familia !== "Comida";
  const esCaja = form.tipoEmpaque === "caja";

  function actualizar(campo, valor) {
    if (campo === "nombre" && !editandoId) {
      const nombreBuscado = valor.trim().toLowerCase();
      const existente = productos.find(
        (p) => (p.nombre || "").trim().toLowerCase() === nombreBuscado
      );

      if (existente) {
        setForm((f) => ({
          ...f,
          nombre: existente.nombre || valor,
          familia: existente.familia || "Licores",
          volumenCantidad: String(existente.volumenCantidad ?? ""),
          volumenUnidad: existente.volumenUnidad || "ml",
          tipoEmpaque: existente.tipoEmpaque || "botella",
          botellasPorCaja: String(existente.botellasPorCaja ?? ""),
          precio: String(existente.precio ?? ""),
          precioCaja: String(existente.precioCaja ?? ""),
          precioVenta: String(existente.precioVenta ?? existente.precio ?? ""),
          precioVaso: String(existente.precioVaso ?? ""),
          unidadVenta: existente.unidadVenta || "Botella",
          stockMinimo: String(existente.stockMinimo ?? "3"),
          cantidadBotellas: "",
          cantidadCajas: "",
          botellasSueltas: "",
          factura: "",
          destino: f.destino || "general",
        }));
        setAvisoAuto(
          `Producto encontrado: se cargaron automáticamente los datos guardados de "${existente.nombre}". Solo completa la cantidad, la factura y el almacén destino.`
        );
        return;
      }

      setForm((f) => ({ ...f, nombre: valor }));
      setAvisoAuto("");
      return;
    }

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
      precioVaso: Number(Number(form.precioVaso || 0).toFixed(2)),
      unidadVenta: form.unidadVenta.trim() || "Botella",
      stockMinimo: Number(form.stockMinimo) || 0,
    };

    if (editandoId) {
      // En edición cada ubicación (Almacén general, Interior, Semicubierto) se edita por
      // separado. Se aplica solo la DIFERENCIA sobre el stock actual de cada una, así si se
      // vendió algo mientras estaba abierta la edición, esa venta no se pierde.
      const productoActual = productos.find((p) => p.id === editandoId);
      const original = stockOriginalEdicion || {
        general: Number(productoActual?.stock || 0),
        interior: Number(productoActual?.stockInterior || 0),
        semicubierto: Number(productoActual?.stockSemicubierto || 0),
      };
      const aplicar = (actual, antes, escrito) =>
        Math.max(0, redondear4(Number(actual || 0) + (Math.max(0, Number(escrito) || 0) - antes)));
      const nuevoGeneral = aplicar(productoActual?.stock, original.general, form.stockGeneral);
      const nuevoInterior = aplicar(productoActual?.stockInterior, original.interior, form.stockInterior);
      const nuevoSemicubierto = aplicar(productoActual?.stockSemicubierto, original.semicubierto, form.stockSemicubierto);

      await actualizarProducto(editandoId, {
        ...datos,
        stock: nuevoGeneral,
        stockInterior: nuevoInterior,
        stockSemicubierto: nuevoSemicubierto,
      });
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
    setStockOriginalEdicion(null);
    setAvisoAuto("");
  }

  function editar(p) {
    const stockTotal =
      Number(p.stock || 0) +
      Number(p.stockInterior || 0) +
      Number(p.stockSemicubierto || 0);

    setEditandoId(p.id);
    setStockOriginalEdicion({
      general: Number(p.stock || 0),
      interior: Number(p.stockInterior || 0),
      semicubierto: Number(p.stockSemicubierto || 0),
    });
    setAvisoAuto("");
    setForm({
      nombre: p.nombre || "",
      familia: p.familia || "Licores",
      volumenCantidad: String(p.volumenCantidad ?? ""),
      volumenUnidad: p.volumenUnidad || "ml",
      // Al editar mostramos la cantidad TOTAL existente en todas las ubicaciones.
      tipoEmpaque: "botella",
      cantidadBotellas: String(Number(stockTotal.toFixed(2))),
      cantidadCajas: "",
      botellasPorCaja: String(p.botellasPorCaja ?? ""),
      botellasSueltas: "",
      precio: String(p.precio ?? ""),
      precioCaja: "",
      precioVenta: String(p.precioVenta ?? p.precio ?? ""),
      precioVaso: String(p.precioVaso ?? ""),
      unidadVenta: p.unidadVenta || "Botella",
      stockMinimo: String(p.stockMinimo ?? "3"),
      destino: "general",
      factura: "",
      stockGeneral: String(redondear4(p.stock)),
      stockInterior: String(redondear4(p.stockInterior)),
      stockSemicubierto: String(redondear4(p.stockSemicubierto)),
    });
  }

  async function reiniciarTodoEnCero() {
    if (productos.length === 0) return;
    const ok = window.confirm(
      `Vas a dejar en 0 el stock de ${productos.length} producto(s) (almacén, interior y semicubierto).\n\nLos productos, precios y recetas NO se borran, pero esto no se puede deshacer.\n\n¿Continuar?`
    );
    if (!ok) return;
    try {
      const n = await ponerStockEnCero();
      window.alert(`Listo: ${n} producto(s) con stock en 0.`);
    } catch (e) {
      console.error(e);
      window.alert("No se pudo reiniciar el stock. Revisa tu conexión e intenta de nuevo.");
    }
  }

  // Edición directa de una ubicación desde la tabla: "stock" (almacén), "stockInterior" o "stockSemicubierto".
  async function guardarStock(p, campo, nuevo) {
    await actualizarProducto(p.id, { [campo]: Math.max(0, redondear4(nuevo)) });
  }

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const lista = texto
      ? productos.filter(
          (p) =>
            (p.nombre || "").toLowerCase().includes(texto) ||
            (p.familia || "").toLowerCase().includes(texto)
        )
      : [...productos];

    return lista.sort((a, b) =>
      (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
    );
  }, [productos, busqueda]);

  const hayFiltroCompras = Boolean(compraDesde || compraHasta || compraBusqueda.trim() || compraDestino !== "todos");
  const comprasFiltradas = useMemo(() => {
    const desde = compraDesde ? new Date(`${compraDesde}T00:00:00`).getTime() : null;
    const hasta = compraHasta ? new Date(`${compraHasta}T23:59:59.999`).getTime() : null;
    const q = compraBusqueda.trim().toLowerCase();
    return [...comprasInventario]
      .filter((c) => {
        const t = new Date(c.fecha).getTime();
        if (desde !== null && !(t >= desde)) return false;
        if (hasta !== null && !(t <= hasta)) return false;
        if (compraDestino !== "todos" && c.destino !== compraDestino) return false;
        if (q && !`${c.producto || ""} ${c.factura || ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (new Date(b.fecha).getTime() || 0) - (new Date(a.fecha).getTime() || 0));
  }, [comprasInventario, compraDesde, compraHasta, compraBusqueda, compraDestino]);
  // Sin filtros se muestran las últimas 15; con filtros, todo lo que coincida.
  const comprasRecientes = useMemo(
    () => (hayFiltroCompras ? comprasFiltradas : comprasFiltradas.slice(0, 15)),
    [hayFiltroCompras, comprasFiltradas]
  );

  // Estado de cada producto según su existencia total (almacén + barras).
  function estadoStock(p) {
    const total = Number(p.stock || 0) + Number(p.stockInterior || 0) + Number(p.stockSemicubierto || 0);
    if (total <= 0) return { clave: "agotado", etiqueta: "Agotado" };
    if (total <= Number(p.stockMinimo ?? 3)) return { clave: "poco", etiqueta: "Poco stock" };
    return { clave: "ok", etiqueta: "Stock OK" };
  }

  // Valor actual de todas las existencias, usando el precio de compra unitario.
  const valorTotalCompra = useMemo(() =>
    productos.reduce((total, p) => {
      const stockTotal = Number(p.stock || 0) + Number(p.stockInterior || 0) + Number(p.stockSemicubierto || 0);
      return total + stockTotal * Number(p.precio || 0);
    }, 0),
  [productos]);

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
                step="0.01"
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
                <option value="lata">Lata</option>
              </select>
            </label>
          </div>
        )}

        {esBebida && esCaja ? (
          <div className="formulario__fila">
            {!editandoId && (
              <label>
                Cantidad de cajas
                <input
                  type="number"
                  min="0"
                  value={form.cantidadCajas}
                  onChange={(e) => actualizar("cantidadCajas", e.target.value)}
                />
              </label>
            )}
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
            {!editandoId && (
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
            )}
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
            {!editandoId && (
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
            )}
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
              type="text"
              inputMode="decimal"
              value={form.precioVenta}
              onChange={(e) => {
                const valor = e.target.value.replace(",", ".");
                if (/^\d*(\.\d{0,2})?$/.test(valor)) actualizar("precioVenta", valor);
              }}
              placeholder="Ej: 35.00"
              required
            />
          </label>
          <label>
            Precio por vaso (Bs, opcional)
            <input
              type="text"
              inputMode="decimal"
              value={form.precioVaso}
              onChange={(e) => {
                const valor = e.target.value.replace(",", ".");
                if (/^\d*(\.\d{0,2})?$/.test(valor)) actualizar("precioVaso", valor);
              }}
              placeholder="Ej: 15.00 (si lo vendes por vaso)"
            />
          </label>
        </div>

        {editandoId ? (
          <div className="formulario__fila">
            <label>
              Almacén general
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.stockGeneral}
                onChange={(e) => actualizar("stockGeneral", e.target.value)}
              />
            </label>
            <label>
              Interior
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.stockInterior}
                onChange={(e) => actualizar("stockInterior", e.target.value)}
              />
            </label>
            <label>
              Semicubierto
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.stockSemicubierto}
                onChange={(e) => actualizar("stockSemicubierto", e.target.value)}
              />
            </label>
          </div>
        ) : (
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
            {editandoId ? "Stock total (suma de las 3 ubicaciones)" : "Cantidad total que entra"}
            <input
              type="text"
              value={
                editandoId
                  ? `${redondear4(
                      (Number(form.stockGeneral) || 0) +
                        (Number(form.stockInterior) || 0) +
                        (Number(form.stockSemicubierto) || 0)
                    )} unidad(es)`
                  : `${cantidadTotal} unidad(es)`
              }
              disabled
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
                setStockOriginalEdicion(null);
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
        <button
          type="button"
          className="boton boton--enlace boton--peligro"
          onClick={reiniciarTodoEnCero}
          disabled={productos.length === 0}
        >
          Poner todo el stock en 0
        </button>
        <p className="texto-vacio">
          Puedes cambiar la cantidad de cada producto directo en la tabla, por ubicación: Almacén, Interior o Semicubierto.
        </p>
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
                <tr key={p.id} className={`inv-fila inv-fila--${estadoStock(p).clave}`}>
                  <td>
                    {p.nombre}
                    <span className={`inv-chip inv-chip--${estadoStock(p).clave}`}>{estadoStock(p).etiqueta}</span>
                  </td>
                  <td className="tabla__etiqueta">{p.familia || "—"}</td>
                  <td className="tabla__etiqueta">{p.unidadVenta || "Botella"}</td>
                  <td>Bs {Number(p.precio || 0).toFixed(2)}</td>
                  <td>
                    <input
                      key={`precioVenta-${p.id}-${p.precioVenta}`}
                      type="text"
                      inputMode="decimal"
                      className="celda-editable"
                      defaultValue={p.precioVenta ?? p.precio ?? 0}
                      onChange={(e) => {
                        e.target.value = e.target.value.replace(",", ".");
                      }}
                      onBlur={(e) => {
                        const numero = Number(e.target.value);
                        const nuevo = Number.isFinite(numero)
                          ? Math.round((numero + Number.EPSILON) * 100) / 100
                          : 0;
                        e.target.value = String(nuevo);
                        if (nuevo !== Number(p.precioVenta ?? p.precio ?? 0)) {
                          actualizarProducto(p.id, { precioVenta: nuevo });
                        }
                      }}
                    />
                  </td>
                  <td><CeldaStock valor={p.stock} onCambiar={(n) => guardarStock(p, "stock", n)} /></td>
                  <td><CeldaStock valor={p.stockInterior} onCambiar={(n) => guardarStock(p, "stockInterior", n)} /></td>
                  <td><CeldaStock valor={p.stockSemicubierto} onCambiar={(n) => guardarStock(p, "stockSemicubierto", n)} /></td>
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
        <div className="inventario-total-compra">
          <strong>Total del inventario a precio de compra:</strong> Bs {valorTotalCompra.toFixed(2)}
        </div>
      </section>

      <section className="lista-reciente">
        <h2>{hayFiltroCompras ? `Compras registradas (${comprasFiltradas.length})` : "Últimas compras registradas"}</h2>
        <div className="formulario__fila">
          <label>
            Desde
            <input type="date" value={compraDesde} max={compraHasta || undefined} onChange={(e) => setCompraDesde(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={compraHasta} min={compraDesde || undefined} onChange={(e) => setCompraHasta(e.target.value)} />
          </label>
          <label>
            Destino
            <select value={compraDestino} onChange={(e) => setCompraDestino(e.target.value)}>
              <option value="todos">Todos</option>
              {DESTINOS.map((d) => (
                <option key={d.valor} value={d.valor}>{d.etiqueta}</option>
              ))}
            </select>
          </label>
          <label>
            Producto o factura
            <input value={compraBusqueda} onChange={(e) => setCompraBusqueda(e.target.value)} placeholder="Buscar…" />
          </label>
        </div>
        {hayFiltroCompras && (
          <button
            type="button"
            className="boton boton--enlace"
            onClick={() => { setCompraDesde(""); setCompraHasta(""); setCompraBusqueda(""); setCompraDestino("todos"); }}
          >
            Quitar filtros
          </button>
        )}
        {comprasRecientes.length === 0 ? (
          <p className="texto-vacio">
            {comprasInventario.length === 0 ? "Todavía no hay compras registradas." : "Ninguna compra coincide con los filtros."}
          </p>
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