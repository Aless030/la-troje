import Logo from "./Logo";

const ITEMS = [
  { id: "menu", etiqueta: "Menú principal" },
  { id: "ventas", etiqueta: "Venta" },
  { id: "inventario", etiqueta: "Inventario" },
  { id: "distribucion", etiqueta: "Distribución" },
  { id: "recetario", etiqueta: "Recetario y tragos" },
  { id: "cierre", etiqueta: "Cierre de caja" },
  { id: "reportes", etiqueta: "Reportes" },
  { id: "dashboard", etiqueta: "Dashboard" },
  { id: "movimientos", etiqueta: "Movimientos de caja" },
  { id: "semanal", etiqueta: "Semanales" },
  { id: "usuarios", etiqueta: "Usuarios" },
];

// Iconos de línea (mismo grosor y tamaño) para que todos se vean parejos.
const TRAZOS = {
  menu: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  ventas: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M12 11v5M10 13h3a1 1 0 010 2h-2" /></>,
  inventario: <><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  distribucion: <><path d="M4 7h11" /><path d="M12 4l3 3-3 3" /><path d="M20 17H9" /><path d="M12 14l-3 3 3 3" /></>,
  recetario: <><path d="M4 4h16l-8 9z" /><path d="M12 13v7M8 20h8" /></>,
  cierre: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /><path d="M12 15v2" /></>,
  reportes: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 17v-3M12 17v-5M15 17v-2" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  movimientos: <><path d="M7 4L3 8l4 4" /><path d="M3 8h14" /><path d="M17 20l4-4-4-4" /><path d="M21 16H7" /></>,
  usuarios: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.7a3.5 3.5 0 010 6.6" /><path d="M18 14.6c2 .7 3.5 2.5 3.5 5.4" /></>,
  semanal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M8 14h2M12 14h2M16 14h2M8 18h2M12 18h2" /></>,
};

function Icono({ id }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[id]}
    </svg>
  );
}

export default function Sidebar({ vista, setVista, abierto, setAbierto, vistasPermitidas, perfil, rolEtiqueta, onSalir }) {
  const items = ITEMS.filter((item) => vistasPermitidas.includes(item.id));
  return (
    <>
      <aside className={`sidebar ${abierto ? "sidebar--abierto" : ""}`}>
        <Logo clase="logo--sidebar" />
        <div className="sidebar__marca">
          <div>
            <div className="sidebar__nombre">LA TROJE</div>
            <div className="sidebar__sub">Sistema de caja</div>
          </div>
        </div>
        <nav className="sidebar__nav">
          {items.map((item) => (
            <button
              key={item.id}
              className={`sidebar__item ${vista === item.id ? "sidebar__item--activo" : ""}`}
              onClick={() => {
                setVista(item.id);
                setAbierto(false);
              }}
            >
              <span className="sidebar__icono"><Icono id={item.id} /></span>
              {item.etiqueta}
            </button>
          ))}
        </nav>
        <div className="sidebar__usuario">
          <div className="sidebar__usuario-datos">
            <span className="sidebar__usuario-nombre">{perfil?.nombre || perfil?.usuario}</span>
            <span className="sidebar__usuario-rol">{rolEtiqueta}</span>
          </div>
          <button type="button" className="sidebar__salir" onClick={onSalir}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>
      {abierto && <div className="sidebar__overlay" onClick={() => setAbierto(false)} />}
    </>
  );
}