import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "../context/DataContext";

// Paleta viva sobre base blanco y negro.
const AZUL = "#3B6CD4";
const VERDE = "#2FA382";
const AMBAR = "#E0A030";
const VIOLETA = "#7C63C9";
const ROSA = "#D95C70";
const COLORES = [AZUL, VERDE, AMBAR, VIOLETA, ROSA];

const estiloTooltip = {
  background: "#1E293B",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
  padding: "8px 12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
};

function dentroDeRango(fechaIso, desde, hasta) {
  const f = new Date(fechaIso).getTime();
  if (desde && f < new Date(desde + "T00:00:00").getTime()) return false;
  if (hasta && f > new Date(hasta + "T23:59:59").getTime()) return false;
  return true;
}

const bs = (n) => `Bs ${Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Iconos simples (SVG) para las tarjetas.
const Icono = ({ tipo }) => {
  const props = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (tipo) {
    case "ingresos":
      return (<svg {...props}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>);
    case "ventas":
      return (<svg {...props}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>);
    case "estrella":
      return (<svg {...props}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>);
    case "mesero":
      return (<svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
    case "baja":
      return (<svg {...props}><path d="M3 7l6 6 4-4 8 8" /><path d="M15 17h6v-6" /></svg>);
    default:
      return (<svg {...props}><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>);
  }
};

function Tarjeta({ etiqueta, valor, tipo, color, texto, oscura }) {
  return (
    <div className={`dash-kpi ${oscura ? "dash-kpi--oscura" : ""}`} style={{ "--acento": color }}>
      <div className="dash-kpi__icono"><Icono tipo={tipo} /></div>
      <div className="dash-kpi__cuerpo">
        <span className="dash-kpi__etiqueta">{etiqueta}</span>
        <span className={`dash-kpi__valor ${texto ? "dash-kpi__valor--texto" : ""}`} title={texto ? String(valor) : undefined}>
          {valor}
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { ventas: todasLasVentas, productos } = useData();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  // En celulares el gráfico de barras necesita menos espacio para los nombres.
  const [movil, setMovil] = useState(() => window.innerWidth < 560);
  useEffect(() => {
    const alCambiar = () => setMovil(window.innerWidth < 560);
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);

  // Filtra por fechas y deja fuera las cortesías (no son venta ni se suman).
  const ventas = useMemo(
    () =>
      todasLasVentas.filter(
        (v) => v.formaPago !== "cortesia" && dentroDeRango(v.fecha, desde, hasta)
      ),
    [todasLasVentas, desde, hasta]
  );

  const datos = useMemo(() => {
    const porProducto = {};
    ventas.forEach((v) => {
      if (!porProducto[v.producto]) porProducto[v.producto] = { producto: v.producto, cantidad: 0, total: 0 };
      porProducto[v.producto].cantidad += v.cantidad;
      porProducto[v.producto].total += v.total;
    });
    const lista = Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad);

    const totalIngresos = ventas.reduce((s, v) => s + v.total, 0);
    const totalQr = ventas.reduce((s, v) => s + (v.montoQr || 0), 0);
    const totalEfectivo = ventas.reduce((s, v) => s + (v.montoEfectivo || 0), 0);

    const porMesero = {};
    ventas.forEach((v) => {
      porMesero[v.mesero] = (porMesero[v.mesero] || 0) + v.total;
    });
    const meseroTop = Object.entries(porMesero).sort((a, b) => b[1] - a[1])[0];

    return {
      masVendido: lista[0],
      menosVendido: lista[lista.length - 1],
      top5: lista.slice(0, 5),
      totalIngresos,
      totalQr,
      totalEfectivo,
      totalVentas: ventas.length,
      meseroTop,
      valorInventario: productos.reduce((s, p) => s + (p.precio || 0) * (p.stock || 0), 0),
    };
  }, [ventas, productos]);

  const distribucionPago = [
    { name: "Efectivo", value: datos.totalEfectivo, color: VERDE },
    { name: "QR", value: datos.totalQr, color: AZUL },
  ];
  const sumaPagos = datos.totalEfectivo + datos.totalQr;
  const pct = (v) => (sumaPagos > 0 ? ((v / sumaPagos) * 100).toFixed(0) : 0);

  return (
    <div className="pagina dash">
      <header className="dash__cabecera">
        <div>
          <h1>Dashboard</h1>
          <p>
            {desde || hasta
              ? "Métricas del rango de fechas seleccionado."
              : "Métricas de todo el histórico registrado."}
          </p>
        </div>
        <div className="dash__filtros">
          <label>
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          {(desde || hasta) && (
            <button
              type="button"
              className="dash__limpiar"
              onClick={() => {
                setDesde("");
                setHasta("");
              }}
            >
              Quitar filtro
            </button>
          )}
        </div>
      </header>

      <div className="dash__kpis">
        <Tarjeta oscura tipo="ingresos" color={AZUL} etiqueta="Ingresos totales" valor={bs(datos.totalIngresos)} />
        <Tarjeta tipo="ventas" color={VERDE} etiqueta="Ventas registradas" valor={datos.totalVentas} />
        <Tarjeta tipo="estrella" color={AMBAR} etiqueta="Producto estrella" valor={datos.masVendido?.producto || "—"} texto />
        <Tarjeta tipo="mesero" color={VIOLETA} etiqueta="Mesero del período" valor={datos.meseroTop ? datos.meseroTop[0] : "—"} texto />
      </div>

      <div className="dash__graficos">
        <section className="dash-panel dash-panel--ancho">
          <div className="dash-panel__titulo">
            <h2>Top 5 productos</h2>
            <span>Por cantidad vendida</span>
          </div>
          {datos.top5.length === 0 ? (
            <p className="dash__vacio">No hay ventas en este período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datos.top5} layout="vertical" margin={{ top: 4, right: movil ? 28 : 36, left: movil ? 0 : 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="producto" width={movil ? 88 : 130} tick={{ fontSize: movil ? 11 : 12.5, fill: "#1F2937", fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(59,108,212,0.08)" }} contentStyle={estiloTooltip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#9CA3AF" }} formatter={(v) => [v, "Unidades"]} />
                <Bar dataKey="cantidad" radius={[0, 8, 8, 0]} barSize={26}>
                  {datos.top5.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                  <LabelList dataKey="cantidad" position="right" style={{ fontSize: 12.5, fontWeight: 700, fill: "#1F2937" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>Efectivo vs QR</h2>
            <span>Forma de pago</span>
          </div>
          {sumaPagos === 0 ? (
            <p className="dash__vacio">No hay ventas en este período.</p>
          ) : (
            <>
              <div className="dash-dona">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={distribucionPago} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={3} stroke="none">
                      {distribucionPago.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={estiloTooltip} itemStyle={{ color: "#fff" }} formatter={(v) => bs(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-dona__centro">
                  <span>Total</span>
                  <strong>{bs(sumaPagos)}</strong>
                </div>
              </div>
              <ul className="dash-leyenda">
                {distribucionPago.map((d) => (
                  <li key={d.name}>
                    <span className="dash-leyenda__punto" style={{ background: d.color }} />
                    <span className="dash-leyenda__nombre">{d.name}</span>
                    <span className="dash-leyenda__monto">{bs(d.value)}</span>
                    <span className="dash-leyenda__pct">{pct(d.value)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="dash__kpis dash__kpis--dos">
        <Tarjeta tipo="baja" color={ROSA} etiqueta="Producto de menor rotación" valor={datos.menosVendido?.producto || "—"} texto />
        <Tarjeta tipo="inventario" color={VERDE} etiqueta="Valor del inventario actual (no depende del filtro)" valor={bs(datos.valorInventario)} />
      </div>
    </div>
  );
}