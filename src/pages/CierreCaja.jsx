import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import ReporteCierre from "../components/ReporteCierre";
import { buscarAperturaActiva, cerrarTurno, construirCierre } from "../utils/cierre";

const ETIQUETAS_DIA = {
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  otro: "Otro",
};

const bs = (n) => `Bs ${Number(n || 0).toFixed(2)}`;

function formatoFechaLarga(fechaIso) {
  return new Date(fechaIso).toLocaleDateString("es-BO", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function CierreCaja() {
  const {
    ventas, cierres, aperturasCaja, gastosCaja,
    registrarCierre, eliminarCierre, limpiarCierresAntiguos, cerrarAperturaCaja,
  } = useData();

  const [cerrando, setCerrando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [filtroDia, setFiltroDia] = useState("todos");
  // Reporte que se está mirando: el que se generó al cerrar, o uno del historial.
  const [reporteVisto, setReporteVisto] = useState(null);

  const aperturaActiva = useMemo(() => buscarAperturaActiva(aperturasCaja), [aperturasCaja]);

  // Vista previa en vivo del turno abierto (aún no está cerrado).
  const vistaPrevia = useMemo(
    () =>
      aperturaActiva
        ? { ...construirCierre({ apertura: aperturaActiva, ventas, gastosCaja }), cerrado: false }
        : null,
    [aperturaActiva, ventas, gastosCaja]
  );

  const historialFiltrado = useMemo(
    () => (filtroDia === "todos" ? cierres : cierres.filter((c) => c.dia === filtroDia)),
    [cierres, filtroDia]
  );

  async function cerrarElTurno() {
    if (!aperturaActiva || cerrando) return;
    if (!window.confirm("¿Cerrar el turno? Se generará el reporte de la cajera y la caja quedará cerrada.")) return;
    setCerrando(true);
    setMensaje("");
    try {
      const cierre = await cerrarTurno({
        apertura: aperturaActiva, ventas, gastosCaja, aperturasCaja, registrarCierre, cerrarAperturaCaja,
      });
      setReporteVisto(cierre);
    } catch (err) {
      console.error(err);
      setMensaje("No se pudo cerrar el turno. Intenta de nuevo.");
    } finally {
      setCerrando(false);
    }
  }

  async function borrarRegistro(id) {
    if (!window.confirm("¿Eliminar este registro guardado? Esta acción no se puede deshacer.")) return;
    try {
      await eliminarCierre(id);
      setReporteVisto((r) => (r?.id === id ? null : r));
    } catch (err) {
      console.error(err);
      setMensaje("No se pudo eliminar el registro.");
    }
  }

  async function limpiarAntiguos() {
    if (!window.confirm("Esto eliminará todos los registros guardados con más de 1 mes de antigüedad. ¿Continuar?"))
      return;
    try {
      const eliminados = await limpiarCierresAntiguos(30);
      setMensaje(
        eliminados > 0
          ? `Se eliminaron ${eliminados} registro(s) de más de 1 mes.`
          : "No había registros de más de 1 mes para eliminar."
      );
    } catch (err) {
      console.error(err);
      setMensaje("No se pudo completar la limpieza.");
    }
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Cierre de caja</h1>
        <p>Al cerrar el turno se genera solo el reporte de las ventas de la cajera.</p>
      </header>

      {reporteVisto && (
        <ReporteCierre
          cierre={reporteVisto}
          titulo={reporteVisto.id ? "Reporte guardado" : "Turno cerrado — reporte de la cajera"}
          onCerrar={() => setReporteVisto(null)}
        />
      )}

      {aperturaActiva ? (
        <>
          <ReporteCierre cierre={vistaPrevia} titulo="Turno abierto (así va hasta ahora)" />
          <div className="formulario__acciones">
            <button className="boton boton--peligro" onClick={cerrarElTurno} disabled={cerrando}>
              {cerrando ? "Cerrando turno…" : "Cerrar turno y generar reporte"}
            </button>
          </div>
        </>
      ) : (
        <section className="lista-reciente">
          <p className="texto-vacio">No hay una caja abierta. La apertura se hace desde Ventas.</p>
        </section>
      )}
      {mensaje && <div className="formulario__error">{mensaje}</div>}

      <section className="lista-reciente">
        <header className="pagina__cabecera">
          <h2>Historial de turnos cerrados</h2>
          <p>Se guardan al menos 1 mes. Usa «Ver reporte» para abrir el detalle o descargarlo en PDF.</p>
        </header>

        <div className="formulario__fila">
          <label>
            Ver
            <select value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)}>
              <option value="todos">Todos los días</option>
              <option value="jueves">Solo jueves</option>
              <option value="viernes">Solo viernes</option>
              <option value="sabado">Solo sábado</option>
              <option value="otro">Otros días</option>
            </select>
          </label>
        </div>

        {historialFiltrado.length === 0 ? (
          <p className="texto-vacio">No hay turnos cerrados para este filtro.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Día</th>
                <th>Cajera</th>
                <th>Efectivo</th>
                <th>QR</th>
                <th>Total</th>
                <th>Gastos</th>
                <th>Efectivo a entregar</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map((c) => (
                <tr key={c.id}>
                  <td>{formatoFechaLarga(c.fecha)}</td>
                  <td className="tabla__etiqueta">{c.diaEtiqueta || ETIQUETAS_DIA[c.dia] || "—"}</td>
                  <td>{c.cajera || "—"}</td>
                  <td>{bs(c.totalEfectivo)}</td>
                  <td>{bs(c.totalQr)}</td>
                  <td>{bs(c.totalGeneral)}</td>
                  <td>{bs(c.totalGastos)}</td>
                  <td>{bs(c.efectivoAEntregar ?? c.totalEfectivo)}</td>
                  <td>
                    <button className="boton boton--enlace" onClick={() => setReporteVisto(c)}>
                      Ver reporte
                    </button>
                  </td>
                  <td>
                    <button className="boton boton--fantasma" onClick={() => borrarRegistro(c.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="boton boton--fantasma" onClick={limpiarAntiguos}>
          Eliminar registros de más de 1 mes
        </button>
      </section>
    </div>
  );
}