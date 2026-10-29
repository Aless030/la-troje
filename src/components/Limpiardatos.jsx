import { useState } from "react";
import { useData } from "../context/DataContext";

// Lo que se puede limpiar. El inventario (productos y existencias) y los usuarios nunca se tocan.
const GRUPOS = [
  { id: "ventas", etiqueta: "Ventas", detalle: "Todas las comandas (también las anuladas)", colecciones: ["ventas"], marcado: true },
  { id: "cajas", etiqueta: "Cajas, turnos y cierres", detalle: "Aperturas de caja, cierres y gastos de caja", colecciones: ["aperturasCaja", "cierres", "gastosCaja"], marcado: true },
  { id: "movimientos", etiqueta: "Movimientos de caja", detalle: "Sueldos, proveedores, facturas e ingresos", colecciones: ["movimientos"], marcado: true },
  { id: "semanales", etiqueta: "Semanales", detalle: "Ingresos y gastos de la semana", colecciones: ["ingresos", "gastos"], marcado: true },
  { id: "distribucion", etiqueta: "Historial de distribución", detalle: "Solo el historial; el stock de las barras no cambia", colecciones: ["movimientosBarra"], marcado: false },
  { id: "ajustes", etiqueta: "Ajustes de inventario (Reportes)", detalle: "Solo el historial de ajustes", colecciones: ["ajustesInventario"], marcado: false },
  { id: "compras", etiqueta: "Historial de compras", detalle: "Solo el historial; el stock no cambia", colecciones: ["comprasInventario"], marcado: false },
];

const PALABRA = "LIMPIAR";

export default function LimpiarDatos() {
  const { limpiarColecciones } = useData();
  const [marcados, setMarcados] = useState(() => Object.fromEntries(GRUPOS.map((g) => [g.id, g.marcado])));
  const [texto, setTexto] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const elegidos = GRUPOS.filter((g) => marcados[g.id]);
  const puede = elegidos.length > 0 && texto.trim().toUpperCase() === PALABRA && !trabajando;

  async function limpiar() {
    setError("");
    setMensaje("");
    setTrabajando(true);
    try {
      const n = await limpiarColecciones(elegidos.flatMap((g) => g.colecciones));
      setMensaje(`Listo: se borraron ${n} registro(s). El inventario y los usuarios no se tocaron.`);
      setTexto("");
    } catch (err) {
      console.error(err);
      setError("No se pudo limpiar. Revisa tu conexión e intenta de nuevo (puede que se haya borrado solo una parte).");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <section className="formulario limpiar-datos">
      <h2>Limpiar datos de prueba</h2>
      <p className="texto-vacio" style={{ margin: 0 }}>
        Borra el movimiento del negocio para empezar de cero. <strong>El inventario (productos y stock), los
        usuarios y los tragos del recetario se conservan.</strong> Esto no se puede deshacer.
      </p>

      <div className="limpiar-datos__lista">
        {GRUPOS.map((g) => (
          <label key={g.id} className="limpiar-datos__opcion">
            <input
              type="checkbox"
              checked={marcados[g.id]}
              onChange={(e) => setMarcados((m) => ({ ...m, [g.id]: e.target.checked }))}
            />
            <span>
              <strong>{g.etiqueta}</strong>
              <small>{g.detalle}</small>
            </span>
          </label>
        ))}
      </div>

      <label>
        Para confirmar, escribe <strong>{PALABRA}</strong>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={PALABRA} autoComplete="off" />
      </label>
      {error && <div className="formulario__error">{error}</div>}
      {mensaje && <div className="formulario__error formulario__error--exito">{mensaje}</div>}
      <button type="button" className="boton boton--peligro" disabled={!puede} onClick={limpiar}>
        {trabajando ? "Borrando…" : "Borrar lo seleccionado"}
      </button>
    </section>
  );
}