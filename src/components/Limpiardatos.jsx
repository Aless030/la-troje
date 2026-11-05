import { useState } from "react";
import { useData } from "../context/DataContext";
import { descargarRespaldoXLSX } from "../utils/xlsx";

// Lo que se puede limpiar. El inventario (productos y existencias) y los usuarios nunca se tocan.
const GRUPOS = [
  { id: "ventas", etiqueta: "Ventas", detalle: "Todas las comandas (también las anuladas)", colecciones: ["ventas"], marcado: true },
  { id: "cajas", etiqueta: "Cajas, turnos y cierres", detalle: "Aperturas de caja (cerradas), cierres y gastos de caja", colecciones: ["aperturasCaja", "cierres", "gastosCaja"], marcado: true },
  { id: "movimientos", etiqueta: "Movimientos de caja", detalle: "Sueldos, proveedores, facturas e ingresos", colecciones: ["movimientos"], marcado: true },
  { id: "semanales", etiqueta: "Semanales", detalle: "Ingresos y gastos de la semana", colecciones: ["ingresos", "gastos"], marcado: true },
  { id: "distribucion", etiqueta: "Historial de distribución", detalle: "Solo el historial; el stock de las barras no cambia", colecciones: ["movimientosBarra"], marcado: false },
  { id: "ajustes", etiqueta: "Ajustes de inventario (Reportes)", detalle: "Solo el historial de ajustes", colecciones: ["ajustesInventario"], marcado: false },
  { id: "compras", etiqueta: "Historial de compras", detalle: "Solo el historial; el stock no cambia", colecciones: ["comprasInventario"], marcado: false },
];

const NOMBRE_HOJA = {
  ventas: "Ventas",
  aperturasCaja: "Cajas abiertas y cerradas",
  cierres: "Cierres de caja",
  gastosCaja: "Gastos de caja",
  movimientos: "Movimientos de caja",
  ingresos: "Ingresos semanales",
  gastos: "Gastos semanales",
  movimientosBarra: "Distribucion",
  ajustesInventario: "Ajustes de inventario",
  comprasInventario: "Compras",
};

const PALABRA = "LIMPIAR";

const fechaCorta = (ms) => new Date(ms).toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" });

