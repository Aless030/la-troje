import { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db, ensureAuth } from "../firebase";
import { hashClave, nuevaSal } from "../utils/claves";

// Login sencillo: usuario + contraseña guardados en la colección "usuarios" de Firestore
// (la misma base de datos que ya usas). No requiere configurar nada nuevo en Firebase.
// El documento de cada usuario se llama igual que su usuario (ej. "maria").

const AuthContext = createContext(null);

const CLAVE_SESION = "la-troje-sesion";
export const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;
export const CLAVE_MINIMA = 4;
export const normalizarUsuario = (u) => String(u || "").trim().toLowerCase();

export function mensajeDeError(err) {
  const codigo = err?.message || err?.code || "";
  if (codigo === "CREDENCIALES") return "Usuario o contraseña incorrectos.";
  if (codigo === "YA_CONFIGURADO") return "El sistema ya tiene usuarios. Entra con tu usuario.";
  if (codigo === "YA_EXISTE") return "Ese usuario ya existe. Elige otro nombre de usuario.";
  if (codigo === "SIN_CRYPTO") return "Abre la página con https (el enlace de Netlify) para poder iniciar sesión.";
  if (String(err?.code || "").includes("permission-denied")) return "No tienes permiso para hacer esto.";
  if (String(err?.code || "").includes("unavailable") || String(err?.code || "").includes("network"))
    return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  return "Ocurrió un error. Inténtalo de nuevo.";
}

function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE_SESION) || "null");
    return s?.u && s?.h ? s : null;
  } catch {
    return null;
  }
}
function guardarSesion(s) {
  try {
    if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* sin almacenamiento: la sesión dura hasta cerrar la pestaña */
  }
}

export function AuthProvider({ children }) {
  const [firebaseListo, setFirebaseListo] = useState(false);
  const [sesion, setSesion] = useState(leerSesion); // { u: usuario, h: huella }
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  // Firebase mantiene su acceso anónimo interno (como siempre); el login de la app va encima.
  useEffect(() => {
    ensureAuth(() => setFirebaseListo(true));
  }, []);

  // Escucha el perfil en vivo: si te desactivan, te cambian el rol o la contraseña, se aplica al instante.
  useEffect(() => {
    if (!firebaseListo) return undefined;
    if (!sesion) {
      setPerfil(null);
      setCargando(false);
      return undefined;
    }
    setCargando(true);
    return onSnapshot(
      doc(db, "usuarios", sesion.u),
      (snap) => {
        if (!snap.exists() || snap.data().hash !== sesion.h) {
          guardarSesion(null);
          setSesion(null);
          setPerfil(null);
        } else {
          setPerfil({ id: snap.id, ...snap.data() });
        }
        setCargando(false);
      },
      (err) => {
        console.error("Error leyendo el perfil:", err);
        guardarSesion(null);
        setSesion(null);
        setCargando(false);
      }
    );
  }, [firebaseListo, sesion]);

  async function entrar(nombreUsuario, password) {
    const u = normalizarUsuario(nombreUsuario);
    const snap = await getDoc(doc(db, "usuarios", u));
    if (!snap.exists()) throw new Error("CREDENCIALES");
    const datos = snap.data();
    const hash = await hashClave(password, datos.sal);
    if (hash !== datos.hash) throw new Error("CREDENCIALES");
    const nueva = { u, h: hash };
    guardarSesion(nueva);
    setSesion(nueva);
  }

  function salir() {
    guardarSesion(null);
    setSesion(null);
  }

  async function crearDocumentoUsuario({ usuario, nombre, rol, password }) {
    const u = normalizarUsuario(usuario);
    const ref = doc(db, "usuarios", u);
    if ((await getDoc(ref)).exists()) throw new Error("YA_EXISTE");
    const sal = nuevaSal();
    const hash = await hashClave(password, sal);
    await setDoc(ref, { usuario: u, nombre: nombre.trim(), rol, activo: true, sal, hash, creadoEn: serverTimestamp() });
    return { u, hash };
  }

  // Un administrador (socio principal) crea las cuentas del personal.
  async function crearUsuario(datos) {
    await crearDocumentoUsuario(datos);
  }

  // Primera vez: no hay ningún usuario, se crea el socio principal (acceso total).
  async function configuracionInicial({ usuario, nombre, password }) {
    setOcupado(true);
    try {
      const hay = await getDocs(query(collection(db, "usuarios"), limit(1)));
      if (!hay.empty) throw new Error("YA_CONFIGURADO");
      const { u, hash } = await crearDocumentoUsuario({ usuario, nombre, rol: "socio_main", password });
      const nueva = { u, h: hash };
      guardarSesion(nueva);
      setSesion(nueva);
    } finally {
      setOcupado(false);
    }
  }

  // ¿Ya hay usuarios creados? (si no, el login muestra la configuración inicial)
  async function hayUsuarios() {
    await new Promise((res) => ensureAuth(() => res()));
    try {
      const r = await getDocs(query(collection(db, "usuarios"), limit(1)));
      return !r.empty;
    } catch {
      return true;
    }
  }

  // Cambia la contraseña de alguien (olvidó la suya). Cierra sus sesiones abiertas.
  async function cambiarClave(idUsuario, nuevaClave) {
    const sal = nuevaSal();
    const hash = await hashClave(nuevaClave, sal);
    await updateDoc(doc(db, "usuarios", idUsuario), { sal, hash });
    if (sesion && sesion.u === idUsuario) {
      const nueva = { u: idUsuario, h: hash };
      guardarSesion(nueva);
      setSesion(nueva);
    }
  }

  const usuario = sesion ? { uid: sesion.u } : null;
  // Mientras se lee el perfil de la sesión guardada, se considera "cargando" (evita parpadeos).
  const cargandoTotal = cargando || (sesion !== null && (!perfil || perfil.id !== sesion.u));

  return (
    <AuthContext.Provider
      value={{ usuario, perfil, cargando: cargandoTotal, ocupado, entrar, salir, configuracionInicial, hayUsuarios, crearUsuario, cambiarClave }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}