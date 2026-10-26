import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../context/DataContext";
import ReporteCierre from "../components/ReporteTurno";
import { buscarAperturasActivas, cerrarTurno } from "../utils/Turno";
import { consumoReceta, dosisPorBotella, formatearStock, redondear4, tragosDisponibles } from "../utils/Dosiscasa";
import {
  eventoDeApertura, eventoDeRegistro, listarEventos, mapaAperturas, nombresEventosRecientes,
} from "../utils/Evento";

function fechaHoyISO() {
  return new Date().toISOString();
}

const BARRAS = [
  { valor: "interior", etiqueta: "Interior" },
  { valor: "semicubierto", etiqueta: "Semicubierto" },
];

function campoBarra(barra) {
  return barra === "interior" ? "stockInterior" : "stockSemicubierto";
}

const VACIO = {
  cajera: "",
  comanda: "",
  barra: "interior",
  mesero: "",
  productoId: "",
  unidad: "Botella",
  cantidad: 1,
  formaPago: "efectivo",
  montoQr: "",
  montoEfectivo: "",
  observaciones: "",
  complemento: "",
};

// Quita tildes y mayúsculas: "Ron Añejo" se encuentra escribiendo "anejo".
const norm = (s) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* =========================================================
   BUSCADOR DE PRODUCTO (computadora: desplegable / celular: pantalla completa)
   ========================================================= */
