import { useState } from "react";
import { DataProvider, useData } from "./context/DataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { puedeVer, rolValido, ROLES, vistaInicial, vistasDe } from "./utils/permisos";
import Sidebar from "./components/Sidebar";
import Logo from "./components/Logo";
import MenuPrincipal from "./pages/MenuPrincipal";
import Ventas from "./pages/Ventas";
import Inventario from "./pages/Inventario";
import Distribucion from "./pages/Distribucion";
import Recetario from "./pages/Recetario";
import CierreCaja from "./pages/CierreCaja";
import Reportes from "./pages/Reportes";
import DashboardPage from "./pages/DashboardPage";
import MovimientosCaja from "./pages/MovimientosCaja";
import Semanales from "./pages/Semanales";
import Usuarios from "./pages/Usuarios";
import Login, { SinAcceso } from "./pages/Login";
import "./App.css";

function Contenido({ vista, setVista, rol }) {
  const { listo } = useData();

  if (!listo) {
    return (
      <div className="cargando">
        <div className="cargando__grano">◆</div>
        <p>Conectando con La Troje…</p>
      </div>
    );
  }

  // Seguridad en pantalla: si el rol no puede ver esta vista, se muestra la suya.
  if (!puedeVer(rol, vista)) vista = vistaInicial(rol);

  switch (vista) {
    case "ventas":
      return <Ventas />;
    case "inventario":
      return <Inventario />;
    case "distribucion":
      return <Distribucion />;
    case "recetario":
      return <Recetario />;
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
    case "usuarios":
      return <Usuarios />;
    default:
      return <MenuPrincipal irA={setVista} permitidas={vistasDe(rol)} />;
  }
}

function Aplicacion({ perfil }) {
  const { salir } = useAuth();
  const [vista, setVista] = useState(vistaInicial(perfil.rol));
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  return (
    <DataProvider>
      <div className="app">
        <Sidebar
          vista={vista}
          setVista={setVista}
          abierto={sidebarAbierto}
          setAbierto={setSidebarAbierto}
          vistasPermitidas={vistasDe(perfil.rol)}
          perfil={perfil}
          rolEtiqueta={ROLES[perfil.rol].etiqueta}
          onSalir={salir}
        />
        <div className="app__principal">
          <div className="app__barra-movil">
            <button className="app__boton-menu" onClick={() => setSidebarAbierto(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Logo clase="logo--barra" />
            <span>LA TROJE</span>
          </div>
          <main className="app__contenido">
            <Contenido vista={vista} setVista={setVista} rol={perfil.rol} />
          </main>
        </div>
      </div>
    </DataProvider>
  );
}

// Decide qué mostrar según la sesión: cargando, login, sin acceso o la aplicación.
function Portal() {
  const { usuario, perfil, cargando, ocupado } = useAuth();

  if (cargando && !ocupado) {
    return (
      <div className="login">
        <div className="cargando cargando--oscuro">
          <div className="cargando__grano">◆</div>
          <p>Cargando…</p>
        </div>
      </div>
    );
  }
  if (!usuario || ocupado) return <Login />;
  if (!perfil) return <SinAcceso motivo="sinperfil" />;
  if (perfil.activo === false) return <SinAcceso motivo="desactivada" />;
  if (!rolValido(perfil.rol)) return <SinAcceso motivo="rol" />;
  // key: al cambiar de usuario en el mismo navegador se reinicia todo (vista y datos).
  return <Aplicacion key={usuario.uid} perfil={perfil} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Portal />
    </AuthProvider>
  );
}