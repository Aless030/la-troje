import { useState } from "react";

// Espacio para el logo. Pon tu imagen en  public/logo.png  (fondo transparente o negro,
// idealmente blanca para que se vea sobre el menú negro). Mientras no exista,
// se muestra un recuadro "LOGO" como marcador.
export default function Logo({ clase = "" }) {
  const [falla, setFalla] = useState(false);
  return (
    <div className={`logo ${clase}`}>
      {falla ? (
        <div className="logo__vacio">LOGO</div>
      ) : (
        <img src="/logo.png" alt="La Troje" onError={() => setFalla(true)} />
      )}
    </div>
  );
}