import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { descargarCSV } from "../utils/csv";
import { descargarPDF } from "../utils/pdf";

function dentroDeRango(fechaIso, desde, hasta) {
  const f = new Date(fechaIso).getTime();
  if (desde && f < new Date(desde + "T00:00:00").getTime()) return false;
  if (hasta && f > new Date(hasta + "T23:59:59").getTime()) return false;
  return true;
}

export default function Reportes() {
  const { ventas } = useData();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vista, setVista] = useState("mesero");

  const ventasFiltradas = useMemo(
    () => ventas.filter((v) => dentroDeRango(v.fecha, desde, hasta)),
    [ventas, desde, hasta]
  );

  const porMesero = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((v) => {
      if (!mapa[v.mesero]) mapa[v.mesero] = { mesero: v.mesero, ventas: 0, total: 0 };
      mapa[v.mesero].ventas += 1;
      mapa[v.mesero].total += v.total;
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [ventasFiltradas]);

  const porProducto = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((v) => {
      if (!mapa[v.producto]) mapa[v.producto] = { producto: v.producto, cantidad: 0, total: 0 };
      mapa[v.producto].cantidad += v.cantidad;
      mapa[v.producto].total += v.total;
    });
    return Object.values(mapa).sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasFiltradas]);

  const saldos = useMemo(() => {
    const totalQr = ventasFiltradas.reduce((s, v) => s + (v.montoQr || 0), 0);
    const totalEfectivo = ventasFiltradas.reduce((s, v) => s + (v.montoEfectivo || 0), 0);
    return { totalQr, totalEfectivo, totalGeneral: totalQr + totalEfectivo };
  }, [ventasFiltradas]);

  const configuraciones = {
    mesero: {
      titulo: "Por mesero",
      columnas: [
        { titulo: "Mesero", clave: "mesero" },
        { titulo: "N° ventas", clave: "ventas" },
        { titulo: "Total Bs", clave: "total" },
      ],
      filas: porMesero,
    },
    producto: {
      titulo: "Por producto",
      columnas: [
        { titulo: "Producto", clave: "producto" },
        { titulo: "Cantidad", clave: "cantidad" },
        { titulo: "Total Bs", clave: "total" },
      ],
      filas: porProducto,
    },
  };

  const actual = configuraciones[vista];

  function exportarCSV() {
    const filas = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
    }));
    descargarCSV(`reporte-${vista}`, actual.columnas, filas);
  }

  function exportarPDF() {
    const filas = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
    }));
    descargarPDF(actual.titulo, actual.columnas, filas, `reporte-${vista}`);
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Reportes</h1>
        <p>Filtra por fecha y descarga en CSV o PDF.</p>
      </header>

      <div className="formulario__fila">
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Saldo efectivo</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalEfectivo.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Saldo QR</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalQr.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Saldo total</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalGeneral.toFixed(2)}</span>
        </div>
      </div>

      <div className="pestañas">
        <button
          className={`pestañas__item ${vista === "mesero" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("mesero")}
        >
          Por mesero
        </button>
        <button
          className={`pestañas__item ${vista === "producto" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("producto")}
        >
          Por producto
        </button>
      </div>

      <section className="lista-reciente">
        {actual.filas.length === 0 ? (
          <p className="texto-vacio">No hay datos para este filtro.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                {actual.columnas.map((c) => (
                  <th key={c.clave}>{c.titulo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actual.filas.map((fila, i) => (
                <tr key={i}>
                  {actual.columnas.map((c) => (
                    <td key={c.clave}>
                      {c.clave === "total" ? `Bs ${fila[c.clave].toFixed(2)}` : fila[c.clave]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="formulario__acciones">
        <button className="boton boton--primario" onClick={exportarCSV} disabled={actual.filas.length === 0}>
          Descargar CSV
        </button>
        <button className="boton boton--fantasma" onClick={exportarPDF} disabled={actual.filas.length === 0}>
          Descargar PDF
        </button>
      </div>
    </div>
  );
}
