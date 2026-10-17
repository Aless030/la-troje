import { useEffect, useState } from "react";
import Logo from "../components/Logo";
import { CLAVE_MINIMA, USUARIO_VALIDO, mensajeDeError, useAuth } from "../context/AuthContext";

export default function Login() {
  const { entrar, configuracionInicial, hayUsuarios } = useAuth();
  const [modo, setModo] = useState("entrar"); // "entrar" | "inicial"
  const [form, setForm] = useState({ usuario: "", nombre: "", password: "", repetir: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Si todavía no existe ningún usuario, se muestra la configuración inicial.
    hayUsuarios().then((hay) => vivo && !hay && setModo("inicial"));
    return () => {
      vivo = false;
    };
  }, [hayUsuarios]);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setError("");
    const usuario = form.usuario.trim().toLowerCase();

    if (modo === "entrar") {
      if (!usuario || !form.password) return setError("Escribe tu usuario y tu contraseña.");
      setEnviando(true);
      try {
        await entrar(usuario, form.password);
      } catch (err) {
        setError(mensajeDeError(err));
        setEnviando(false);
      }
      return;
    }

    // Configuración inicial: el socio principal
    if (!USUARIO_VALIDO.test(usuario))
      return setError("El usuario debe tener entre 3 y 30 letras minúsculas, números, punto, guion o guion bajo (sin espacios).");
    if (!form.nombre.trim()) return setError("Escribe el nombre completo.");
    if (form.password.length < CLAVE_MINIMA) return setError(`La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.`);
    if (form.password !== form.repetir) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    try {
      await configuracionInicial({ usuario, nombre: form.nombre, password: form.password });
    } catch (err) {
      console.error(err);
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  const inicial = modo === "inicial";

  return (
    <div className="login">
      <div className="login__contenido">
        <Logo clase="logo--login" />
        <h1 className="login__marca">LA TROJE</h1>
        <p className="login__sub">Sistema de caja</p>

        <form className="login__tarjeta" onSubmit={enviar}>
          <h2>{inicial ? "Configuración inicial" : "Iniciar sesión"}</h2>
          {inicial && (
            <p className="login__ayuda">
              Crea la cuenta del <strong>socio principal</strong> (acceso total). Desde ahí podrás crear los
              usuarios de cajeras, meseros, almacén y demás.
            </p>
          )}

          <label>
            Usuario
            <input
              value={form.usuario}
              onChange={cambiar("usuario")}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Ej: adri"
              autoFocus
            />
          </label>

          {inicial && (
            <label>
              Nombre completo
              <input value={form.nombre} onChange={cambiar("nombre")} placeholder="Ej: Adriana Pérez" />
            </label>
          )}

          <label>
            Contraseña
            <div className="login__clave">
              <input
                type={verPassword ? "text" : "password"}
                value={form.password}
                onChange={cambiar("password")}
                autoComplete={inicial ? "new-password" : "current-password"}
                placeholder={inicial ? `Mínimo ${CLAVE_MINIMA} caracteres` : "Tu contraseña"}
              />
              <button type="button" className="login__ver" onClick={() => setVerPassword((v) => !v)}>
                {verPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          {inicial && (
            <label>
              Repetir contraseña
              <input
                type={verPassword ? "text" : "password"}
                value={form.repetir}
                onChange={cambiar("repetir")}
                autoComplete="new-password"
              />
            </label>
          )}

          {error && <div className="formulario__error">{error}</div>}

          <button type="submit" className="boton boton--primario login__boton" disabled={enviando}>
            {enviando ? (inicial ? "Creando…" : "Entrando…") : inicial ? "Crear socio principal" : "Entrar"}
          </button>

        </form>
      </div>
    </div>
  );
}

// Pantalla cuando la cuenta existe pero no tiene permiso (sin rol, desactivada...).
export function SinAcceso({ motivo }) {
  const { salir, perfil } = useAuth();
  const mensajes = {
    desactivada: "Tu cuenta está desactivada. Habla con el socio principal para que la reactive.",
    sinperfil: "Tu cuenta todavía no tiene un rol asignado. Habla con el socio principal.",
    rol: "Tu usuario tiene un rol que el sistema no reconoce. Habla con el socio principal.",
  };
  return (
    <div className="login">
      <div className="login__contenido">
        <Logo clase="logo--login" />
        <h1 className="login__marca">LA TROJE</h1>
        <div className="login__tarjeta">
          <h2>Sin acceso</h2>
          <p className="login__ayuda">{mensajes[motivo] || mensajes.sinperfil}</p>
          {perfil?.nombre && <p className="login__ayuda">Sesión: {perfil.nombre}</p>}
          <button type="button" className="boton boton--primario login__boton" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}