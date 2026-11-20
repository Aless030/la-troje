import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useData } from "../context/DataContext";
import { BARRAS } from "../utils/barras";
import SelectorProducto from "./SelectorProducto";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Qué acompañante lleva cada bebida (por palabras del nombre). `buscar` identifica el acompañante en el inventario.
const MEZCLADORES = {
  coca: { nombre: "Coca Cola 2L retornable", buscar: (n) => n.includes("coca"), preferir: (n) => (n.includes("2") || n.includes("retorn") ? 1 : 0) },
  schweppes: { nombre: "Schweppes", buscar: (n) => n.includes("schweppes") && !n.includes("tonica"), preferir: () => 0 },
  sprite: { nombre: "Sprite", buscar: (n) => n.includes("sprite"), preferir: () => 0 },
  tonica: { nombre: "Agua tónica", buscar: (n) => n.includes("tonica"), preferir: (n) => (n.includes("agua") ? 1 : 0) },
};
const REGLAS = [
  { si: (n) => /\bron\b/.test(n), mezclador: "coca", texto: "Ron" },
  { si: (n) => n.includes("parrales"), mezclador: "schweppes", texto: "Parrales" },
  { si: (n) => n.includes("viuda descalza"), mezclador: "schweppes", texto: "Viuda Descalza" },
  { si: (n) => n.includes("fernet"), mezclador: "coca", texto: "Fernet" },
  { si: (n) => /\bsky\b/.test(n), mezclador: "sprite", texto: "Sky" },
  { si: (n) => n.includes("singani"), mezclador: "schweppes", texto: "Singani" },
  { si: (n) => /\bgin\b/.test(n), mezclador: "tonica", texto: "Gin" },
];

export default function Acompanantes() {
  const { productos, actualizarProducto } = useData();
  const [mensaje, setMensaje] = useState("");
  const [busy, setBusy] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const encontrar = (clave) => {
    const m = MEZCLADORES[clave];
    const cand = productos.filter((p) => m.buscar(norm(p.nombre)));
    cand.sort((a, b) => m.preferir(norm(b.nombre)) - m.preferir(norm(a.nombre)));
    return cand[0] || null;
  };

  const sugerencias = useMemo(() => {
    const lista = [];
    productos.forEach((p) => {
      const regla = REGLAS.find((r) => r.si(norm(p.nombre)));
      if (!regla) return;
      lista.push({ producto: p, regla, mezclador: encontrar(regla.mezclador) });
    });
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos]);

  const faltan = [...new Set(sugerencias.filter((s) => !s.mezclador).map((s) => s.regla.mezclador))];

  async function aplicar() {
    setBusy(true);
    setMensaje("");
    try {
      let n = 0;
      for (const s of sugerencias) {
        if (!s.mezclador || s.producto.acompananteId) continue; // no pisa lo que ya configuraron
        await actualizarProducto(s.producto.id, { acompananteId: s.mezclador.id, acompananteCantidad: 1 });
        n += 1;
      }
      setMensaje(`Listo: se asignó acompañante a ${n} producto${n === 1 ? "" : "s"}.${faltan.length ? " Faltan crear algunos acompañantes (ver abajo)." : ""}`);
    } catch (e) {
      console.error(e);
      setMensaje("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function crearFaltantes() {
    setBusy(true);
    setMensaje("");
    try {
      for (const clave of faltan) {
        const m = MEZCLADORES[clave];
        await addDoc(collection(db, "productos"), {
          nombre: m.nombre,
          familia: "Refrescos",
          volumenCantidad: 2,
          volumenUnidad: "l",
          tipoEmpaque: "botella",
          botellasPorCaja: 0,
          precio: 0,
          precioCaja: 0,
          precioVenta: 0,
          precioVaso: 0,
          unidadVenta: "Botella",
          stockMinimo: 3,
          stock: 0,
          ...Object.fromEntries(BARRAS.map((b) => [b.campo, 0])),
          creadoEn: serverTimestamp(),
        });
      }
      setMensaje(`Se crearon: ${faltan.map((c) => MEZCLADORES[c].nombre).join(", ")}. Entra a Inventario y pon su precio de compra y registra la compra para cargar el stock; luego pulsa «Asignar sugeridos».`);
    } catch (e) {
      console.error(e);
      setMensaje("No se pudieron crear. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const q = norm(busqueda).trim();
  const filas = productos
    .filter((p) => !q || norm(p.nombre).includes(q))
    .sort((a, b) => (b.acompananteId ? 1 : 0) - (a.acompananteId ? 1 : 0) || a.nombre.localeCompare(b.nombre, "es"));
  const opciones = productos.map((p) => ({ id: p.id, nombre: p.nombre, detalle: p.familia || "" }));

  return (
    <section className="lista-reciente acomp">
      <h2>Acompañantes (se descuentan solos)</h2>
      <p className="texto-vacio">
        Al vender una <strong>botella</strong> de una bebida, el sistema descuenta también su acompañante del inventario de esa barra
        (por ejemplo, Fernet → 1 Coca Cola 2L). No se descuenta al vender por vaso ni en los tragos de recetario.
      </p>

      <div className="acomp__sugeridos">
        <p><strong>Sugeridos:</strong> Ron → Coca Cola · Parrales → Schweppes · Viuda Descalza → Schweppes · Fernet → Coca Cola · Sky → Sprite · Singani → Schweppes · Gin → Agua tónica.</p>
        <p className="texto-vacio">
          Encontré {sugerencias.length} producto{sugerencias.length === 1 ? "" : "s"} del inventario que coinciden
          {faltan.length > 0 && <> · No encuentro en el inventario: <strong>{faltan.map((c) => MEZCLADORES[c].nombre).join(", ")}</strong></>}.
        </p>
        <div className="formulario__acciones">
          <button type="button" className="boton boton--primario" onClick={aplicar} disabled={busy || sugerencias.length === 0}>Asignar sugeridos</button>
          {faltan.length > 0 && (
            <button type="button" className="boton" onClick={crearFaltantes} disabled={busy}>Crear los que faltan (stock 0)</button>
          )}
        </div>
        {mensaje && <div className="formulario__error formulario__error--exito">{mensaje}</div>}
      </div>

      <label>
        Buscar producto
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej: fernet, ron…" />
      </label>

      <div className="acomp__lista">
        {filas.map((p) => (
          <div className="acomp__fila" key={p.id}>
            <strong>{p.nombre}</strong>
            <SelectorProducto
              etiqueta="Acompañante"
              value={p.acompananteId || ""}
              onChange={(id) => actualizarProducto(p.id, { acompananteId: id || "", acompananteCantidad: id ? Number(p.acompananteCantidad) || 1 : 0 })}
              opciones={opciones.filter((o) => o.id !== p.id)}
              placeholder="Sin acompañante"
            />
            {p.acompananteId && (
              <label className="acomp__cant">
                Cantidad por botella
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  defaultValue={p.acompananteCantidad || 1}
                  key={`${p.id}-${p.acompananteCantidad}`}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (n > 0 && n !== Number(p.acompananteCantidad)) actualizarProducto(p.id, { acompananteCantidad: n });
                  }}
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}