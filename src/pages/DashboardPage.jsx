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
import { eventoDeApertura, eventoDeRegistro, listarEventos, mapaAperturas } from "../utils/Evento";
import { buscarAperturasActivas } from "../utils/Turno";
import { BARRAS, etiquetaBarra, stockTotal } from "../utils/barras";

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

const TODOS = "todos";

const bs = (n) => `Bs ${Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const FAMILIA_TRAGOS = "Tragos";
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const horaTxt = (h) => `${String(h).padStart(2, "0")}:00`;
const pctTxt = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(0)}%`;

// Pastilla de comparación ("+12% vs evento anterior").
function Delta({ actual, anterior }) {
  if (!(anterior > 0)) return null;
  const d = ((actual - anterior) / anterior) * 100;
  const texto = d > 300 ? `${(actual / anterior).toFixed(1).replace(".", ",")} veces` : pctTxt(d);
  return <span className={`dash-delta ${d >= 0 ? "dash-delta--sube" : "dash-delta--baja"}`}>{d >= 0 ? "▲" : "▼"} {texto} vs evento anterior</span>;
}

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
    case "ganancia":
      return (<svg {...props}><circle cx="12" cy="12" r="9" /><path d="M14.5 9.2c-.6-.8-1.6-1.2-2.6-1.2-1.5 0-2.6.8-2.6 2s1 1.7 2.7 2.1c1.7.4 2.7.9 2.7 2.1s-1.1 2-2.7 2c-1.1 0-2.1-.4-2.8-1.2M12 6.5V8m0 8v1.5" /></svg>);
    case "reloj":
      return (<svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
    case "baja":
      return (<svg {...props}><path d="M3 7l6 6 4-4 8 8" /><path d="M15 17h6v-6" /></svg>);
    default:
      return (<svg {...props}><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>);
  }
};

