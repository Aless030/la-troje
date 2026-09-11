import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "../context/DataContext";

const COLORES = ["#C9973E", "#8B4B33", "#4C6444", "#3A2A1E", "#B4432D", "#6B7A52"];

export default function DashboardPage() {
  const { ventas, productos } = useData();

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
    { name: "Efectivo", value: datos.totalEfectivo },
    { name: "QR", value: datos.totalQr },
  ];

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Dashboard</h1>
        <p>Métricas generales de todo el histórico registrado.</p>
      </header>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ingresos totales</span>
          <span className="tarjeta-metrica__valor">Bs {datos.totalIngresos.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Ventas registradas</span>
          <span className="tarjeta-metrica__valor">{datos.totalVentas}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Producto estrella</span>
          <span className="tarjeta-metrica__valor tarjeta-metrica__valor--texto">
            {datos.masVendido?.producto || "—"}
          </span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Mesero del período</span>
          <span className="tarjeta-metrica__valor tarjeta-metrica__valor--texto">
            {datos.meseroTop ? datos.meseroTop[0] : "—"}
          </span>
        </div>
      </div>

      <div className="grilla-graficos">
        <div className="panel-grafico">
          <h2>Top 5 productos por cantidad vendida</h2>
          {datos.top5.length === 0 ? (
            <p className="texto-vacio">Todavía no hay ventas registradas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datos.top5}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6ddc9" />
                <XAxis dataKey="producto" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="cantidad" radius={[6, 6, 0, 0]}>
                  {datos.top5.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel-grafico">
          <h2>Efectivo vs QR</h2>
          {datos.totalIngresos === 0 ? (
            <p className="texto-vacio">Todavía no hay ventas registradas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={distribucionPago}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={95}
                  label={(d) => `${d.name}: Bs ${d.value.toFixed(0)}`}
                >
                  {distribucionPago.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#4C6444" : "#C9973E"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Producto de menor rotación</span>
          <span className="tarjeta-metrica__valor tarjeta-metrica__valor--texto">
            {datos.menosVendido?.producto || "—"}
          </span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Valor del inventario actual</span>
          <span className="tarjeta-metrica__valor">Bs {datos.valorInventario.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
