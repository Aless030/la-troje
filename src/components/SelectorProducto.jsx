import { useEffect, useMemo, useRef, useState } from "react";

// Quita tildes y mayúsculas: "Ron Añejo" se encuentra escribiendo "anejo".
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Resalta en negrita lo que la persona va escribiendo.
function Resaltado({ texto, buscar }) {
  const q = norm(buscar).trim();
  if (!q) return texto;
  const i = norm(texto).indexOf(q);
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + q.length)}</mark>
      {texto.slice(i + q.length)}
    </>
  );
}

/**
 * Buscador de producto: se escribe y la lista se filtra al instante.
 * opciones: [{ id, nombre, detalle? }]
 * value: id elegido ("" si ninguno). onChange(id).
 */
export default function SelectorProducto({ etiqueta = "Producto", opciones, value, onChange, placeholder = "Escribe para buscar…", vacio = "Ningún producto coincide." }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef(null);

  const elegido = opciones.find((o) => o.id === value) || null;

  const filtradas = useMemo(() => {
    const q = norm(texto).trim();
    const lista = q ? opciones.filter((o) => norm(o.nombre).includes(q)) : opciones;
    // Primero los que EMPIEZAN con lo escrito.
    return [...lista].sort((a, b) => {
      const pa = norm(a.nombre).startsWith(q) ? 0 : 1;
      const pb = norm(b.nombre).startsWith(q) ? 0 : 1;
      return pa - pb || a.nombre.localeCompare(b.nombre, "es");
    });
  }, [opciones, texto]);

  useEffect(() => setActivo(0), [texto]);

  // Cierra la lista al tocar fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
    };
  }, [abierto]);

  function elegir(o) {
    onChange(o.id);
    setTexto("");
    setAbierto(false);
  }

  function teclas(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActivo((a) => Math.min(a + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault();
      if (filtradas[activo]) elegir(filtradas[activo]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="selector-producto" ref={caja}>
      <span className="selector-producto__etiqueta">{etiqueta}</span>
      {elegido && !abierto ? (
        <div className="selector-producto__elegido">
          <div>
            <strong>{elegido.nombre}</strong>
            {elegido.detalle && <small>{elegido.detalle}</small>}
          </div>
          <button type="button" onClick={() => { onChange(""); setAbierto(true); }}>Cambiar</button>
        </div>
      ) : (
        <>
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            value={texto}
            placeholder={placeholder}
            onFocus={() => setAbierto(true)}
            onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
            onKeyDown={teclas}
          />
          {abierto && (
            <ul className="selector-producto__lista" role="listbox">
              {filtradas.length === 0 ? (
                <li className="selector-producto__vacio">{vacio}</li>
              ) : (
                filtradas.map((o, i) => (
                  <li key={o.id} role="option" aria-selected={i === activo}>
                    <button
                      type="button"
                      className={i === activo ? "activo" : ""}
                      onMouseEnter={() => setActivo(i)}
                      onClick={() => elegir(o)}
                    >
                      <span><Resaltado texto={o.nombre} buscar={texto} /></span>
                      {o.detalle && <small>{o.detalle}</small>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
          {abierto && texto.trim() && filtradas.length > 0 && (
            <span className="selector-producto__cuenta">{filtradas.length} resultado{filtradas.length === 1 ? "" : "s"}</span>
          )}
        </>
      )}
    </div>
  );
}