export default function LimpiarDatos() {
  const { limpiarColecciones, leerAnterioresA, borrarDocumentos } = useData();
  const [marcados, setMarcados] = useState(() => Object.fromEntries(GRUPOS.map((g) => [g.id, g.marcado])));
  const [meses, setMeses] = useState("2");
  const [texto, setTexto] = useState("");
  const [textoAvanzado, setTextoAvanzado] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  // Lo que ya se respaldó y está listo para borrar: { porColeccion, total, limite }
  const [respaldado, setRespaldado] = useState(null);

  const elegidos = GRUPOS.filter((g) => marcados[g.id]);
  const confirmado = texto.trim().toUpperCase() === PALABRA;
  const confirmadoAvanzado = textoAvanzado.trim().toUpperCase() === PALABRA;

  function cambiar(fn) {
    setRespaldado(null); // si cambias algo, hay que volver a respaldar
    setMensaje("");
    setError("");
    fn();
  }

  // Paso 1: lee lo anterior a la fecha, lo descarga en Excel y lo deja listo para borrar.
  async function respaldar() {
    setError("");
    setMensaje("");
    setRespaldado(null);
    setTrabajando(true);
    try {
      const limite = new Date();
      limite.setMonth(limite.getMonth() - Number(meses));
      const limiteMs = limite.getTime();
      const porColeccion = await leerAnterioresA(elegidos.flatMap((g) => g.colecciones), limiteMs);
      const total = Object.values(porColeccion).reduce((a, l) => a + l.length, 0);
      if (total === 0) {
        setMensaje(`No hay registros anteriores al ${fechaCorta(limiteMs)}. No hace falta limpiar todavía.`);
        return;
      }
      const hojas = Object.entries(porColeccion).map(([nombre, filas]) => ({ nombre: NOMBRE_HOJA[nombre] || nombre, filas }));
      const hoy = new Date().toISOString().slice(0, 10);
      const ok = await descargarRespaldoXLSX(`respaldo-la-troje-hasta-${new Date(limiteMs).toISOString().slice(0, 10)}-(${hoy})`, hojas);
      if (!ok) throw new Error("respaldo vacío");
      setRespaldado({ porColeccion, total, limite: limiteMs });
    } catch (err) {
      console.error(err);
      setError("No se pudo preparar el respaldo, así que no se borró nada. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  // Paso 2: borra exactamente lo que se respaldó.
  async function borrarRespaldado() {
    setError("");
    setMensaje("");
    setTrabajando(true);
    try {
      const n = await borrarDocumentos(respaldado.porColeccion);
      setMensaje(`Listo: se borraron ${n} registro(s) anteriores al ${fechaCorta(respaldado.limite)}. Tu respaldo quedó en el archivo Excel descargado. El inventario y los usuarios no se tocaron.`);
      setRespaldado(null);
      setTexto("");
    } catch (err) {
      console.error(err);
      setError("No se pudo terminar de borrar (puede que se haya borrado solo una parte). Tienes el respaldo descargado; vuelve a intentar.");
    } finally {
      setTrabajando(false);
    }
  }

  // Avanzado: borra TODO lo marcado, sin importar la fecha.
  async function limpiarTodo() {
    if (!window.confirm("Esto borra TODO lo marcado, de cualquier fecha, y no hay respaldo automático.\n\n¿Seguro?")) return;
    setError("");
    setMensaje("");
    setTrabajando(true);
    try {
      const n = await limpiarColecciones(elegidos.flatMap((g) => g.colecciones));
      setMensaje(`Listo: se borraron ${n} registro(s). El inventario y los usuarios no se tocaron.`);
      setTextoAvanzado("");
    } catch (err) {
      console.error(err);
      setError("No se pudo limpiar. Revisa tu conexión e intenta de nuevo (puede que se haya borrado solo una parte).");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <section className="formulario limpiar-datos">
      <h2>Limpieza mensual con respaldo</h2>
      <p className="texto-vacio" style={{ margin: 0 }}>
        Borra lo más antiguo para que la app siga rápida, y antes descarga un <strong>respaldo en Excel</strong> de
        lo que se va a borrar. <strong>El inventario (productos y stock), los usuarios y el recetario no se tocan</strong>,
        ni las cajas que sigan abiertas. Hazlo con las cajas cerradas (por ejemplo lunes o martes).
      </p>

      <label>
        Borrar lo anterior a
        <select value={meses} onChange={(e) => cambiar(() => setMeses(e.target.value))}>
          <option value="1">hace 1 mes</option>
          <option value="2">hace 2 meses (recomendado)</option>
          <option value="3">hace 3 meses</option>
          <option value="6">hace 6 meses</option>
        </select>
      </label>

      <div className="limpiar-datos__lista">
        {GRUPOS.map((g) => (
          <label key={g.id} className="limpiar-datos__opcion">
            <input
              type="checkbox"
              checked={marcados[g.id]}
              onChange={(e) => cambiar(() => setMarcados((m) => ({ ...m, [g.id]: e.target.checked })))}
            />
            <span>
              <strong>{g.etiqueta}</strong>
              <small>{g.detalle}</small>
            </span>
          </label>
        ))}
      </div>

      <button type="button" className="boton boton--primario" disabled={trabajando || elegidos.length === 0} onClick={respaldar}>
        {trabajando && !respaldado ? "Preparando…" : "1. Descargar respaldo en Excel"}
      </button>

      {respaldado && (
        <>
          <div className="formulario__error formulario__error--exito">
            Respaldo descargado: {respaldado.total} registro(s) anteriores al {fechaCorta(respaldado.limite)}. Revisa que el
            archivo Excel se haya guardado en tu dispositivo antes de borrar.
          </div>
          <label>
            Para borrar lo respaldado, escribe <strong>{PALABRA}</strong>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={PALABRA} autoComplete="off" />
          </label>
          <button type="button" className="boton boton--peligro" disabled={!confirmado || trabajando} onClick={borrarRespaldado}>
            {trabajando ? "Borrando…" : `2. Borrar los ${respaldado.total} registros respaldados`}
          </button>
        </>
      )}

      {error && <div className="formulario__error">{error}</div>}
      {mensaje && <div className="formulario__error formulario__error--exito">{mensaje}</div>}

      <details>
        <summary style={{ cursor: "pointer", color: "var(--texto-suave)", fontSize: 13 }}>Opción avanzada: borrar todo lo marcado (sin respaldo)</summary>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <label>
            Escribe <strong>{PALABRA}</strong> para confirmar
            <input value={textoAvanzado} onChange={(e) => setTextoAvanzado(e.target.value)} placeholder={PALABRA} autoComplete="off" />
          </label>
          <button type="button" className="boton boton--peligro" disabled={!confirmadoAvanzado || trabajando || elegidos.length === 0} onClick={limpiarTodo}>
            Borrar TODO lo marcado, de cualquier fecha
          </button>
        </div>
      </details>
    </section>
  );
}