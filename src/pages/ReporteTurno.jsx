import { descargarReporteCierrePDF } from "../utils/pdf";

const bs = (n) => `Bs ${Number(n || 0).toFixed(2)}`;

// Reporte de un turno de caja: lo que vendió la cajera, gastos y efectivo a entregar.
export default function ReporteCierre({ cierre, titulo = "Reporte de cierre de caja", onCerrar }) {
  if (!cierre) return null;
  const productos = cierre.productosVendidos || [];
  const gastos = cierre.gastosDetalle || [];
  const cortesias = cierre.cortesiasDetalle || [];

  return (
    <section className="lista-reciente reporte-cierre">
      <h2>{titulo}</h2>
      <p className="reporte-cierre__sub">
        <strong>Cajera:</strong> {cierre.cajera || "—"} · <strong>Barra:</strong> {cierre.barra || "—"} ·{" "}
        <strong>Apertura:</strong>{" "}
        {cierre.fechaApertura ? new Date(cierre.fechaApertura).toLocaleString("es-BO") : "—"}
        {cierre.fecha && cierre.cerrado !== false && (
          <>
            {" "}
            · <strong>Cierre:</strong> {new Date(cierre.fecha).toLocaleString("es-BO")}
          </>
        )}
        {(cierre.meseros || []).length > 0 && (
          <>
            {" "}
            · <strong>Meseros:</strong> {cierre.meseros.join(", ")}
          </>
        )}
      </p>

      <div className="reporte-cierre__cuadro">
        <div className="reporte-cierre__fila">
          <span>VENTAS EFECTIVO</span>
          <span>{bs(cierre.totalEfectivo)}</span>
        </div>
        <div className="reporte-cierre__fila">
          <span>VENTAS QR</span>
          <span>{bs(cierre.totalQr)}</span>
        </div>
        <div className="reporte-cierre__fila">
          <span>GASTOS</span>
          <span>{bs(cierre.totalGastos)}</span>
        </div>
        <div className="reporte-cierre__fila reporte-cierre__fila--fuerte">
          <span>VENTAS TOTALES</span>
          <span>{bs(cierre.totalGeneral)}</span>
        </div>
        {Number(cierre.cajaChica) > 0 && (
          <div className="reporte-cierre__fila">
            <span>CAJA CHICA (con la que abrió)</span>
            <span>{bs(cierre.cajaChica)}</span>
          </div>
        )}
        <div className="reporte-cierre__fila reporte-cierre__fila--total">
          <span>EFECTIVO A ENTREGAR</span>
          <span>{bs(cierre.efectivoAEntregar)}</span>
        </div>
        <p className="reporte-cierre__nota">
          Efectivo a entregar = ventas en efectivo − gastos{Number(cierre.cajaChica) > 0 ? " + caja chica" : ""}. El QR no
          se entrega en mano.
        </p>
      </div>

      {productos.length > 0 && (
        <>
          <h3>Productos vendidos</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.producto}>
                  <td>{p.producto}</td>
                  <td>{Number(p.cantidad)}</td>
                  <td>{bs(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {gastos.length > 0 && (
        <>
          <h3>Gastos</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g, i) => (
                <tr key={i}>
                  <td>{g.concepto}</td>
                  <td>{bs(g.monto)}</td>
                  <td>{g.observaciones || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {cortesias.length > 0 && (
        <>
          <h3>Cortesías (solo control, no se suman)</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Comanda</th>
                <th>Mesero</th>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Precio botella</th>
              </tr>
            </thead>
            <tbody>
              {cortesias.map((k, i) => (
                <tr key={i}>
                  <td>{k.comanda || "—"}</td>
                  <td>{k.mesero || "—"}</td>
                  <td>{k.producto}</td>
                  <td>{k.cantidad}</td>
                  <td>{bs(k.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="formulario__acciones">
        <button type="button" className="boton boton--primario" onClick={() => descargarReporteCierrePDF(cierre)}>
          Descargar PDF
        </button>
        {onCerrar && (
          <button type="button" className="boton boton--fantasma" onClick={onCerrar}>
            Cerrar reporte
          </button>
        )}
      </div>
    </section>
  );
}