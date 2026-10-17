// Roles de La Troje y a qué pantallas puede entrar cada uno.
// Pantallas: menu, ventas, inventario, distribucion, recetario, cierre,
// reportes, dashboard, movimientos, semanal, usuarios.

export const TODAS_LAS_VISTAS = [
  "menu", "ventas", "inventario", "distribucion", "recetario",
  "cierre", "reportes", "dashboard", "movimientos", "semanal", "usuarios",
];

export const ROLES = {
  cajera: {
    etiqueta: "Cajera",
    vistas: ["ventas"],
  },
  mesero: {
    etiqueta: "Mesero",
    vistas: ["ventas"],
  },
  almacen: {
    etiqueta: "Encargada de almacén",
    vistas: ["menu", "inventario", "ventas", "distribucion"],
  },
  administrador: {
    etiqueta: "Administrador",
    vistas: ["menu", "reportes", "dashboard"],
  },
  socio_aux: {
    etiqueta: "Socio auxiliar (solo ver)",
    vistas: ["menu", "reportes", "dashboard"],
    soloLectura: true,
  },
  socio_main: {
    etiqueta: "Socio principal (acceso total)",
    vistas: TODAS_LAS_VISTAS,
  },
};

export const LISTA_ROLES = Object.keys(ROLES);

export function rolValido(rol) {
  return Object.prototype.hasOwnProperty.call(ROLES, rol);
}

export function vistasDe(rol) {
  return rolValido(rol) ? ROLES[rol].vistas : [];
}

export function puedeVer(rol, vista) {
  return vistasDe(rol).includes(vista);
}

export function esSoloLectura(rol) {
  return rolValido(rol) && Boolean(ROLES[rol].soloLectura);
}

// Primera pantalla al entrar: el menú si lo tiene, si no la primera que le corresponda.
export function vistaInicial(rol) {
  const v = vistasDe(rol);
  return v.includes("menu") ? "menu" : v[0] || "menu";
}