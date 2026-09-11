import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { descargarCSV } from "../utils/csv";

const CATEGORIAS_GASTO = ["agua", "luz", "internet", "sueldos", "planillas", "otro"];

function inicioSemana() {
  const hoy = new Date();
  const dia = hoy.getDay() === 0 ? 7 : hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia - 1));
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function estaEnSemanaActual(fechaIso) {
  const inicio = inicioSemana();
  const f = new Date(fechaIso);
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 7);
  return f >= inicio && f < fin;
}

export default function Semanales() {
  const { ingresos, gastos, registrarIngreso, registrarGasto } = useData();

  const [ingresoForm, setIngresoForm] = useState({ tipo: "efectivo", monto: "", descripcion: "" });
  const [gastoForm, setGastoForm] = useState({ categoria: "agua", monto: "", descripcion: "" });
  const [error, setError] = useState("");

  const ingresosSemana = useMemo(() => ingresos.filter((i) => estaEnSemanaActual(i.fecha)), [ingresos]);
  const gastosSemana = useMemo(() => gastos.filter((g) => estaEnSemanaActual(g.fecha)), [gastos]);

  const totales = useMemo(() => {
    const totalIngresos = ingresosSemana.reduce((s, i) => s + i.monto, 0);
    const totalIngresosQr = ingresosSemana.filter((i) => i.tipo === "qr").reduce((s, i) => s + i.monto, 0);
    const totalIngresosEfectivo = ingresosSemana.filter((i) => i.tipo === "efectivo").reduce((s, i) => s + i.monto, 0);
    const totalGastos = gastosSemana.reduce((s, g) => s + g.monto, 0);
    const porCategoria = {};
    gastosSemana.forEach((g) => {
      porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.monto;
    });
    return {
      totalIngresos,
      totalIngresosQr,
      totalIngresosEfectivo,
      totalGastos,
      porCategoria,
      balance: totalIngresos - totalGastos,
    };
  }, [ingresosSemana, gastosSemana]);

  async function enviarIngreso(e) {
    e.preventDefault();
    setError("");
    if (!ingresoForm.monto || Number(ingresoForm.monto) <= 0) return setError("Ingresa un monto válido.");
    await registrarIngreso({
      fecha: new Date().toISOString(),
      tipo: ingresoForm.tipo,
      monto: Number(ingresoForm.monto),
      descripcion: ingresoForm.descripcion.trim(),
    });
    setIngresoForm({ tipo: "efectivo", monto: "", descripcion: "" });
  }

  async function enviarGasto(e) {
    e.preventDefault();
    setError("");
    if (!gastoForm.monto || Number(gastoForm.monto) <= 0) return setError("Ingresa un monto válido.");
    await registrarGasto({
      fecha: new Date().toISOString(),
      categoria: gastoForm.categoria,
      monto: Number(gastoForm.monto),
      descripcion: gastoForm.descripcion.trim(),
    });
    setGastoForm({ categoria: "agua", monto: "", descripcion: "" });
  }

  function exportar() {
    const filas = [
      ...ingresosSemana.map((i) => ({
        fecha: new Date(i.fecha).toLocaleDateString("es-BO"),
        movimiento: "Ingreso",
        detalle: `${i.tipo}${i.descripcion ? " — " + i.descripcion : ""}`,
        monto: i.monto.toFixed(2),
      })),
      ...gastosSemana.map((g) => ({
        fecha: new Date(g.fecha).toLocaleDateString("es-BO"),
        movimiento: "Gasto",
        detalle: `${g.categoria}${g.descripcion ? " — " + g.descripcion : ""}`,
        monto: g.monto.toFixed(2),
      })),
    ];
    descargarCSV(
      "semanal",
      [
        { titulo: "Fecha", clave: "fecha" },
        { titulo: "Movimiento", clave: "movimiento" },
        { titulo: "Detalle", clave: "detalle" },
        { titulo: "Monto", clave: "monto" },
      ],
      filas
    );
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Semanales</h1>
        <p>Ingresos (efectivo o QR) y gastos (agua, luz, internet, sueldos, planillas) de esta semana.</p>
      </header>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ingresos efectivo</span>
          <span className="tarjeta-metrica__valor">Bs {totales.totalIngresosEfectivo.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ingresos QR</span>
          <span className="tarjeta-metrica__valor">Bs {totales.totalIngresosQr.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Gastos totales</span>
          <span className="tarjeta-metrica__valor">Bs {totales.totalGastos.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Balance semanal</span>
          <span className="tarjeta-metrica__valor">Bs {totales.balance.toFixed(2)}</span>
        </div>
      </div>

      <div className="columnas-dos">
        <form className="formulario" onSubmit={enviarIngreso}>
          <h2>Nuevo ingreso</h2>
          <label>
            Tipo
            <select value={ingresoForm.tipo} onChange={(e) => setIngresoForm((f) => ({ ...f, tipo: e.target.value }))}>
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
            </select>
          </label>
          <label>
            Monto (Bs)
            <input
              type="number"
              step="0.01"
              min="0"
              value={ingresoForm.monto}
              onChange={(e) => setIngresoForm((f) => ({ ...f, monto: e.target.value }))}
              required
            />
          </label>
          <label>
            Descripción (opcional)
            <input
              value={ingresoForm.descripcion}
              onChange={(e) => setIngresoForm((f) => ({ ...f, descripcion: e.target.value }))}
            />
          </label>
          <button type="submit" className="boton boton--primario">Registrar ingreso</button>
        </form>

        <form className="formulario" onSubmit={enviarGasto}>
          <h2>Nuevo gasto</h2>
          <label>
            Categoría
            <select value={gastoForm.categoria} onChange={(e) => setGastoForm((f) => ({ ...f, categoria: e.target.value }))}>
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Monto (Bs)
            <input
              type="number"
              step="0.01"
              min="0"
              value={gastoForm.monto}
              onChange={(e) => setGastoForm((f) => ({ ...f, monto: e.target.value }))}
              required
            />
          </label>
          <label>
            Descripción (opcional)
            <input
              value={gastoForm.descripcion}
              onChange={(e) => setGastoForm((f) => ({ ...f, descripcion: e.target.value }))}
            />
          </label>
          <button type="submit" className="boton boton--primario">Registrar gasto</button>
        </form>
      </div>

      {error && <div className="formulario__error">{error}</div>}

      <button className="boton boton--fantasma" onClick={exportar}>Descargar CSV de la semana</button>
    </div>
  );
}
