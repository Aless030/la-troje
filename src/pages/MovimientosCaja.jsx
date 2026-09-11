import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { descargarCSV } from "../utils/csv";

const TIPOS = [
  { valor: "sueldo", etiqueta: "Sueldo" },
  { valor: "proveedor", etiqueta: "Proveedor" },
  { valor: "factura", etiqueta: "Factura" },
  { valor: "otro", etiqueta: "Otro" },
];

const VACIO = { tipo: "sueldo", descripcion: "", numeroFactura: "", monto: "" };

export default function MovimientosCaja() {
  const { movimientos, registrarMovimiento } = useData();
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!form.descripcion.trim()) return setError("Describe el movimiento (a quién o qué se paga).");
    if (!form.monto || Number(form.monto) <= 0) return setError("Ingresa un monto válido.");

    setEnviando(true);
    try {
      await registrarMovimiento({
        fecha: new Date().toISOString(),
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        numeroFactura: form.numeroFactura.trim(),
        monto: Number(form.monto),
      });
      setForm(VACIO);
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el movimiento.");
    } finally {
      setEnviando(false);
    }
  }

  const totales = useMemo(() => {
    const porTipo = { sueldo: 0, proveedor: 0, factura: 0, otro: 0 };
    movimientos.forEach((m) => {
      porTipo[m.tipo] = (porTipo[m.tipo] || 0) + m.monto;
    });
    const total = Object.values(porTipo).reduce((a, b) => a + b, 0);
    return { porTipo, total };
  }, [movimientos]);

  function exportarCSV() {
    descargarCSV(
      "movimientos-caja",
      [
        { titulo: "Fecha", clave: "fechaTexto" },
        { titulo: "Tipo", clave: "tipo" },
        { titulo: "Descripción", clave: "descripcion" },
        { titulo: "N° Factura", clave: "numeroFactura" },
        { titulo: "Monto", clave: "monto" },
      ],
      movimientos.map((m) => ({
        ...m,
        fechaTexto: new Date(m.fecha).toLocaleDateString("es-BO"),
        monto: m.monto.toFixed(2),
      }))
    );
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Movimientos de caja</h1>
        <p>Registra sueldos, pagos a proveedores y facturas.</p>
      </header>

      <form className="formulario" onSubmit={enviar}>
        <div className="formulario__fila">
          <label>
            Tipo
            <select value={form.tipo} onChange={(e) => actualizar("tipo", e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descripción
            <input
              value={form.descripcion}
              onChange={(e) => actualizar("descripcion", e.target.value)}
              placeholder="Ej: Sueldo mesero Juan, Proveedor de verduras…"
              required
            />
          </label>
        </div>
        <div className="formulario__fila">
          <label>
            N° de factura (opcional)
            <input
              value={form.numeroFactura}
              onChange={(e) => actualizar("numeroFactura", e.target.value)}
              placeholder="Ej: 00123"
            />
          </label>
          <label>
            Monto (Bs)
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.monto}
              onChange={(e) => actualizar("monto", e.target.value)}
              required
            />
          </label>
        </div>
        {error && <div className="formulario__error">{error}</div>}
        <button type="submit" className="boton boton--primario" disabled={enviando}>
          {enviando ? "Guardando…" : "Registrar movimiento"}
        </button>
      </form>

      <div className="tarjetas-resumen">
        {TIPOS.map((t) => (
          <div className="tarjeta-metrica" key={t.valor}>
            <span className="tarjeta-metrica__etiqueta">{t.etiqueta}s</span>
            <span className="tarjeta-metrica__valor">Bs {(totales.porTipo[t.valor] || 0).toFixed(2)}</span>
          </div>
        ))}
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Total salidas</span>
          <span className="tarjeta-metrica__valor">Bs {totales.total.toFixed(2)}</span>
        </div>
      </div>

      <section className="lista-reciente">
        <h2>Historial</h2>
        {movimientos.length === 0 ? (
          <p className="texto-vacio">Todavía no hay movimientos registrados.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>N° Factura</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.fecha).toLocaleDateString("es-BO")}</td>
                  <td className="tabla__etiqueta">{m.tipo}</td>
                  <td>{m.descripcion}</td>
                  <td>{m.numeroFactura || "—"}</td>
                  <td>Bs {Number(m.monto).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button className="boton boton--fantasma" onClick={exportarCSV} disabled={movimientos.length === 0}>
          Descargar CSV
        </button>
      </section>
    </div>
  );
}
