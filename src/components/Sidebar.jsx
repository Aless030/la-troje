const ITEMS = [
  { id: "menu", etiqueta: "Menú principal", icono: "⌂" },
  { id: "ventas", etiqueta: "Venta", icono: "✎" },
  { id: "inventario", etiqueta: "Inventario", icono: "▤" },
  { id: "distribucion", etiqueta: "Distribución", icono: "⇉" },
  { id: "cierre", etiqueta: "Cierre de caja", icono: "◈" },
  { id: "reportes", etiqueta: "Reportes", icono: "▦" },
  { id: "dashboard", etiqueta: "Dashboard", icono: "◐" },
  { id: "movimientos", etiqueta: "Movimientos de caja", icono: "⇄" },
  { id: "semanal", etiqueta: "Semanales", icono: "▥" },
];

export default function Sidebar({ vista, setVista, abierto, setAbierto }) {
  return (
    <>
      <aside className={`sidebar ${abierto ? "sidebar--abierto" : ""}`}>
        <div className="sidebar__marca">
          <span className="sidebar__grano">◆</span>
          <div>
            <div className="sidebar__nombre">LA TROJE</div>
            <div className="sidebar__sub">Sistema de caja</div>
          </div>
        </div>
        <nav className="sidebar__nav">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar__item ${vista === item.id ? "sidebar__item--activo" : ""}`}
              onClick={() => {
                setVista(item.id);
                setAbierto(false);
              }}
            >
              <span className="sidebar__icono">{item.icono}</span>
              {item.etiqueta}
            </button>
          ))}
        </nav>
      </aside>
      {abierto && <div className="sidebar__overlay" onClick={() => setAbierto(false)} />}
    </>
  );
}