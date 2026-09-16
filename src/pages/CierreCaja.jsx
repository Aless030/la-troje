import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { descargarPDF } from "../utils/pdf";

const ETIQUETAS_DIA = {
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  otro: "Otro",
};

// Jueves=4, viernes=5, sábado=6 en getDay(). Cualquier otro día cae en "otro".
function diaSemanaDesdeFecha(fechaIso) {
  const dia = new Date(fechaIso).getDay();
  if (dia === 4) return "jueves";
  if (dia === 5) return "viernes";
  if (dia === 6) return "sabado";
  return "otro";
}

function esHoy(fechaIso) {
  if (!fechaIso) return false;
  const hoy = new Date();
  const f = new Date(fechaIso);
  return (
    f.getFullYear() === hoy.getFullYear() &&
    f.getMonth() === hoy.getMonth() &&
    f.getDate() === hoy.getDate()
  );
}

function formatoFechaLarga(fechaIso) {
  return new Date(fechaIso).toLocaleDateString("es-BO", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function CierreCaja() {
  const { ventas, cierres, registrarCierre, eliminarCierre, limpiarCierresAntiguos } = useData();

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // Día del evento que se está registrando: se sugiere solo según la fecha de hoy,
  // pero el usuario puede cambiarlo (por si el evento cae en otro día distinto).
  const [diaSeleccionado, setDiaSeleccionado] = useState(diaSemanaDesdeFecha(new Date().toISOString()));
  const [diaPersonalizado, setDiaPersonalizado] = useState("");

  // Filtro para ver el historial guardado: todos, o solo jueves/viernes/sábado/otro.
  const [filtroDia, setFiltroDia] = useState("todos");

  const ventasHoy = useMemo(() => ventas.filter((v) => esHoy(v.fecha)), [ventas]);

  const resumen = useMemo(() => {
    const totalQr = ventasHoy.reduce((s, v) => s + (v.montoQr || 0), 0);
    const totalEfectivo = ventasHoy.reduce((s, v) => s + (v.montoEfectivo || 0), 0);

    const porProducto = {};
    ventasHoy.forEach((v) => {
      if (!porProducto[v.producto]) {
        porProducto[v.producto] = { producto: v.producto, cantidad: 0, total: 0 };
      }
      porProducto[v.producto].cantidad += v.cantidad;
      porProducto[v.producto].total += v.total;
    });

    return {
      totalQr,
      totalEfectivo,
      totalGeneral: totalQr + totalEfectivo,
      productos: Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad),
    };
  }, [ventasHoy]);

  const historialFiltrado = useMemo(
    () => (filtroDia === "todos" ? cierres : cierres.filter((c) => c.dia === filtroDia)),
    [cierres, filtroDia]
  );

  async function guardarRegistro() {
    setGuardando(true);
    setMensaje("");
    try {
      const etiquetaDia =
        diaSeleccionado === "otro"
          ? diaPersonalizado.trim() || "Otro"
          : ETIQUETAS_DIA[diaSeleccionado];

      await registrarCierre({
        fecha: new Date().toISOString(),
        dia: diaSeleccionado,
        diaEtiqueta: etiquetaDia,
        totalQr: resumen.totalQr,
        totalEfectivo: resumen.totalEfectivo,
        totalGeneral: resumen.totalGeneral,
        cantidadVentas: ventasHoy.length,
        productosVendidos: resumen.productos,
      });
      setMensaje("Registro guardado correctamente.");
    } catch (err) {
      console.error(err);
      setMensaje("No se pudo guardar el registro. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrarRegistro(id) {
    if (!window.confirm("¿Eliminar este registro guardado? Esta acción no se puede deshacer.")) return;
    try {
      await eliminarCierre(id);
    } catch (err) {
      console.error(err);
      setMensaje("No se pudo eliminar el registro.");
    }
  }

  async function limpiarAntiguos() {
    if (
      !window.confirm(
        "Esto eliminará todos los registros guardados con más de 1 mes de antigüedad. ¿Continuar?"
      )
    )
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

  function exportarPDF() {
    descargarPDF(
      `Cierre de caja — ${new Date().toLocaleDateString("es-BO")}`,
      [
        { titulo: "Producto", clave: "producto" },
        { titulo: "Cantidad", clave: "cantidad" },
        { titulo: "Total Bs", clave: "total" },
      ],
      resumen.productos.map((p) => ({ ...p, total: p.total.toFixed(2) })),
      `cierre-caja-${new Date().toISOString().slice(0, 10)}`
    );
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Cierre de caja</h1>
        <p>Resumen de todo lo vendido hoy. Se guarda con su día y fecha; el día no se cierra ni se bloquea.</p>
      </header>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ventas hoy</span>
          <span className="tarjeta-metrica__valor">{ventasHoy.length}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Efectivo</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.totalEfectivo.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">QR</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.totalQr.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Total general</span>
          <span className="tarjeta-metrica__valor">Bs {resumen.totalGeneral.toFixed(2)}</span>
        </div>
      </div>

      <section className="lista-reciente">
        <h2>Productos vendidos hoy</h2>
        {resumen.productos.length === 0 ? (
          <p className="texto-vacio">Todavía no hay ventas hoy para registrar.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad vendida</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.productos.map((p) => (
                <tr key={p.producto}>
                  <td>{p.producto}</td>
                  <td>{p.cantidad}</td>
                  <td>Bs {p.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="formulario__fila">
        <label>
          Día del evento
          <select value={diaSeleccionado} onChange={(e) => setDiaSeleccionado(e.target.value)}>
            <option value="jueves">Jueves</option>
            <option value="viernes">Viernes</option>
            <option value="sabado">Sábado</option>
            <option value="otro">Otro…</option>
          </select>
        </label>
        {diaSeleccionado === "otro" && (
          <label>
            Nombre del día
            <input
              value={diaPersonalizado}
              onChange={(e) => setDiaPersonalizado(e.target.value)}
              placeholder="Ej: Domingo especial"
            />
          </label>
        )}
      </div>

      <div className="formulario__acciones">
        <button
          className="boton boton--primario"
          onClick={guardarRegistro}
          disabled={guardando || ventasHoy.length === 0}
        >
          {guardando ? "Guardando…" : "Guardar registro del día"}
        </button>
        <button className="boton boton--fantasma" onClick={exportarPDF} disabled={resumen.productos.length === 0}>
          Descargar PDF
        </button>
      </div>
      {mensaje && <div className="formulario__error formulario__error--exito">{mensaje}</div>}

      <section className="lista-reciente">
        <header className="pagina__cabecera">
          <h2>Historial de registros guardados</h2>
          <p>Se guardan al menos 1 mes. Filtra por día para ver solo jueves, viernes o sábado.</p>
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
          <p className="texto-vacio">No hay registros guardados para este filtro.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Día</th>
                <th>Ventas</th>
                <th>Efectivo</th>
                <th>QR</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map((c) => (
                <tr key={c.id}>
                  <td>{formatoFechaLarga(c.fecha)}</td>
                  <td className="tabla__etiqueta">{c.diaEtiqueta || ETIQUETAS_DIA[c.dia] || "—"}</td>
                  <td>{c.cantidadVentas ?? "—"}</td>
                  <td>Bs {Number(c.totalEfectivo || 0).toFixed(2)}</td>
                  <td>Bs {Number(c.totalQr || 0).toFixed(2)}</td>
                  <td>Bs {Number(c.totalGeneral || 0).toFixed(2)}</td>
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