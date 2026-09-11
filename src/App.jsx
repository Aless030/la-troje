import { useState } from "react";
import { DataProvider, useData } from "./context/DataContext";
import Sidebar from "./components/Sidebar";
import MenuPrincipal from "./pages/MenuPrincipal";
import Ventas from "./pages/Ventas";
import Inventario from "./pages/Inventario";
import CierreCaja from "./pages/CierreCaja";
import Reportes from "./pages/Reportes";
import DashboardPage from "./pages/DashboardPage";
import MovimientosCaja from "./pages/MovimientosCaja";
import Semanales from "./pages/Semanales";
import "./App.css";

function Contenido({ vista, setVista }) {
  const { listo } = useData();

  if (!listo) {
    return (
      <div className="cargando">
        <div className="cargando__grano">◆</div>
        <p>Conectando con La Troje…</p>
      </div>
    );
  }

  switch (vista) {
    case "ventas":
      return <Ventas />;
    case "inventario":
      return <Inventario />;
    case "cierre":
      return <CierreCaja />;
    case "reportes":
      return <Reportes />;
    case "dashboard":
      return <DashboardPage />;
    case "movimientos":
      return <MovimientosCaja />;
    case "semanal":
      return <Semanales />;
    default:
      return <MenuPrincipal irA={setVista} />;
  }
}

export default function App() {
  const [vista, setVista] = useState("menu");
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  return (
    <DataProvider>
      <div className="app">
        <Sidebar
          vista={vista}
          setVista={setVista}
          abierto={sidebarAbierto}
          setAbierto={setSidebarAbierto}
        />
        <div className="app__principal">
          <div className="app__barra-movil">
            <button className="app__boton-menu" onClick={() => setSidebarAbierto(true)}>
              ☰
            </button>
            <span>LA TROJE</span>
          </div>
          <main className="app__contenido">
            <Contenido vista={vista} setVista={setVista} />
          </main>
        </div>
      </div>
    </DataProvider>
  );
}