function Tarjeta({ etiqueta, valor, tipo, color, texto, oscura, extra }) {
  return (
    <div className={`dash-kpi ${oscura ? "dash-kpi--oscura" : ""}`} style={{ "--acento": color }}>
      <div className="dash-kpi__icono"><Icono tipo={tipo} /></div>
      <div className="dash-kpi__cuerpo">
        <span className="dash-kpi__etiqueta">{etiqueta}</span>
        <span className={`dash-kpi__valor ${texto ? "dash-kpi__valor--texto" : ""}`} title={texto ? String(valor) : undefined}>
          {valor}
        </span>
        {extra}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { ventas: sinAnuladas, ventasTodas = [], productos, aperturasCaja, gastosCaja = [] } = useData();
  const aperturasPorId = useMemo(() => mapaAperturas(aperturasCaja), [aperturasCaja]);
  const eventos = useMemo(
    () => listarEventos({ aperturas: aperturasCaja, ventas: ventasTodas }),
    [aperturasCaja, ventasTodas]
  );
  // En celulares el gráfico necesita menos espacio para los nombres.
  const [movil, setMovil] = useState(() => window.innerWidth < 560);
  useEffect(() => {
    const alCambiar = () => setMovil(window.innerWidth < 560);
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);

  const productoPorId = useMemo(() => Object.fromEntries(productos.map((p) => [p.id, p])), [productos]);
  const idEvento = (reg) => eventoDeRegistro(reg, aperturasPorId).id;

  // Ventas reales (sin anuladas ni cortesías), cortesías y anuladas del histórico.
  const lineas = useMemo(() => sinAnuladas.filter((v) => v.formaPago !== "cortesia"), [sinAnuladas]);
  const cortesiasTodas = useMemo(() => sinAnuladas.filter((v) => v.formaPago === "cortesia"), [sinAnuladas]);
  const anuladasTodas = useMemo(() => ventasTodas.filter((v) => v.anulada), [ventasTodas]);

  // Costo de producto de una línea vendida (precio de compra × lo que se gastó del inventario).
  const costoDeLinea = (v) => {
    const consumo = Array.isArray(v.consumo) && v.consumo.length > 0 ? v.consumo : [{ productoId: v.productoId, cantidad: v.cantidad }];
    return consumo.reduce((s, c) => s + Number(c.cantidad || 0) * Number(productoPorId[c.productoId]?.precio || 0), 0);
  };
  const familiaDe = (v) => (v.recetaId ? FAMILIA_TRAGOS : productoPorId[v.productoId]?.familia || "Licores");

  // Totales de cada evento (para comparar y para el gráfico de evolución).
  const porEvento = useMemo(() => {
    const mapa = {};
    lineas.forEach((v) => {
      const id = eventoDeRegistro(v, aperturasPorId).id;
      if (!mapa[id]) mapa[id] = { ingresos: 0, costo: 0 };
      mapa[id].ingresos += Number(v.total || 0);
      mapa[id].costo += costoDeLinea(v);
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas, aperturasPorId, productoPorId]);

  const eventosConVentas = useMemo(() => eventos.filter((e) => porEvento[e.id]), [eventos, porEvento]);

  // Evento por defecto: el de las cajas abiertas; si no hay, el último con ventas.
  const idPorDefecto = useMemo(() => {
    const activas = buscarAperturasActivas(aperturasCaja);
    if (activas.length > 0) return eventoDeApertura(activas[0]).id;
    return eventosConVentas[0]?.id || TODOS;
  }, [aperturasCaja, eventosConVentas]);
  const [elegido, setElegido] = useState(null);
  const eventoId = elegido ?? idPorDefecto;
  const eventoActual = eventos.find((e) => e.id === eventoId) || null;
  const anterior = useMemo(() => {
    const idx = eventosConVentas.findIndex((e) => e.id === eventoId);
    return idx >= 0 ? eventosConVentas[idx + 1] || null : null;
  }, [eventosConVentas, eventoId]);
  const totalesAnterior = anterior ? porEvento[anterior.id] : null;

  const enSel = (v) => eventoId === TODOS || idEvento(v) === eventoId;
  const ventas = useMemo(() => lineas.filter(enSel), [lineas, eventoId, aperturasPorId]); // eslint-disable-line react-hooks/exhaustive-deps
  const cortesias = useMemo(() => cortesiasTodas.filter(enSel), [cortesiasTodas, eventoId, aperturasPorId]); // eslint-disable-line react-hooks/exhaustive-deps
  const anuladas = useMemo(() => anuladasTodas.filter(enSel), [anuladasTodas, eventoId, aperturasPorId]); // eslint-disable-line react-hooks/exhaustive-deps
  const gastos = useMemo(() => gastosCaja.filter(enSel), [gastosCaja, eventoId, aperturasPorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const datos = useMemo(() => {
    const porProducto = {};
    const porFamilia = {};
    const porBarra = Object.fromEntries(BARRAS.map((b) => [b.valor, { barra: b.etiqueta, total: 0, ventas: 0 }]));
    const porMesero = {};
    const porHora = {};
    const comandas = new Set();
    let totalIngresos = 0, totalQr = 0, totalEfectivo = 0, costo = 0;

    ventas.forEach((v) => {
      const total = Number(v.total || 0);
      const c = costoDeLinea(v);
      totalIngresos += total;
      costo += c;
      totalQr += Number(v.montoQr || 0);
      totalEfectivo += Number(v.montoEfectivo || 0);
      comandas.add(`${v.comanda}|${v.aperturaId || ""}`);

      const pr = (porProducto[v.producto] ||= { producto: v.producto, cantidad: 0, total: 0, ganancia: 0 });
      pr.cantidad += Number(v.cantidad || 0);
      pr.total += total;
      pr.ganancia += total - c;

      const fam = familiaDe(v);
      const f = (porFamilia[fam] ||= { familia: fam, total: 0, ganancia: 0 });
      f.total += total;
      f.ganancia += total - c;

      const kb = v.barra || "sin";
      const b = (porBarra[kb] ||= { barra: etiquetaBarra(v.barra) === "—" ? "Sin barra" : etiquetaBarra(v.barra), total: 0, ventas: 0 });
      b.total += total;
      b.ventas += 1;

      const m = (porMesero[v.mesero || "—"] ||= { mesero: v.mesero || "—", total: 0, comandas: new Set() });
      m.total += total;
      m.comandas.add(`${v.comanda}|${v.aperturaId || ""}`);

      const d = new Date(v.fecha);
      if (!isNaN(d)) porHora[d.getHours()] = (porHora[d.getHours()] || 0) + total;
    });

    const lista = Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad);
    const rentables = [...lista].sort((a, b) => b.ganancia - a.ganancia).slice(0, 5);
    const familias = Object.values(porFamilia).sort((a, b) => b.total - a.total);
    const barras = Object.values(porBarra);
    const meseros = Object.values(porMesero)
      .map((m) => ({ mesero: m.mesero, total: m.total, comandas: m.comandas.size, ticket: m.comandas.size ? m.total / m.comandas.size : 0 }))
      .sort((a, b) => b.total - a.total);
    // Horas ordenadas por la noche (de 12:00 a 11:59), así 00:00 va después de 23:00.
    const horas = Object.keys(porHora)
      .map(Number)
      .sort((a, b) => ((a + 12) % 24) - ((b + 12) % 24))
      .map((h) => ({ hora: horaTxt(h), h, total: r2(porHora[h]) }));
    const horaPico = horas.reduce((m, x) => (!m || x.total > m.total ? x : m), null);

    const gastosTotal = gastos.reduce((s, g) => s + Number(g.monto || 0), 0);
    const bruta = totalIngresos - costo;
    return {
      masVendido: lista[0],
      menosVendido: lista[lista.length - 1],
      top5: lista.slice(0, 5),
      rentables,
      familias,
      barras,
      meseros,
      horas,
      horaPico,
      totalIngresos,
      totalQr,
      totalEfectivo,
      costo,
      bruta,
      margen: totalIngresos > 0 ? (bruta / totalIngresos) * 100 : 0,
      gastosTotal,
      neta: bruta - gastosTotal,
      comandas: comandas.size,
      ticket: comandas.size ? totalIngresos / comandas.size : 0,
      totalVentas: ventas.length,
      meseroTop: meseros[0],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventas, gastos, productoPorId]);

  // Alertas de control (de lo que se ve en pantalla).
  const control = useMemo(() => {
    const valorCortesias = cortesias.reduce((s, v) => s + Number(v.valorCortesia || 0), 0);
    const costoCortesias = cortesias.reduce((s, v) => s + costoDeLinea(v), 0);
    return {
      cortesias: cortesias.length,
      valorCortesias,
      costoCortesias,
      anuladas: new Set(anuladas.map((v) => `${v.comanda}|${v.aperturaId || ""}`)).size,
      montoAnuladas: anuladas.reduce((s, v) => s + Number(v.total || 0), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cortesias, anuladas, productoPorId]);

  // Inventario actual (no depende del evento).
  const inv = useMemo(() => {
    let costoInv = 0, ventaInv = 0, agotados = 0, pocos = 0;
    productos.forEach((p) => {
      const t = stockTotal(p);
      costoInv += t * Number(p.precio || 0);
      ventaInv += t * Number(p.precioVenta || 0);
      if (t <= 0) agotados += 1;
      else if (t <= Number(p.stockMinimo ?? 3)) pocos += 1;
    });
    return { costoInv, ventaInv, agotados, pocos };
  }, [productos]);

  // Evolución: últimos 8 eventos (del más viejo al más nuevo).
  const evolucion = useMemo(
    () =>
      eventosConVentas
        .slice(0, 8)
        .reverse()
        .map((e) => ({
          id: e.id,
          etiqueta: e.inicio ? new Date(e.inicio).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" }) : e.nombre,
          nombre: e.nombre,
          Ventas: r2(porEvento[e.id].ingresos),
          Ganancia: r2(porEvento[e.id].ingresos - porEvento[e.id].costo),
        })),
    [eventosConVentas, porEvento]
  );

  // Qué día de la semana rinde más (promedio por evento).
  const porDia = useMemo(() => {
    const acum = {};
    eventosConVentas.forEach((e) => {
      const d = e.inicio ? new Date(e.inicio).getDay() : null;
      if (d === null) return;
      (acum[d] ||= { suma: 0, n: 0 });
      acum[d].suma += porEvento[e.id].ingresos;
      acum[d].n += 1;
    });
    return [4, 5, 6, 0, 1, 2, 3]
      .filter((d) => acum[d])
      .map((d) => ({ dia: DIAS[d], Promedio: r2(acum[d].suma / acum[d].n), eventos: acum[d].n }));
  }, [eventosConVentas, porEvento]);
  const mejorDia = porDia.reduce((m, x) => (!m || x.Promedio > m.Promedio ? x : m), null);

  const distribucionPago = [
    { name: "Efectivo", value: datos.totalEfectivo, color: VERDE },
    { name: "QR", value: datos.totalQr, color: AZUL },
  ];
  const sumaPagos = datos.totalEfectivo + datos.totalQr;
  const pct = (v) => (sumaPagos > 0 ? ((v / sumaPagos) * 100).toFixed(0) : 0);
  const maxBarra = Math.max(1, ...datos.barras.map((b) => b.total));
  const maxRent = Math.max(1, ...datos.rentables.map((r) => Math.abs(r.ganancia)));
  const maxMesero = Math.max(1, ...datos.meseros.map((m) => m.total));

  // Frases automáticas con lo más destacado.
  const destacados = [];
  if (datos.totalVentas > 0) {
    if (eventoActual && anterior && totalesAnterior && totalesAnterior.ingresos > 0) {
      const ratio = datos.totalIngresos / totalesAnterior.ingresos;
      const comp = ratio >= 3 ? `${ratio.toFixed(1).replace(".", ",")} veces lo del evento anterior` : ratio >= 1 ? `${((ratio - 1) * 100).toFixed(0)}% más que el evento anterior` : `${((1 - ratio) * 100).toFixed(0)}% menos que el evento anterior`;
      destacados.push(`Se vendió ${bs(datos.totalIngresos)}: ${comp} (${bs(totalesAnterior.ingresos)}).`);
    } else {
      destacados.push(`Se vendió ${bs(datos.totalIngresos)} en ${datos.comandas} comandas.`);
    }
    destacados.push(`Ganancia: ${bs(datos.bruta)} (de cada Bs 100 vendidos, Bs ${datos.margen.toFixed(0)} son ganancia).`);
    if (datos.horaPico) destacados.push(`Más movimiento a las ${datos.horaPico.hora}: se vendió ${bs(datos.horaPico.total)} en esa hora.`);
    if (datos.rentables[0]) destacados.push(`Lo que más ganancia dejó: ${datos.rentables[0].producto} (${bs(datos.rentables[0].ganancia)}).`);
    if (datos.meseroTop) destacados.push(`Mesero que más vendió: ${datos.meseroTop.mesero} (${bs(datos.meseroTop.total)}).`);
  }

  return (
    <div className="pagina dash">
      <header className="dash__cabecera">
        <div>
          <h1>Dashboard</h1>
          <p>
            {eventoActual
              ? `Métricas del evento: ${eventoActual.etiqueta}.`
              : "Métricas de todo el histórico registrado."}
          </p>
        </div>
        <div className="dash__filtros">
          <label>
            Evento
            <select value={eventoActual ? eventoId : TODOS} onChange={(e) => setElegido(e.target.value)}>
              <option value={TODOS}>Todos los eventos</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.etiqueta}</option>
              ))}
            </select>
          </label>
          {eventoActual && (
            <button type="button" className="dash__limpiar" onClick={() => setElegido(TODOS)}>
              Ver todo el histórico
            </button>
          )}
        </div>
      </header>

      {destacados.length > 0 && (
        <section className="dash-destacados">
          <h2>Resumen en palabras</h2>
          <ul>
            {destacados.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      <h3 className="dash__seccion">Cómo va el negocio</h3>
      <div className="dash__kpis">
        <Tarjeta
          oscura
          tipo="ingresos"
          color={AZUL}
          etiqueta="Ventas"
          valor={bs(datos.totalIngresos)}
          extra={eventoActual && totalesAnterior ? <Delta actual={datos.totalIngresos} anterior={totalesAnterior.ingresos} /> : null}
        />
        <Tarjeta
          tipo="ganancia"
          color={VERDE}
          etiqueta="Ganancia bruta"
          valor={bs(datos.bruta)}
          extra={
            <span className="dash-kpi__nota">
              Ventas − costo de producto · {datos.margen.toFixed(0)}%
              {eventoActual && totalesAnterior ? <Delta actual={datos.bruta} anterior={totalesAnterior.ingresos - totalesAnterior.costo} /> : null}
            </span>
          }
        />
        <Tarjeta
          tipo="ganancia"
          color={AMBAR}
          etiqueta="Ganancia neta"
          valor={bs(datos.neta)}
          extra={<span className="dash-kpi__nota">Ganancia bruta − gastos de caja ({bs(datos.gastosTotal)})</span>}
        />
        <Tarjeta
          tipo="ventas"
          color={VIOLETA}
          etiqueta="Gasto promedio por comanda"
          valor={bs(datos.ticket)}
          extra={<span className="dash-kpi__nota">{datos.comandas} comandas · {datos.totalVentas} productos</span>}
        />
      </div>

      <div className="dash__kpis">
        <Tarjeta tipo="estrella" color={AMBAR} etiqueta="Más vendido" valor={datos.masVendido?.producto || "—"} texto />
        <Tarjeta tipo="mesero" color={VIOLETA} etiqueta="Mesero que más vendió" valor={datos.meseroTop ? datos.meseroTop.mesero : "—"} texto />
        <Tarjeta tipo="reloj" color={ROSA} etiqueta="Hora con más ventas" valor={datos.horaPico ? datos.horaPico.hora : "—"} texto />
        <Tarjeta tipo="baja" color={ROSA} etiqueta="Menos vendido" valor={datos.menosVendido?.producto || "—"} texto />
      </div>

      <h3 className="dash__seccion">Cuándo y dónde se vende</h3>
      <div className="dash__graficos">
        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>Evolución por evento</h2>
            <span>Últimos {evolucion.length || 0} eventos</span>
          </div>
          {evolucion.length === 0 ? (
            <p className="dash__vacio">Todavía no hay eventos con ventas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={evolucion} margin={{ top: 8, right: 8, left: movil ? -14 : 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={movil ? 44 : 56} />
                <Tooltip cursor={{ fill: "rgba(59,108,212,0.08)" }} contentStyle={estiloTooltip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#9CA3AF" }} labelFormatter={(l, p) => (p?.[0]?.payload ? `${p[0].payload.nombre} · ${l}` : l)} formatter={(v, n) => [bs(v), n]} />
                <Bar dataKey="Ventas" radius={[6, 6, 0, 0]}>
                  {evolucion.map((e) => (
                    <Cell key={e.id} fill={e.id === eventoId ? AZUL : "#B8C7EE"} />
                  ))}
                </Bar>
                <Bar dataKey="Ganancia" fill={VERDE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="dash-panel__pie">Barra azul = lo vendido. Barra verde = ganancia. El evento que estás mirando está en azul fuerte.</p>
        </section>

        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>Ventas por hora</h2>
            <span>Hora por hora</span>
          </div>
          {datos.horas.length === 0 ? (
            <p className="dash__vacio">No hay ventas en este período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={datos.horas} margin={{ top: 8, right: 8, left: movil ? -14 : 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={movil ? 44 : 56} />
                <Tooltip cursor={{ fill: "rgba(224,160,48,0.12)" }} contentStyle={estiloTooltip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#9CA3AF" }} formatter={(v) => [bs(v), "Vendido"]} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {datos.horas.map((h) => (
                    <Cell key={h.h} fill={h.h === datos.horaPico?.h ? AMBAR : "#F1D9A6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <h3 className="dash__seccion">Qué se vende y qué deja ganancia</h3>
      <div className="dash__graficos dash__graficos--iguales">
        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>Ventas por barra</h2>
            <span>Cuánto vendió cada barra</span>
          </div>
          {datos.totalVentas === 0 ? (
            <p className="dash__vacio">No hay ventas en este período.</p>
          ) : (
            <ul className="dash-rank">
              {datos.barras.map((b, i) => (
                <li key={b.barra}>
                  <div className="dash-rank__fila">
                    <span className="dash-rank__nombre">{b.barra}</span>
                    <span className="dash-rank__valor">{bs(b.total)}</span>
                  </div>
                  <div className="dash-rank__pista"><div className="dash-rank__barra" style={{ width: `${(b.total / maxBarra) * 100}%`, background: COLORES[i % COLORES.length] }} /></div>
                  <span className="dash-rank__nota">{datos.totalIngresos > 0 ? ((b.total / datos.totalIngresos) * 100).toFixed(0) : 0}% del total · {b.ventas} productos</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>Lo que más ganancia deja</h2>
            <span>Los 5 que más dejan</span>
          </div>
          {datos.rentables.length === 0 ? (
            <p className="dash__vacio">No hay ventas en este período.</p>
          ) : (
            <ul className="dash-rank">
              {datos.rentables.map((r, i) => (
                <li key={r.producto}>
                  <div className="dash-rank__fila">
                    <span className="dash-rank__nombre">{r.producto}</span>
                    <span className="dash-rank__valor">{bs(r.ganancia)}</span>
                  </div>
                  <div className="dash-rank__pista"><div className="dash-rank__barra" style={{ width: `${(Math.max(0, r.ganancia) / maxRent) * 100}%`, background: VERDE }} /></div>
                  <span className="dash-rank__nota">{r.cantidad} vendidos · ganancia {r.total > 0 ? ((r.ganancia / r.total) * 100).toFixed(0) : 0}% del precio</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dash__graficos">
        <section className="dash-panel dash-panel--ancho">
          <div className="dash-panel__titulo">
            <h2>Top 5 productos</h2>
            <span>Cuántas unidades se vendieron</span>
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

      <h3 className="dash__seccion">Equipo y familias</h3>
      <div className="dash__graficos dash__graficos--iguales">
        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>Ranking de meseros</h2>
            <span>Quién vendió más</span>
          </div>
          {datos.meseros.length === 0 ? (
            <p className="dash__vacio">No hay ventas en este período.</p>
          ) : (
            <ul className="dash-rank">
              {datos.meseros.slice(0, 6).map((m, i) => (
                <li key={m.mesero}>
                  <div className="dash-rank__fila">
                    <span className="dash-rank__nombre">{i + 1}. {m.mesero}</span>
                    <span className="dash-rank__valor">{bs(m.total)}</span>
                  </div>
                  <div className="dash-rank__pista"><div className="dash-rank__barra" style={{ width: `${(m.total / maxMesero) * 100}%`, background: VIOLETA }} /></div>
                  <span className="dash-rank__nota">{m.comandas} comandas · promedio {bs(m.ticket)} cada una</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>Por familia</h2>
            <span>Qué grupo vende más</span>
          </div>
          {datos.familias.length === 0 ? (
            <p className="dash__vacio">No hay ventas en este período.</p>
          ) : (
            <table className="dash-tabla">
              <thead>
                <tr><th>Familia</th><th>Vendido</th><th>Del total</th><th>Ganancia</th></tr>
              </thead>
              <tbody>
                {datos.familias.map((f) => (
                  <tr key={f.familia}>
                    <td>{f.familia}</td>
                    <td>{bs(f.total)}</td>
                    <td>{datos.totalIngresos > 0 ? ((f.total / datos.totalIngresos) * 100).toFixed(0) : 0}%</td>
                    <td className={f.ganancia >= 0 ? "dash-tabla__ok" : "dash-tabla__mal"}>{f.total > 0 ? ((f.ganancia / f.total) * 100).toFixed(0) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <h3 className="dash__seccion">Días y control</h3>
      <div className="dash__graficos dash__graficos--iguales">
        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>¿Qué día rinde más?</h2>
            <span>Venta promedio por evento</span>
          </div>
          {porDia.length === 0 ? (
            <p className="dash__vacio">Todavía no hay eventos con ventas.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porDia} margin={{ top: 8, right: 8, left: movil ? -14 : 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: movil ? 10.5 : 12, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={movil ? 44 : 56} />
                  <Tooltip cursor={{ fill: "rgba(124,99,201,0.1)" }} contentStyle={estiloTooltip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#9CA3AF" }} formatter={(v, n, ctx) => [bs(v), `Promedio (${ctx.payload.eventos} evento/s)`]} />
                  <Bar dataKey="Promedio" radius={[6, 6, 0, 0]}>
                    {porDia.map((d) => (
                      <Cell key={d.dia} fill={d.dia === mejorDia?.dia ? VIOLETA : "#CFC5EC"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {mejorDia && <p className="dash-panel__pie">El mejor día es el <strong>{mejorDia.dia}</strong>, con {bs(mejorDia.Promedio)} en promedio.</p>}
            </>
          )}
        </section>

        <section className="dash-panel">
          <div className="dash-panel__titulo">
            <h2>Control</h2>
            <span>{eventoActual ? "En este evento" : "En todo el histórico"}</span>
          </div>
          <ul className="dash-alertas">
            <li className={control.cortesias > 0 ? "dash-alertas__aviso" : ""}>
              <span>Cortesías entregadas</span>
              <strong>{control.cortesias}</strong>
              <small>Valían {bs(control.valorCortesias)}; costaron {bs(control.costoCortesias)}</small>
            </li>
            <li className={control.anuladas > 0 ? "dash-alertas__aviso" : ""}>
              <span>Comandas anuladas</span>
              <strong>{control.anuladas}</strong>
              <small>Monto anulado: {bs(control.montoAnuladas)}</small>
            </li>
            <li className={inv.agotados > 0 ? "dash-alertas__aviso" : ""}>
              <span>Productos sin stock</span>
              <strong>{inv.agotados}</strong>
              <small>{inv.pocos} con poco stock (inventario de hoy)</small>
            </li>
          </ul>
        </section>
      </div>

      <h3 className="dash__seccion">Inventario actual</h3>
      <div className="dash__kpis dash__kpis--dos">
        <Tarjeta tipo="inventario" color={VERDE} etiqueta="Inventario hoy, a precio de compra" valor={bs(inv.costoInv)} />
        <Tarjeta
          tipo="inventario"
          color={AZUL}
          etiqueta="Inventario hoy, a precio de venta"
          valor={bs(inv.ventaInv)}
          extra={<span className="dash-kpi__nota">Si se vende todo, ganarías: {bs(inv.ventaInv - inv.costoInv)}</span>}
        />
      </div>
    </div>
  );
}