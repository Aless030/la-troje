import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { LISTA_ROLES, ROLES } from "../utils/permisos";
import LimpiarDatos from "../components/Limpiardatos";
import { CLAVE_MINIMA, USUARIO_VALIDO, mensajeDeError, useAuth } from "../context/AuthContext";

const FORM_VACIO = { usuario: "", nombre: "", rol: "cajera", password: "" };

export default function Usuarios() {
  const { usuario: yo, crearUsuario, cambiarClave } = useAuth();
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const desuscribir = onSnapshot(
      collection(db, "usuarios"),
      (snap) => {
        setLista(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => {
        console.error("Error leyendo usuarios:", err);
        setError("No se pudo leer la lista de usuarios.");
        setCargando(false);
      }
    );
    return () => desuscribir();
  }, []);

  const ordenada = useMemo(
    () => [...lista].sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")),
    [lista]
  );

  async function crear(e) {
    e.preventDefault();
    if (guardando) return;
    setError("");
    setExito("");
    const usuario = form.usuario.trim().toLowerCase();
    if (!USUARIO_VALIDO.test(usuario))
      return setError("El usuario debe tener entre 3 y 30 letras minúsculas, números, punto, guion o guion bajo (sin espacios).");
    if (!form.nombre.trim()) return setError("Escribe el nombre de la persona.");
    if (form.password.length < CLAVE_MINIMA) return setError(`La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.`);
    if (lista.some((u) => u.usuario === usuario)) return setError("Ese usuario ya existe.");

    setGuardando(true);
    try {
      await crearUsuario({ usuario, nombre: form.nombre, rol: form.rol, password: form.password });
      setExito(`Usuario «${usuario}» creado. Entrega el usuario y la contraseña a ${form.nombre.trim()}.`);
      setForm(FORM_VACIO);
    } catch (err) {
      console.error(err);
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarRol(u, rol) {
    setError("");
    setExito("");
    try {
      await updateDoc(doc(db, "usuarios", u.id), { rol });
    } catch (err) {
      console.error(err);
      setError(mensajeDeError(err));
    }
  }

  async function nuevaClave(u) {
    setError("");
    setExito("");
    const clave = window.prompt(`Nueva contraseña para ${u.nombre} (mínimo ${CLAVE_MINIMA} caracteres):`);
    if (clave === null) return;
    if (clave.length < CLAVE_MINIMA) return setError(`La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.`);
    try {
      await cambiarClave(u.id, clave);
      setExito(`Contraseña de ${u.nombre} actualizada. Si tenía la sesión abierta, tendrá que entrar de nuevo.`);
    } catch (err) {
      console.error(err);
      setError(mensajeDeError(err));
    }
  }

  async function alternarActivo(u) {
    setError("");
    setExito("");
    const nuevo = u.activo === false;
    if (!nuevo && !window.confirm(`¿Desactivar a ${u.nombre}? Ya no podrá entrar al sistema.`)) return;
    try {
      await updateDoc(doc(db, "usuarios", u.id), { activo: nuevo });
    } catch (err) {
      console.error(err);
      setError(mensajeDeError(err));
    }
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Usuarios</h1>
        <p>Crea las cuentas del personal y elige qué puede ver cada uno.</p>
      </header>

      <form className="formulario" onSubmit={crear}>
        <h2>Nuevo usuario</h2>
        <div className="formulario__fila">
          <label>
            Usuario (para entrar)
            <input
              value={form.usuario}
              onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Ej: maria"
            />
          </label>
          <label>
            Nombre completo
            <input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: María Quispe"
            />
          </label>
        </div>
        <div className="formulario__fila">
          <label>
            Rol
            <select value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}>
              {LISTA_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLES[r].etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contraseña inicial
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="off"
              placeholder={`Mínimo ${CLAVE_MINIMA} caracteres`}
            />
          </label>
        </div>
        {error && <div className="formulario__error">{error}</div>}
        {exito && <div className="formulario__error formulario__error--exito">{exito}</div>}
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? "Creando…" : "Crear usuario"}
        </button>
      </form>

      <section className="lista-reciente">
        <h2>Personal con acceso</h2>
        {cargando ? (
          <p className="texto-vacio">Cargando…</p>
        ) : ordenada.length === 0 ? (
          <p className="texto-vacio">Todavía no hay usuarios.</p>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ordenada.map((u) => {
                  const soyYo = u.id === yo?.uid;
                  const activo = u.activo !== false;
                  return (
                    <tr key={u.id} className={activo ? "" : "tabla__fila--inactiva"}>
                      <td>
                        {u.nombre || "—"} {soyYo && <span className="etiqueta-yo">(tú)</span>}
                      </td>
                      <td>{u.usuario || "—"}</td>
                      <td>
                        <select
                          className="celda-editable celda-editable--ancha"
                          value={u.rol}
                          disabled={soyYo}
                          onChange={(e) => cambiarRol(u, e.target.value)}
                        >
                          {!ROLES[u.rol] && <option value={u.rol}>{u.rol || "sin rol"}</option>}
                          {LISTA_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLES[r].etiqueta}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`estado-pill ${activo ? "estado-pill--ok" : "estado-pill--off"}`}>
                          {activo ? "Activo" : "Desactivado"}
                        </span>
                      </td>
                      <td className="celda-acciones">
                        <button type="button" className="boton boton--fantasma" onClick={() => nuevaClave(u)}>
                          Cambiar contraseña
                        </button>
                        {!soyYo && (
                          <button type="button" className="boton boton--fantasma" onClick={() => alternarActivo(u)}>
                            {activo ? "Desactivar" : "Reactivar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="texto-vacio" style={{ marginTop: 12 }}>
          Si alguien olvida su contraseña, usa «Cambiar contraseña» y entrégale la nueva.
        </p>
      </section>

      <LimpiarDatos />
    </div>
  );
}