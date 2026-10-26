// Un "evento" es la noche/fiesta completa (ej. "Jueves Universitario"), sin importar
// que pase de medianoche. Se define al abrir la caja de cada barra: las cajas que se
// abren con el mismo nombre de evento (Interior y Semicubierto) comparten el mismo
// eventoId, y todo lo que ocurre en esas cajas (ventas, gastos, cierres) queda en él.

const VENTANA_MISMO_EVENTO_MS = 24 * 60 * 60 * 1000;
// Datos viejos (sin evento): se agrupan por "noche" restando 8 h a la hora, así lo
// vendido de madrugada cuenta con la noche anterior y no con "hoy".
const CORTE_NOCHE_MS = 8 * 60 * 60 * 1000;

export function normalizarNombreEvento(nombre) {
  return String(nombre || "").trim().replace(/\s+/g, " ");
}

const clave = (nombre) => normalizarNombreEvento(nombre).toLowerCase();

function fechaLocal(d) {
  const x = new Date(d);
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${mm}-${dd}`;
}

function slug(texto) {
  return (
    String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "evento"
  );
}

function nocheDe(fechaIso) {
  return fechaLocal(new Date(fechaIso).getTime() - CORTE_NOCHE_MS);
}

export function fechaCortaEvento(fechaIso) {
  if (!fechaIso) return "";
  return new Date(fechaIso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Identificador del evento de una apertura de caja. Si la apertura es anterior a esta
// función (no tiene evento), se agrupa por noche.
export function eventoDeApertura(apertura) {
  if (!apertura) return { id: "sin-evento", nombre: "Sin evento" };
  if (apertura.eventoId) {
    return { id: apertura.eventoId, nombre: normalizarNombreEvento(apertura.evento) || "Sin nombre" };
  }
  return { id: `sin-evento-${nocheDe(apertura.fecha)}`, nombre: "Sin nombre" };
}

// Al abrir una caja: si hay una caja del mismo evento (mismo nombre) abierta o cerrada hace
// menos de 24 h, se reutiliza su eventoId (así las dos barras caen en el mismo evento).
// Si no, se crea un evento nuevo.
export function resolverEventoParaApertura(nombre, aperturas) {
  const limpio = normalizarNombreEvento(nombre);
  const ahora = Date.now();
  const parecida = aperturas
    .filter(
      (a) =>
        a.eventoId &&
        clave(a.evento) === clave(limpio) &&
        ahora - new Date(a.fecha).getTime() < VENTANA_MISMO_EVENTO_MS
    )
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
  if (parecida) return { evento: parecida.evento, eventoId: parecida.eventoId };
  const azar = Math.random().toString(36).slice(2, 6);
  return { evento: limpio, eventoId: `${slug(limpio)}-${fechaLocal(new Date())}-${azar}` };
}

export function mapaAperturas(aperturas) {
  const m = {};
  aperturas.forEach((a) => {
    m[a.id] = a;
  });
  return m;
}

// Evento de una venta, un gasto o un cierre: usa su propio eventoId; si no lo tiene (datos
// viejos) lo toma de su apertura; y si tampoco, lo agrupa por noche según su fecha.
export function eventoDeRegistro(reg, aperturasPorId) {
  if (reg?.eventoId) return { id: reg.eventoId, nombre: normalizarNombreEvento(reg.evento) || "Sin nombre" };
  const ap = reg?.aperturaId ? aperturasPorId?.[reg.aperturaId] : null;
  if (ap) return eventoDeApertura(ap);
  return { id: `sin-evento-${nocheDe(reg?.fecha || Date.now())}`, nombre: "Sin nombre" };
}

export function etiquetaEvento(ev) {
  if (!ev) return "";
  const fecha = fechaCortaEvento(ev.inicio);
  return fecha ? `${ev.nombre} · ${fecha}` : ev.nombre;
}

// Lista de eventos (el más reciente primero) a partir de aperturas, ventas y cierres.
export function listarEventos({ aperturas = [], ventas = [], cierres = [] }) {
  const porId = aperturasPorIdSeguro(aperturas);
  const mapa = {};
  const registrar = (ev, fecha) => {
    const t = new Date(fecha).getTime() || 0;
    if (!mapa[ev.id]) mapa[ev.id] = { id: ev.id, nombre: ev.nombre, inicioMs: t };
    else {
      if (t && (!mapa[ev.id].inicioMs || t < mapa[ev.id].inicioMs)) mapa[ev.id].inicioMs = t;
      if (mapa[ev.id].nombre === "Sin nombre" && ev.nombre !== "Sin nombre") mapa[ev.id].nombre = ev.nombre;
    }
  };
  aperturas.forEach((a) => registrar(eventoDeApertura(a), a.fecha));
  ventas.forEach((v) => registrar(eventoDeRegistro(v, porId), v.fecha));
  cierres.forEach((c) => registrar(eventoDeRegistro(c, porId), c.fechaApertura || c.fecha));
  return Object.values(mapa)
    .map((e) => {
      const inicio = e.inicioMs ? new Date(e.inicioMs).toISOString() : null;
      return { id: e.id, nombre: e.nombre, inicio, etiqueta: etiquetaEvento({ nombre: e.nombre, inicio }) };
    })
    .sort((a, b) => new Date(b.inicio || 0) - new Date(a.inicio || 0));
}

function aperturasPorIdSeguro(aperturas) {
  return mapaAperturas(aperturas);
}

// Nombres de eventos recientes para sugerir al abrir una caja (sin repetir).
export function nombresEventosRecientes(aperturas, dias = 60) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  const vistos = new Set();
  const nombres = [];
  [...aperturas]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach((a) => {
      if (!a.evento || new Date(a.fecha).getTime() < limite) return;
      const k = clave(a.evento);
      if (vistos.has(k)) return;
      vistos.add(k);
      nombres.push(normalizarNombreEvento(a.evento));
    });
  return nombres;
}

export function nombreArchivoEvento(ev) {
  return ev ? slug(ev.nombre) + (ev.inicio ? `-${fechaLocal(ev.inicio)}` : "") : "todos";
}