function BuscadorProducto({
  opciones, // [{ valor, nombre, grupo, detalle, deshabilitado }]
  valor,
  onChange, // recibe el valor elegido ("" para limpiar)
  placeholder = "Toca para buscar un producto…",
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [indice, setIndice] = useState(0);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  const seleccionada = opciones.find((o) => o.valor === valor);

  const filtradas = useMemo(() => {
    const palabras = norm(q).split(/\s+/).filter(Boolean);
    return opciones.filter((o) => palabras.every((w) => norm(o.nombre).includes(w)));
  }, [opciones, q]);

  const habilitadas = useMemo(() => filtradas.filter((o) => !o.deshabilitado), [filtradas]);
  const activo = habilitadas[indice]?.valor;

  // Al abrir: enfoca el buscador y (en celular) bloquea el scroll de fondo.
  useEffect(() => {
    if (!abierto) return;
    inputRef.current?.focus();
    const movil = window.matchMedia("(max-width: 860px)").matches;
    const previo = document.body.style.overflow;
    if (movil) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // Mantiene visible la opción marcada con el teclado.
  useEffect(() => {
    listaRef.current?.querySelector('[data-activo="true"]')?.scrollIntoView({ block: "nearest" });
  }, [indice, filtradas]);

  function abrir() {
    setQ("");
    setIndice(0);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  function elegir(o) {
    if (o.deshabilitado) return;
    onChange(o.valor);
    cerrar();
  }

  function teclas(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, habilitadas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // evita enviar el formulario de venta
      if (habilitadas[indice]) elegir(habilitadas[indice]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    }
  }

  let grupoAnterior = null;

  return (
    <div className="buscador">
      <button
        type="button"
        className={`buscador__boton ${seleccionada ? "" : "buscador__boton--vacio"}`}
        onClick={abrir}
      >
        <span className="buscador__texto">{seleccionada ? seleccionada.nombre : placeholder}</span>
        {!seleccionada && <span className="buscador__flecha">▾</span>}
      </button>
      {seleccionada && (
        <button type="button" className="buscador__limpiar" onClick={() => onChange("")} aria-label="Quitar selección">
          ✕
        </button>
      )}

      {abierto && (
        <>
          <div className="buscador__fondo" onClick={cerrar} />
          <div className="buscador__panel">
            <div className="buscador__cabecera">
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIndice(0);
                }}
                onKeyDown={teclas}
                placeholder="Escribe para buscar…"
                autoComplete="off"
                enterKeyHint="done"
              />
              <button type="button" className="buscador__cerrar" onClick={cerrar}>
                Cancelar
              </button>
            </div>

            <ul className="buscador__lista" role="listbox" ref={listaRef}>
              {filtradas.length === 0 && (
                <li className="buscador__vacio">Sin resultados para “{q}”</li>
              )}
              {filtradas.map((o) => {
                const cabecera = o.grupo !== grupoAnterior ? o.grupo : null;
                grupoAnterior = o.grupo;
                return (
                  <li key={o.valor} role="presentation">
                    {cabecera && <div className="buscador__grupo">{cabecera}</div>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.valor === valor}
                      data-activo={o.valor === activo}
                      disabled={o.deshabilitado}
                      className={`buscador__opcion ${o.valor === activo ? "buscador__opcion--activa" : ""}`}
                      onClick={() => elegir(o)}
                      onMouseEnter={() => {
                        const i = habilitadas.findIndex((h) => h.valor === o.valor);
                        if (i >= 0) setIndice(i);
                      }}
                    >
                      <span className="buscador__nombre">{o.nombre}</span>
                      <span
                        className={`buscador__detalle ${o.deshabilitado ? "buscador__detalle--agotado" : ""}`}
                      >
                        {o.detalle}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default function Ventas() {
  const {
    productos, recetas, ventas, aperturasCaja, gastosCaja,
    registrarVenta, registrarAperturaCaja, registrarGastoCaja, registrarCierre, cerrarAperturaCaja
  } = useData();
  const [form, setForm] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [precioEditado, setPrecioEditado] = useState("");
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [aperturaForm, setAperturaForm] = useState({ cajera: "", cajaChica: "", barra: "interior", meseros: "", evento: "" });
  // Evento cuyas ventas se listan abajo ("" = el de la caja abierta, o el más reciente).
  const [eventoVistaId, setEventoVistaId] = useState("");
  const [gastoForm, setGastoForm] = useState({ concepto: "", monto: "", observaciones: "" });
  const [mensajeApertura, setMensajeApertura] = useState("");
  const [mensajeGasto, setMensajeGasto] = useState("");
  const [productosComanda, setProductosComanda] = useState([]);
  const [cerrandoCaja, setCerrandoCaja] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [reporteCierre, setReporteCierre] = useState(null);
  // Varias cajas pueden estar abiertas a la vez (ej. Interior y Semicubierto).
  const [aperturaIdElegida, setAperturaIdElegida] = useState(null);
  const [abriendoOtra, setAbriendoOtra] = useState(false);

  // Cajas abiertas (últimas 24 h) y la que se está usando ahora para vender.
  const aperturasActivas = useMemo(() => buscarAperturasActivas(aperturasCaja), [aperturasCaja]);
  const aperturaActiva = useMemo(
    () => aperturasActivas.find((a) => a.id === aperturaIdElegida) || aperturasActivas[0] || null,
    [aperturasActivas, aperturaIdElegida]
  );
  // Si se está abriendo otra caja se oculta la caja actual para no confundir.
  const cajaVisible = aperturaActiva && !abriendoOtra;

  // La barra activa es la de la caja abierta (así no depende del formulario al recargar).
  const campoActivo = campoBarra(aperturaActiva?.barra || form.barra);
  const productoSel = productos.find((p) => p.id === form.productoId);
  // Los tragos de Recetario también se venden: se eligen como "receta:<id>".
  const tragoSel = recetas.find((r) => `receta:${r.id}` === form.productoId);
  const itemSel = productoSel || tragoSel || null;
  // Unidad de venta: un trago siempre es Vaso; un producto se elige (Botella o Vaso).
  const unidadSel = tragoSel ? "Vaso" : form.unidad === "Vaso" ? "Vaso" : "Botella";
  const stockDisponible = productoSel
    ? Number(productoSel[campoActivo] || 0)
    : tragoSel
    ? tragosDisponibles(tragoSel, productos, campoActivo)
    : 0;
  const precioSugerido = productoSel
    ? unidadSel === "Vaso"
      ? Number(productoSel.precioVaso || 0)
      : (productoSel.precioVenta ?? productoSel.precio ?? 0)
    : tragoSel
    ? Number(tragoSel.precioVenta || 0)
    : 0;
  const precioUnitario = editandoPrecio && precioEditado !== "" ? Number(precioEditado) : precioSugerido;
  const totalProducto = precioUnitario * (Number(form.cantidad) || 0);
  const totalComanda = productosComanda.reduce((s, p) => s + Number(p.total || 0), 0);
  // Solo cuenta lo que está en la lista de la comanda
  const totalVentaActual = totalComanda;

  const efectivoRecibido = form.formaPago === "efectivo" ? Number(form.montoEfectivo) || 0 : 0;
  const cambio = form.formaPago === "efectivo" && efectivoRecibido > 0 ? Math.max(0, efectivoRecibido - totalVentaActual) : 0;

  const esCortesia = form.formaPago === "cortesia";

  const meserosPrevios = useMemo(() => {
    const nombres = new Set(ventas.map((v) => v.mesero).filter(Boolean));
    return Array.from(nombres);
  }, [ventas]);

  const cajerasPrevias = useMemo(() => {
    const nombres = new Set(ventas.map((v) => v.cajera).filter(Boolean));
    return Array.from(nombres);
  }, [ventas]);

  const tragosLista = useMemo(
    () =>
      recetas
        .map((r) => ({ receta: r, disponibles: tragosDisponibles(r, productos, campoActivo) }))
        .sort((a, b) => (a.receta.nombre || "").localeCompare(b.receta.nombre || "", "es")),
    [recetas, productos, campoActivo]
  );

  // Qué ingrediente de un trago falta en la barra activa (para explicarlo en la lista).
  function faltanteDeTrago(receta) {
    const consumo = consumoReceta(receta, productos);
    if (consumo.length === 0) return "ingredientes sin dosis/volumen válido en Recetario";
    const falta = consumo.find((c) => Number(productos.find((x) => x.id === c.productoId)?.[campoActivo] || 0) + 1e-9 < c.cantidad);
    return falta ? `falta ${productos.find((x) => x.id === falta.productoId)?.nombre || "insumo"} en esta barra` : "";
  }

  // Opciones que ve el buscador (productos + tragos de Recetario).
  const opcionesBuscador = useMemo(
    () => [
      ...productos.map((p) => {
        const s = Number(p[campoActivo] ?? 0);
        return {
          valor: p.id,
          nombre: p.nombre,
          grupo: "Productos",
          detalle: s <= 0 ? "sin stock aquí" : `stock: ${formatearStock(s)}`,
          deshabilitado: s <= 0,
        };
      }),
      ...tragosLista.map(({ receta, disponibles }) => ({
        valor: `receta:${receta.id}`,
        nombre: receta.nombre,
        grupo: "Tragos",
        detalle: disponibles <= 0 ? faltanteDeTrago(receta) || "sin insumos aquí" : `alcanza para: ${disponibles}`,
        deshabilitado: disponibles <= 0,
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productos, tragosLista, campoActivo]
  );

  // Qué productos del inventario gasta una línea de la comanda (un trago gasta
  // cada ingrediente de su receta, en fracciones de botella).
  function consumoDeLinea(linea) {
    if (linea.recetaId) {
      const receta = recetas.find((r) => r.id === linea.recetaId);
      return consumoReceta(receta, productos).map((c) => ({
        productoId: c.productoId,
        cantidad: c.cantidad * Number(linea.cantidad || 0),
      }));
    }
    if (linea.unidad === "Vaso") {
      // Un producto vendido por vaso gasta una dosis de la casa (fracción de botella).
      const p = productos.find((x) => x.id === linea.productoId);
      const dosis = dosisPorBotella(p);
      return dosis > 0 ? [{ productoId: linea.productoId, cantidad: Number(linea.cantidad || 0) / dosis }] : [];
    }
    return [{ productoId: linea.productoId, cantidad: Number(linea.cantidad || 0) }];
  }

  // Revisa que alcance el inventario de la barra para todas las líneas juntas.
  function validarStock(lineas) {
    const total = {};
    lineas.forEach((l) =>
      consumoDeLinea(l).forEach((c) => {
        total[c.productoId] = (total[c.productoId] || 0) + c.cantidad;
      })
    );
    for (const [id, necesario] of Object.entries(total)) {
      const p = productos.find((x) => x.id === id);
      const hay = Number(p?.[campoActivo] || 0);
      if (hay + 1e-9 < necesario) {
        return `No alcanza "${p?.nombre || "producto"}" en esta barra: hay ${formatearStock(hay)} y se necesita ${formatearStock(necesario)}.`;
      }
    }
    return "";
  }

  const cajerasAperturaPrevias = useMemo(() => {
    const nombres = new Set([
      ...cajerasPrevias,
      ...aperturasCaja.map((a) => a.cajera).filter(Boolean),
    ]);
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, "es"));
  }, [cajerasPrevias, aperturasCaja]);

  const meserosAperturaPrevios = useMemo(() => {
    const nombres = new Set(meserosPrevios);
    aperturasCaja.forEach((a) => {
      (a.meseros || []).forEach((m) => nombres.add(m));
    });
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, "es"));
  }, [meserosPrevios, aperturasCaja]);

  // Las ventas se ven por EVENTO (la noche completa), no por fecha: así lo vendido
  // después de medianoche sigue en el evento de la noche y no se mezcla con "hoy".
  const aperturasPorId = useMemo(() => mapaAperturas(aperturasCaja), [aperturasCaja]);
  const eventos = useMemo(() => listarEventos({ aperturas: aperturasCaja, ventas }), [aperturasCaja, ventas]);
  const eventoActual = useMemo(() => (aperturaActiva ? eventoDeApertura(aperturaActiva) : null), [aperturaActiva]);
  const nombresEventos = useMemo(() => nombresEventosRecientes(aperturasCaja), [aperturasCaja]);
  const eventoVistaActivo =
    eventoVistaId && eventos.some((e) => e.id === eventoVistaId)
      ? eventoVistaId
      : eventoActual?.id || eventos[0]?.id || "";
  const ventasDelEvento = useMemo(
    () => ventas.filter((v) => eventoDeRegistro(v, aperturasPorId).id === eventoVistaActivo),
    [ventas, aperturasPorId, eventoVistaActivo]
  );
  const ventasEventoRecientes = ventasDelEvento.slice(0, 20);

  // Siguiente N° de comanda para cada mesero, según su última venta registrada
  const siguienteComandaPorMesero = useMemo(() => {
    const ultimo = {};
    ventas.forEach((v) => {
      if (!v.mesero) return;
      const n = Number(v.comanda);
      if (!Number.isFinite(n)) return;
      const t = new Date(v.fecha).getTime() || 0;
      const prev = ultimo[v.mesero];
      if (!prev || t > prev.t || (t === prev.t && n > prev.n)) ultimo[v.mesero] = { n, t };
    });
    const sig = {};
    Object.entries(ultimo).forEach(([m, { n }]) => {
      sig[m] = String(n + 1);
    });
    return sig;
  }, [ventas]);

  function cambiarMesero(mesero) {
    setForm((f) => ({ ...f, mesero, comanda: siguienteComandaPorMesero[mesero] || "" }));
  }

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function cambiarUnidad(unidad) {
    setForm((f) => ({ ...f, unidad }));
    setEditandoPrecio(false);
    setPrecioEditado("");
  }

  // Se llama desde el buscador al elegir un producto o trago.
  function elegirProducto(id) {
    const elegido = productos.find((p) => p.id === id);
    setForm((f) => ({
      ...f,
      productoId: id,
      unidad: elegido?.unidadVenta === "Vaso" ? "Vaso" : "Botella",
    }));
    setEditandoPrecio(false);
    setPrecioEditado("");
  }

  function cambiarBarra(barra) {
    setForm((f) => ({ ...f, barra, productoId: "" }));
  }

  // Cambia de caja (ej. de Interior a Semicubierto). Cada caja vende y descuenta de su barra.
  function elegirCaja(a) {
    setAbriendoOtra(false);
    if (a.id === aperturaActiva?.id) return;
    if (
      productosComanda.length > 0 &&
      !window.confirm("Tienes productos sin registrar en esta comanda. Si cambias de caja se perderán. ¿Cambiar de caja?")
    )
      return;
    setAperturaIdElegida(a.id);
    setProductosComanda([]);
    setForm({ ...VACIO, cajera: a.cajera, barra: a.barra });
    setPrecioEditado("");
    setEditandoPrecio(false);
    setError("");
  }

  async function abrirCaja(e) {
    e.preventDefault();
    if (abriendo) return;
    setMensajeApertura("");
    const cajera = aperturaForm.cajera.trim();
    const meseros = aperturaForm.meseros.split(",").map((m) => m.trim()).filter(Boolean);
    const cajaChica = Number(aperturaForm.cajaChica) || 0;
    if (!cajera) return setMensajeApertura("Escribe el nombre de la persona que abre la caja.");
    if (cajaChica < 0) return setMensajeApertura("La caja chica no puede ser negativa.");
    if (meseros.length === 0) return setMensajeApertura("Escribe al menos un mesero.");
    const evento = aperturaForm.evento.trim();
    if (!evento) return setMensajeApertura("Escribe el nombre del evento (ej: Jueves Universitario).");
    setAbriendo(true);
    try {
      const nuevaId = await registrarAperturaCaja({
        fecha: fechaHoyISO(), cajera, barra: aperturaForm.barra, meseros, cajaChica, evento,
      });
      setReporteCierre(null);
      setProductosComanda([]);
      setForm({ ...VACIO, cajera, barra: aperturaForm.barra });
      if (nuevaId) setAperturaIdElegida(nuevaId);
      setAbriendoOtra(false);
      // Se conserva el evento para abrir la otra barra del mismo evento sin volver a escribirlo.
      setAperturaForm({ cajera: "", cajaChica: "", barra: aperturaForm.barra === "interior" ? "semicubierto" : "interior", meseros: "", evento });
    } catch (err) {
      console.error(err);
      setMensajeApertura(String(err?.message || "").startsWith("Ya hay") ? err.message : "No se pudo abrir la caja.");
    } finally {
      setAbriendo(false);
    }
  }

  async function guardarGasto(e) {
    e.preventDefault();
    setMensajeGasto("");
    if (!aperturaActiva) return setMensajeGasto("Primero debes abrir la caja.");
    if (!gastoForm.concepto.trim()) return setMensajeGasto("Escribe el concepto del gasto.");
    const monto = Number(gastoForm.monto) || 0;
    if (monto <= 0) return setMensajeGasto("Ingresa un monto mayor a 0.");
    try {
      await registrarGastoCaja({
        fecha: fechaHoyISO(), aperturaId: aperturaActiva.id, barra: aperturaActiva.barra,
        evento: eventoActual?.nombre || "", eventoId: eventoActual?.id || "",
        concepto: gastoForm.concepto.trim(), monto, observaciones: gastoForm.observaciones.trim(),
      });
      setGastoForm({ concepto: "", monto: "", observaciones: "" });
      setMensajeGasto("Gasto registrado.");
    } catch (err) {
      console.error(err);
      setMensajeGasto("No se pudo registrar el gasto.");
    }
  }

  function agregarProductoComanda() {
    setError("");
    if (!itemSel) return setError("Selecciona un producto o trago para agregar.");
    const cantidad = Number(form.cantidad) || 0;
    if (cantidad <= 0) return setError("La cantidad debe ser mayor a 0.");
    if (productoSel && unidadSel === "Vaso" && dosisPorBotella(productoSel) <= 0) {
      return setError(`"${productoSel.nombre}" no tiene dosis de la casa para su tamaño de botella, no se puede vender por vaso.`);
    }
    if (productoSel && unidadSel === "Vaso" && !esCortesia && precioUnitario <= 0) {
      return setError(`"${productoSel.nombre}" no tiene precio por vaso. Ponlo en Inventario o usa «Cambiar».`);
    }
    if (tragoSel && consumoReceta(tragoSel, productos).length === 0) {
      return setError(`El trago "${tragoSel.nombre}" no tiene ingredientes válidos. Revísalo en Recetario.`);
    }
    if (tragoSel && !esCortesia && precioUnitario <= 0) {
      return setError(`El trago "${tragoSel.nombre}" no tiene precio de venta. Usa «Cambiar» para ponerle precio.`);
    }
    const nueva = {
      productoId: productoSel ? productoSel.id : `receta:${tragoSel.id}`,
      recetaId: tragoSel ? tragoSel.id : null,
      producto: itemSel.nombre,
      unidad: unidadSel,
      cantidad,
      precioUnitario,
      total: totalProducto,
      complemento: form.complemento.trim(),
    };
    const errorStock = validarStock([...productosComanda, nueva]);
    if (errorStock) return setError(errorStock);
    setProductosComanda((lista) => [...lista, nueva]);
    setForm((f) => ({ ...f, productoId: "", cantidad: 1, complemento: "" }));
    setEditandoPrecio(false);
    setPrecioEditado("");
  }

  function quitarProductoComanda(indice) {
    setProductosComanda((lista) => lista.filter((_, i) => i !== indice));
  }

  async function cerrarCajaDelDia() {
    if (!aperturaActiva || cerrandoCaja) return;
    const barraCierre = BARRAS.find((b) => b.valor === aperturaActiva.barra)?.etiqueta || aperturaActiva.barra;
    if (!window.confirm(`¿Cerrar la caja de ${aperturaActiva.cajera} (${barraCierre})? Se generará su reporte. Las otras cajas abiertas siguen funcionando.`)) return;
    setCerrandoCaja(true);
    setError("");
    try {
      const cierre = await cerrarTurno({
        apertura: aperturaActiva, ventas, gastosCaja, aperturasCaja, registrarCierre, cerrarAperturaCaja,
      });
      setReporteCierre(cierre);
      setProductosComanda([]);
      setForm(VACIO);
      setAperturaIdElegida(null);
      setAbriendoOtra(false);
      // Limpia mensajes y formularios para que no parezca que la caja se abrió otra vez.
      setMensajeApertura("");
      setMensajeGasto("");
      setGastoForm({ concepto: "", monto: "", observaciones: "" });
      setAperturaForm({ cajera: "", cajaChica: "", barra: "interior", meseros: "", evento: "" });
    } catch (err) {
      console.error(err);
      setError("No se pudo cerrar la caja. Intenta de nuevo.");
    } finally {
      setCerrandoCaja(false);
    }
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!aperturaActiva) return setError("Primero debes realizar la apertura de caja.");
    if (!form.mesero.trim()) return setError("Selecciona el mesero.");
    if (!form.comanda.trim()) return setError("Ingresa el N° de comanda.");

    // Aviso para evitar que un producto seleccionado se ignore sin querer
    if (itemSel) {
      return setError("Tienes un producto seleccionado sin agregar. Pulsa «Agregar producto» o quítalo antes de registrar.");
    }

    // Solo se registra lo que está en la lista de la comanda
    const productosARegistrar = [...productosComanda];

    if (productosARegistrar.length === 0)
      return setError("Agrega al menos un producto a la comanda con el botón «Agregar producto».");

    const errorStock = validarStock(productosARegistrar);
    if (errorStock) return setError(errorStock);

    const totalARegistrar = productosARegistrar.reduce((s, p) => s + Number(p.total || 0), 0);

    let montoQrTotal = 0;
    let montoEfectivoTotal = 0;
    if (form.formaPago === "qr") montoQrTotal = totalARegistrar;
    if (form.formaPago === "efectivo") montoEfectivoTotal = totalARegistrar;
    if (form.formaPago === "ambos") {
      montoQrTotal = Number(form.montoQr) || 0;
      montoEfectivoTotal = Number(form.montoEfectivo) || 0;
      if (Math.abs(montoQrTotal + montoEfectivoTotal - totalARegistrar) > 0.01) {
        return setError(`La suma de QR (Bs ${montoQrTotal.toFixed(2)}) + efectivo (Bs ${montoEfectivoTotal.toFixed(2)}) debe ser igual al total (Bs ${totalARegistrar.toFixed(2)}).`);
      }
    }

    setEnviando(true);
    try {
      let qrRestante = montoQrTotal;
      for (const item of productosARegistrar) {
        let montoQr = 0;
        let montoEfectivo = 0;
        if (form.formaPago === "qr") montoQr = item.total;
        else if (form.formaPago === "efectivo") montoEfectivo = item.total;
        else if (form.formaPago === "cortesia") {
          // Cortesía: no entra dinero, ni QR ni efectivo.
        } else {
          montoQr = Math.min(qrRestante, item.total);
          montoEfectivo = item.total - montoQr;
          qrRestante -= montoQr;
        }

        await registrarVenta({
          fecha: fechaHoyISO(), cajera: aperturaActiva.cajera, comanda: form.comanda.trim(),
          barra: aperturaActiva.barra, evento: eventoActual?.nombre || "", eventoId: eventoActual?.id || "",
          mesero: form.mesero.trim(), productoId: item.productoId,
          producto: item.producto, unidad: item.unidad, cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          // En cortesía el total es 0 (no se suma a nada); el precio de la botella queda en valorCortesia solo para consulta.
          total: esCortesia ? 0 : item.total,
          valorCortesia: esCortesia ? item.total : 0,
          formaPago: form.formaPago,
          montoQr, montoEfectivo, observaciones: form.observaciones.trim(),
          complemento: item.complemento, aperturaId: aperturaActiva.id,
          recetaId: item.recetaId || null,
          consumo: item.recetaId || item.unidad === "Vaso"
            ? consumoDeLinea(item).map((c) => ({ productoId: c.productoId, cantidad: redondear4(c.cantidad) }))
            : [],
        });
      }

      setProductosComanda([]);
      setForm({ ...VACIO, cajera: aperturaActiva.cajera, barra: aperturaActiva.barra, mesero: "", comanda: "" });
      setEditandoPrecio(false);
      setPrecioEditado("");
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar la venta. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Venta</h1>
        <p>{new Date().toLocaleString("es-BO", { dateStyle: "full", timeStyle: "short" })}</p>
      </header>

      {reporteCierre && (
        <ReporteCierre
          cierre={reporteCierre}
          titulo="Turno cerrado — reporte de la cajera"
          onCerrar={() => setReporteCierre(null)}
        />
      )}

      {aperturasActivas.length > 0 && (
        <div className="cajas-abiertas">
          <span className="cajas-abiertas__titulo">Cajas abiertas</span>
          {aperturasActivas.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`caja-tab ${cajaVisible && a.id === aperturaActiva?.id ? "caja-tab--activa" : ""}`}
              onClick={() => elegirCaja(a)}
            >
              <strong>{BARRAS.find((b) => b.valor === a.barra)?.etiqueta || a.barra}</strong>
              <span>{a.cajera}</span>
            </button>
          ))}
          <button
            type="button"
            className={`caja-tab caja-tab--nueva ${abriendoOtra ? "caja-tab--activa" : ""}`}
            onClick={() => {
              // Propone la barra que todavía no tiene caja abierta.
              const libre = BARRAS.find((b) => !aperturasActivas.some((a) => a.barra === b.valor));
              // Propone el mismo evento de la caja abierta (Interior y Semicubierto comparten evento).
              setAperturaForm((f) => ({
                ...f,
                barra: libre ? libre.valor : f.barra,
                evento: f.evento || aperturaActiva?.evento || "",
              }));
              setAbriendoOtra((v) => !v);
            }}
          >
            + Abrir otra caja
          </button>
        </div>
      )}

      {!cajaVisible ? (
        <form className="formulario" onSubmit={abrirCaja}>
          <h2>Apertura de caja</h2>
          <div className="formulario__fila">
            <label>
              Nombre de quien apertura
              <input list="cajeras-apertura-lista" value={aperturaForm.cajera} onChange={(e) => setAperturaForm((f) => ({ ...f, cajera: e.target.value }))} placeholder="Ej: María" required />
              <datalist id="cajeras-apertura-lista">{cajerasAperturaPrevias.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>
              Caja chica / Con cuánto abre (Bs)
              <input type="number" step="0.01" min="0" value={aperturaForm.cajaChica} onChange={(e) => setAperturaForm((f) => ({ ...f, cajaChica: e.target.value }))} placeholder="Ej: 150" required />
            </label>
            <label>
              Barra
              <select value={aperturaForm.barra} onChange={(e) => setAperturaForm((f) => ({ ...f, barra: e.target.value }))}>
                {BARRAS.map((b) => <option key={b.valor} value={b.valor}>{b.etiqueta}</option>)}
              </select>
            </label>
          </div>
          <div className="formulario__fila">
            <label>
              Evento
              <input list="eventos-apertura-lista" value={aperturaForm.evento} onChange={(e) => setAperturaForm((f) => ({ ...f, evento: e.target.value }))} placeholder="Ej: Jueves Universitario" required />
              <datalist id="eventos-apertura-lista">{nombresEventos.map((n) => <option key={n} value={n} />)}</datalist>
            </label>
          </div>
          <div className="formulario__fila">
            <label>
              Meseros del turno
              <input list="meseros-apertura-lista" value={aperturaForm.meseros} onChange={(e) => setAperturaForm((f) => ({ ...f, meseros: e.target.value }))} placeholder="Ej: Carla, José, Luis" required />
              <datalist id="meseros-apertura-lista">{meserosAperturaPrevios.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
          </div>
          {mensajeApertura && <div className="formulario__error">{mensajeApertura}</div>}
          <div className="formulario__acciones">
            <button type="submit" className="boton boton--primario" disabled={abriendo}>
              {abriendo ? "Abriendo caja…" : "Abrir caja"}
            </button>
            {abriendoOtra && (
              <button type="button" className="boton boton--fantasma" onClick={() => setAbriendoOtra(false)}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        <section className="lista-reciente">
          <h2>Caja abierta</h2>
          <p><strong>{aperturaActiva.cajera}</strong> · Evento: <strong>{eventoActual?.nombre}</strong> · Abrió: {new Date(aperturaActiva.fecha).toLocaleString("es-BO")} · {BARRAS.find((b) => b.valor === aperturaActiva.barra)?.etiqueta || aperturaActiva.barra} · Caja chica: Bs {Number(aperturaActiva.cajaChica || 0).toFixed(2)} · Meseros: {(aperturaActiva.meseros || []).join(", ")}</p>
          <button type="button" className="boton boton--peligro" onClick={cerrarCajaDelDia} disabled={cerrandoCaja}>
            {cerrandoCaja ? "Cerrando caja…" : "Cerrar caja y ver reporte"}
          </button>
        </section>
      )}

      {cajaVisible && (
      <form className="formulario" onSubmit={enviar}>
        <div className="formulario__fila">
          <label>
            Cajera
            <input
              value={aperturaActiva.cajera || ""}
              readOnly
              disabled
            />
            <datalist id="cajeras-lista">
              {cajerasPrevias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Barra
            <select value={aperturaActiva.barra || ""} disabled>
              {BARRAS.map((b) => (
                <option key={b.valor} value={b.valor}>{b.etiqueta}</option>
              ))}
            </select>
          </label>
          <label>
            N° de comanda
            <input
              value={form.comanda}
              onChange={(e) => actualizar("comanda", e.target.value)}
              placeholder="Ej: 128"
            />
          </label>
        </div>

        <div className="formulario__fila">
          <label>
            Fecha y hora
            <input type="text" value={new Date().toLocaleString("es-BO")} disabled />
          </label>
          <label>
            Nombre del mesero
            <select
              value={form.mesero}
              onChange={(e) => cambiarMesero(e.target.value)}
              required
            >
              <option value="">Selecciona un mesero…</option>
              {(aperturaActiva.meseros || []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="formulario__fila">
          <div className="campo">
            <span>Producto</span>
            <BuscadorProducto
              opciones={opcionesBuscador}
              valor={form.productoId}
              onChange={elegirProducto}
            />
          </div>
          <label>
            Unidad
            <select
              value={unidadSel}
              onChange={(e) => cambiarUnidad(e.target.value)}
              disabled={!productoSel}
            >
              <option value="Botella">Botella</option>
              <option value="Vaso">Vaso</option>
            </select>
          </label>
          <label>
            Precio de venta
            {editandoPrecio ? (
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={precioEditado}
                onChange={(e) => setPrecioEditado(e.target.value)}
                onBlur={() => {
                  if (precioEditado === "") setEditandoPrecio(false);
                }}
              />
            ) : (
              <div className="precio-con-editar">
                <input type="text" value={precioSugerido ? `Bs ${precioSugerido.toFixed(2)}` : "—"} disabled />
                <button
                  type="button"
                  className="boton boton--cambiar"
                  onClick={() => {
                    setPrecioEditado(String(precioSugerido || ""));
                    setEditandoPrecio(true);
                  }}
                  disabled={!itemSel}
                  title="Cambiar el precio de venta"
                >
                  ✎ Cambiar
                </button>
              </div>
            )}
          </label>
          <label>
            Cantidad
            <input
              type="number"
              min="1"
              value={form.cantidad}
              onChange={(e) => actualizar("cantidad", e.target.value)}
              
            />
          </label>
        </div>

        {itemSel && (
          <div className="formulario__fila">
            <label>
              Complemento (opcional)
              <input value={form.complemento} onChange={(e) => actualizar("complemento", e.target.value)} placeholder="Ej: Sprite, Schweppes, tónica…" />
            </label>
          </div>
        )}

        <div className="formulario__acciones">
          <button type="button" className="boton boton--agregar" onClick={agregarProductoComanda} disabled={!itemSel}>
            + Agregar producto
          </button>
          <span>{productosComanda.length} producto{productosComanda.length === 1 ? "" : "s"} agregado{productosComanda.length === 1 ? "" : "s"}</span>
        </div>

        {productosComanda.length > 0 && (
          <section className="lista-reciente">
            <h3>Productos de la comanda</h3>
            <table className="tabla">
              <thead><tr><th>Producto</th><th>Complemento</th><th>Cant.</th><th>Precio</th><th>Total</th><th></th></tr></thead>
              <tbody>{productosComanda.map((p, i) => (
                <tr key={`${p.productoId}-${i}`}>
                  <td>{p.producto}</td><td>{p.complemento || "—"}</td><td>{p.cantidad}</td>
                  <td>Bs {Number(p.precioUnitario).toFixed(2)}</td><td>Bs {Number(p.total).toFixed(2)}</td>
                  <td><button type="button" className="boton boton--enlace boton--peligro" onClick={() => quitarProductoComanda(i)}>Quitar</button></td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        )}

        <div className="formulario__total">
          {esCortesia
            ? `Cortesía — valor de referencia: Bs ${totalVentaActual.toFixed(2)} (no se cobra)`
            : `Total comanda: Bs ${totalVentaActual.toFixed(2)}`}
        </div>

        <div className="formulario__fila">
          <label>
            Forma de pago
            <select
              value={form.formaPago}
              onChange={(e) => actualizar("formaPago", e.target.value)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
              <option value="ambos">Ambos</option>
              <option value="cortesia">Cortesía</option>
            </select>
          </label>
          {form.formaPago === "ambos" && (
            <>
              <label>
                Monto QR
                <input
                  type="number"
                  step="0.01"
                  value={form.montoQr}
                  onChange={(e) => actualizar("montoQr", e.target.value)}
                />
              </label>
              <label>
                Monto efectivo
                <input
                  type="number"
                  step="0.01"
                  value={form.montoEfectivo}
                  onChange={(e) => actualizar("montoEfectivo", e.target.value)}
                />
              </label>
            </>
          )}
          {form.formaPago === "efectivo" && (
            <>
              <label>
                Efectivo recibido
                <input
                  type="number"
                  step="0.01"
                  value={form.montoEfectivo}
                  onChange={(e) => actualizar("montoEfectivo", e.target.value)}
                  placeholder={totalVentaActual ? totalVentaActual.toFixed(2) : ""}
                />
              </label>
              <label>
                Cambio
                <input type="text" value={`Bs ${cambio.toFixed(2)}`} disabled />
              </label>
            </>
          )}
        </div>

        <label>
          Observaciones
          <textarea
            rows={2}
            value={form.observaciones}
            onChange={(e) => actualizar("observaciones", e.target.value)}
            placeholder="Ej: mesa 4, sin cebolla, cliente frecuente…"
          />
        </label>

        {error && <div className="formulario__error">{error}</div>}

        <button type="submit" className="boton boton--primario" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar venta"}
        </button>
      </form>
      )}

      {cajaVisible && (
      <form className="formulario" onSubmit={guardarGasto}>
        <h2>Gastos</h2>
        <div className="formulario__fila">
          <label>Concepto<input value={gastoForm.concepto} onChange={(e) => setGastoForm((f) => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Sonido" /></label>
          <label>Monto (Bs)<input type="number" step="0.01" min="0" value={gastoForm.monto} onChange={(e) => setGastoForm((f) => ({ ...f, monto: e.target.value }))} /></label>
          <label>Observaciones<input value={gastoForm.observaciones} onChange={(e) => setGastoForm((f) => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" /></label>
        </div>
        {mensajeGasto && <div className="formulario__error formulario__error--exito">{mensajeGasto}</div>}
        <button type="submit" className="boton boton--primario">Registrar gasto</button>
      </form>
      )}

      {cajaVisible && gastosCaja.filter((g) => g.aperturaId === aperturaActiva.id).length > 0 && (
        <section className="lista-reciente">
          <h2>Gastos de esta caja</h2>
          <table className="tabla"><thead><tr><th>Concepto</th><th>Monto</th><th>Observaciones</th></tr></thead><tbody>
            {gastosCaja.filter((g) => g.aperturaId === aperturaActiva.id).map((g) => <tr key={g.id}><td>{g.concepto}</td><td>Bs {Number(g.monto || 0).toFixed(2)}</td><td>{g.observaciones || "—"}</td></tr>)}
          </tbody></table>
        </section>
      )}

      <section className="lista-reciente">
        <h2>Ventas del evento</h2>
        {eventos.length > 0 && (
          <div className="formulario__fila">
            <label>
              Evento
              <select value={eventoVistaActivo} onChange={(e) => setEventoVistaId(e.target.value)}>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.etiqueta}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {ventasDelEvento.length === 0 ? (
          <p className="texto-vacio">Todavía no hay ventas registradas en este evento.</p>
        ) : (
          <>
            <p className="texto-vacio">
              {ventasDelEvento.length > ventasEventoRecientes.length
                ? `Mostrando las ${ventasEventoRecientes.length} más recientes de ${ventasDelEvento.length} ventas del evento.`
                : `${ventasDelEvento.length} venta${ventasDelEvento.length === 1 ? "" : "s"} en el evento.`}
            </p>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Comanda</th>
                  <th>Fecha y hora</th>
                  <th>Barra</th>
                  <th>Mesero</th>
                  <th>Producto</th>
                  <th>Unidad</th>
                  <th>Cant.</th>
                  <th>Total</th>
                  <th>Pago</th>
                </tr>
              </thead>
              <tbody>
                {ventasEventoRecientes.map((v) => (
                  <tr key={v.id}>
                    <td>{v.comanda || "—"}</td>
                    <td>{new Date(v.fecha).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="tabla__etiqueta">{BARRAS.find((b) => b.valor === v.barra)?.etiqueta || "—"}</td>
                    <td>{v.mesero}</td>
                    <td>{v.producto}</td>
                    <td className="tabla__etiqueta">{v.unidad || "—"}</td>
                    <td>{v.cantidad}</td>
                    <td>
                      {v.formaPago === "cortesia"
                        ? `Cortesía (Bs ${Number(v.valorCortesia || 0).toFixed(2)})`
                        : `Bs ${Number(v.total).toFixed(2)}`}
                    </td>
                    <td className="tabla__etiqueta">{v.formaPago}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}