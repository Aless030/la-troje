import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { esSoloLectura } from "../utils/permisos";
import { descargarCSV } from "../utils/csv";
import { descargarPDF } from "../utils/pdf";
import { descargarXLSX } from "../utils/xlsx";
import { eventoDeRegistro, listarEventos, mapaAperturas, nombreArchivoEvento } from "../utils/Evento";
import { BARRAS, etiquetaBarra, stockTotal } from "../utils/barras";

// Redondea para no mostrar 2.9999999 por las fracciones de botella.
const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

const TODOS = "todos";
const FAMILIA_TRAGOS = "Tragos"; // los tragos del recetario no son un producto de inventario

export default function Reportes() {
  const { ventas, ventasTodas, productos, aperturasCaja, cierres, ajustesInventario, registrarAjusteInventario, eliminarAjusteInventario } = useData();
  // El socio auxiliar solo mira: no ve la pestaña de ajustes (que escribe en el inventario).
  const { perfil } = useAuth();
  const soloLectura = esSoloLectura(perfil?.rol);
  // Los reportes se sacan por EVENTO (la noche completa), no por fecha: así lo vendido
  // de madrugada queda en el evento de esa noche. null = el evento más reciente.
  const [eventoElegido, setEventoElegido] = useState(null);
  const [vista, setVista] = useState("mesero");
  // Filtro por familia (Licores, Cervezas, Comida, Tragos…). TODOS = sin filtro.
  const [familia, setFamilia] = useState(TODOS);
  // Filtro por barra (Interior, Semicubierto, Palmera). TODOS = las tres juntas.
  const [barra, setBarra] = useState(TODOS);

  // Estado local del formulario de ajuste de inventario: apertura y saldo real
  // contado, por producto. Se llenan a mano antes de guardar el ajuste.
  const [aperturas, setAperturas] = useState({});
  const [saldosAjuste, setSaldosAjuste] = useState({});
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [mensajeAjuste, setMensajeAjuste] = useState("");

  const aperturasPorId = useMemo(() => mapaAperturas(aperturasCaja), [aperturasCaja]);
  const eventos = useMemo(
    () => listarEventos({ aperturas: aperturasCaja, ventas: ventasTodas, cierres }),
    [aperturasCaja, ventasTodas, cierres]
  );
  // Por defecto: el evento más reciente QUE TENGA ventas (una caja recién abierta, sin ventas,
  // no debe tapar la noche anterior).
  const eventoConVentas = useMemo(() => {
    const conVentas = new Set(ventasTodas.map((v) => eventoDeRegistro(v, aperturasPorId).id));
    return eventos.find((e) => conVentas.has(e.id))?.id;
  }, [eventos, ventasTodas, aperturasPorId]);
  const eventoId =
    eventoElegido === TODOS
      ? TODOS
      : eventoElegido && eventos.some((e) => e.id === eventoElegido)
      ? eventoElegido
      : eventoConVentas || eventos[0]?.id || TODOS;
  const eventoActual = eventos.find((e) => e.id === eventoId) || null;
  const textoEvento = eventoActual ? eventoActual.etiqueta : "Todos los eventos";
  const sufijoArchivo = eventoActual ? nombreArchivoEvento(eventoActual) : "todos-los-eventos";

  // Ventas del evento elegido (sin filtrar por familia: el ajuste de inventario usa estas).
  const ventasEvento = useMemo(
    () =>
      eventoId === TODOS
        ? ventas
        : ventas.filter((v) => eventoDeRegistro(v, aperturasPorId).id === eventoId),
    [ventas, aperturasPorId, eventoId]
  );

  // TODAS las líneas del evento (vendidas, cortesías y anuladas), para el reporte de comandas.
  const lineasEventoTodas = useMemo(
    () =>
      eventoId === TODOS
        ? ventasTodas
        : ventasTodas.filter((v) => eventoDeRegistro(v, aperturasPorId).id === eventoId),
    [ventasTodas, aperturasPorId, eventoId]
  );

  // Familia de cada línea vendida: la del producto en inventario; los tragos van en "Tragos".
  const familiaDeVenta = (v) => {
    if (v.recetaId) return FAMILIA_TRAGOS;
    const p = productos.find(
      (x) => x.id === v.productoId || (x.nombre || "").trim().toLowerCase() === (v.producto || "").trim().toLowerCase()
    );
    return p ? p.familia || "Licores" : "Otros";
  };

  const familias = useMemo(() => {
    const lista = new Set(productos.map((p) => p.familia || "Licores"));
    if (ventas.some((v) => v.recetaId)) lista.add(FAMILIA_TRAGOS);
    return [...lista].sort((a, b) => a.localeCompare(b, "es"));
  }, [productos, ventas]);
  // Si la familia elegida ya no existe, se vuelve a "todas".
  const familiaActiva = vista !== "ajuste" && familia !== TODOS && familias.includes(familia) ? familia : TODOS;
  const textoFamilia = familiaActiva === TODOS ? "" : ` — ${familiaActiva}`;
  const sufijoFamilia = familiaActiva === TODOS ? "" : `-${familiaActiva.toLowerCase().replace(/\s+/g, "-")}`;

  const barraDef = BARRAS.find((b) => b.valor === barra) || null;
  const barraActiva = barraDef ? barraDef.valor : TODOS;
  const textoBarra = barraDef ? ` — ${barraDef.etiqueta}` : "";
  const sufijoBarra = barraDef ? `-${barraDef.valor}` : "";

  const ventasFiltradas = useMemo(
    () =>
      ventasEvento
        .filter((v) => familiaActiva === TODOS || familiaDeVenta(v) === familiaActiva)
        .filter((v) => barraActiva === TODOS || v.barra === barraActiva),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ventasEvento, familiaActiva, barraActiva, productos]
  );

  const lineasFiltradas = useMemo(
    () =>
      lineasEventoTodas
        .filter((v) => familiaActiva === TODOS || familiaDeVenta(v) === familiaActiva)
        .filter((v) => barraActiva === TODOS || v.barra === barraActiva),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineasEventoTodas, familiaActiva, barraActiva, productos]
  );

  // Las cortesías no son venta: no se suman a ningún total. Van en su propia pestaña.
  const ventasPagadas = useMemo(
    () => ventasFiltradas.filter((v) => v.formaPago !== "cortesia"),
    [ventasFiltradas]
  );
  const ventasCortesia = useMemo(
    () => ventasFiltradas.filter((v) => v.formaPago === "cortesia"),
    [ventasFiltradas]
  );

  const porMesero = useMemo(() => {
    const mapa = {};
    ventasPagadas.forEach((v) => {
      if (!mapa[v.mesero]) mapa[v.mesero] = { mesero: v.mesero, ventas: 0, total: 0 };
      mapa[v.mesero].ventas += 1;
      mapa[v.mesero].total += v.total;
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [ventasPagadas]);

  // Ventas por barra (Interior, Semicubierto, Palmera): cuánto vendió cada una y cómo se pagó.
  const porBarra = useMemo(() => {
    const mapa = Object.fromEntries(BARRAS.map((b) => [b.valor, { barra: b.etiqueta, ventas: 0, efectivo: 0, qr: 0, total: 0 }]));
    ventasPagadas.forEach((v) => {
      const k = v.barra || "sin-barra";
      if (!mapa[k]) mapa[k] = { barra: etiquetaBarra(v.barra) === "—" ? "Sin barra" : etiquetaBarra(v.barra), ventas: 0, efectivo: 0, qr: 0, total: 0 };
      mapa[k].ventas += 1;
      mapa[k].efectivo += Number(v.montoEfectivo || 0);
      mapa[k].qr += Number(v.montoQr || 0);
      mapa[k].total += Number(v.total || 0);
    });
    const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    return Object.values(mapa).map((f) => ({ ...f, efectivo: r2(f.efectivo), qr: r2(f.qr), total: r2(f.total) }));
  }, [ventasPagadas]);

  const porProducto = useMemo(() => {
    const mapa = {};
    ventasPagadas.forEach((v) => {
      // Vaso y botella del mismo producto van en filas separadas.
      const clave = v.unidad === "Vaso" && !v.recetaId ? `${v.producto} (vaso)` : v.producto;
      if (!mapa[clave]) {
        const productoInventario = productos.find(
          (p) =>
            p.id === v.productoId ||
            (p.nombre || "").trim().toLowerCase() ===
              (v.producto || "").trim().toLowerCase()
        );

        mapa[clave] = {
          producto: clave,
          cantidad: 0,
          // Existencia (saldo): en la barra elegida, o en todo el bar (almacén + barras).
          existencia: v.recetaId
            ? "—"
            : productoInventario
            ? redondear(barraDef ? productoInventario[barraDef.campo] : stockTotal(productoInventario))
            : 0,
          total: 0,
        };
      }

      mapa[clave].cantidad += v.cantidad;
      mapa[clave].total += v.total;
    });

    return Object.values(mapa)
      .map((f) => ({ ...f, cantidad: redondear(f.cantidad), total: redondear(f.total) }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasPagadas, productos, barraDef]);

  const saldos = useMemo(() => {
    const totalQr = ventasFiltradas.reduce((s, v) => s + (v.montoQr || 0), 0);
    const totalEfectivo = ventasFiltradas.reduce((s, v) => s + (v.montoEfectivo || 0), 0);
    return { totalQr, totalEfectivo, totalGeneral: totalQr + totalEfectivo };
  }, [ventasFiltradas]);

  // Cuánto dinero hay parado en mercadería: por producto y por ubicación (almacén,
  // Interior, Semicubierto), a precio de venta actual de cada producto.
  const inventarioPorBarra = useMemo(() => {
    const filas = productos
      .filter((p) => familiaActiva === TODOS || (p.familia || "Licores") === familiaActiva)
      .map((p) => {
      const precio = Number(p.precio) || 0;
      const stockAlmacen = redondear(p.stock);
      const fila = { producto: p.nombre, almacen: stockAlmacen, valorAlmacen: stockAlmacen * precio, valorTotal: redondear(stockTotal(p)) * precio };
      BARRAS.forEach((b) => {
        const existencia = redondear(p[b.campo]);
        fila[b.valor] = existencia;
        fila[`valor_${b.valor}`] = existencia * precio;
      });
      return fila;
    });
    const totales = { almacen: 0, total: 0, ...Object.fromEntries(BARRAS.map((b) => [b.valor, 0])) };
    filas.forEach((f) => {
      totales.almacen += f.valorAlmacen;
      totales.total += f.valorTotal;
      BARRAS.forEach((b) => {
        totales[b.valor] += f[`valor_${b.valor}`];
      });
    });
    return { filas: filas.sort((a, b) => b.valorTotal - a.valorTotal), totales };
  }, [productos, familiaActiva]);

  // Reporte de comandas: el detalle de cada línea vendida, como en la planilla
  // de comandas (N°, fecha, mesero, producto, unidad, monto, forma de pago, total).
  // Incluye TODO: vendidas, cortesías y anuladas (con su estado). Solo las vendidas suman al total.
  const comandas = useMemo(() => {
    const ordenadas = [...lineasFiltradas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return ordenadas.map((v, i) => {
      const estado = v.anulada ? "ANULADA" : v.formaPago === "cortesia" ? "CORTESÍA" : "Vendida";
      return {
        n: i + 1,
        comanda: v.comanda || "—",
        fecha: new Date(v.fecha).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        barra: etiquetaBarra(v.barra),
        mesero: v.mesero || "—",
        producto: v.producto,
        unidad: v.unidad || "—",
        cantidad: v.cantidad,
        monto: v.precioUnitario,
        formaPago: v.formaPago,
        estado,
        total: estado === "Vendida" ? v.total : 0,
        observaciones: v.anulada
          ? `Anulada${v.anuladaPor ? " por " + v.anuladaPor : ""}${v.motivoAnulacion ? ": " + v.motivoAnulacion : ""} (Bs ${Number(v.total || 0).toFixed(2)})`
          : v.formaPago === "cortesia"
          ? `Valor Bs ${Number(v.valorCortesia || 0).toFixed(2)}${v.observaciones ? " — " + v.observaciones : ""}`
          : v.observaciones || "",
      };
    });
  }, [lineasFiltradas]);

  // Resumen para validar el reporte contra la lista de Ventas.
  const resumenControl = useMemo(() => {
    const llaves = new Set(lineasFiltradas.map((v) => `${v.comanda}|${v.mesero}|${v.aperturaId}`));
    return {
      lineas: lineasFiltradas.length,
      comandas: llaves.size,
      vendidas: ventasPagadas.length,
      cortesias: ventasCortesia.length,
      anuladas: lineasFiltradas.filter((v) => v.anulada).length,
      totalVendido: ventasPagadas.reduce((s, v) => s + Number(v.total || 0), 0),
    };
  }, [lineasFiltradas, ventasPagadas, ventasCortesia]);

  // Cortesías: solo para control (por ejemplo, ver si algún dueño sacó algo).
  // No se suman: se muestra el precio de la botella tal cual.
  const cortesias = useMemo(() => {
    const ordenadas = [...ventasCortesia].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return ordenadas.map((v) => ({
      comanda: v.comanda || "—",
      fecha: new Date(v.fecha).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      mesero: v.mesero || "—",
      producto: v.producto,
      cantidad: v.cantidad,
      unidad: v.unidad || "—",
      precio: v.precioUnitario,
      observaciones: v.observaciones || "—",
    }));
  }, [ventasCortesia]);

  // Venta total por producto en el evento elegido, para el ajuste de inventario.
  const ventaPorProducto = useMemo(() => {
    const mapa = {};
    ventasEvento.forEach((v) => {
      // Un trago gasta cada ingrediente de su receta (en fracciones de botella);
      // un producto normal gasta su cantidad.
      if (Array.isArray(v.consumo) && v.consumo.length > 0) {
        v.consumo.forEach((c) => {
          mapa[c.productoId] = (mapa[c.productoId] || 0) + Number(c.cantidad || 0);
        });
      } else {
        mapa[v.productoId] = (mapa[v.productoId] || 0) + v.cantidad;
      }
    });
    return mapa;
  }, [ventasEvento]);

  const filasAjuste = useMemo(() => {
    return productos.map((p) => {
      const apertura = redondear(aperturas[p.id] !== undefined ? Number(aperturas[p.id]) || 0 : Number(p.stock) || 0);
      const venta = redondear(ventaPorProducto[p.id] || 0);
      const final = redondear(apertura - venta);
      const saldo = redondear(saldosAjuste[p.id] !== undefined && saldosAjuste[p.id] !== "" ? Number(saldosAjuste[p.id]) : final);
      const diferencia = redondear(final - saldo);
      return {
        productoId: p.id,
        producto: p.nombre,
        unidad: p.unidadVenta || "Botella",
        monto: p.precioVenta ?? p.precio ?? 0,
        apertura,
        venta,
        final,
        saldo,
        diferencia,
      };
    });
  }, [productos, aperturas, saldosAjuste, ventaPorProducto]);

  async function guardarAjusteInventario() {
    setGuardandoAjuste(true);
    setMensajeAjuste("");
    try {
      await Promise.all(
        filasAjuste.map((f) =>
          registrarAjusteInventario({
            fecha: new Date().toISOString(),
            evento: eventoActual ? eventoActual.nombre : "Todos los eventos",
            eventoId: eventoActual ? eventoActual.id : null,
            productoId: f.productoId,
            producto: f.producto,
            unidad: f.unidad,
            monto: f.monto,
            apertura: f.apertura,
            venta: f.venta,
            final: f.final,
            saldo: f.saldo,
            diferencia: f.diferencia,
          })
        )
      );
      setMensajeAjuste("Ajuste de inventario guardado. Puedes revisarlo en el historial de abajo.");
    } catch (err) {
      console.error(err);
      setMensajeAjuste("No se pudo guardar el ajuste. Intenta de nuevo.");
    } finally {
      setGuardandoAjuste(false);
    }
  }

  const configuraciones = {
    mesero: {
      titulo: "Por mesero",
      columnas: [
        { titulo: "Mesero", clave: "mesero" },
        { titulo: "N° ventas", clave: "ventas" },
        { titulo: "Total Bs", clave: "total" },
      ],
      filas: porMesero,
    },
    barra: {
      titulo: "Por barra",
      columnas: [
        { titulo: "Barra", clave: "barra" },
        { titulo: "N° ventas", clave: "ventas" },
        { titulo: "Efectivo Bs", clave: "efectivo" },
        { titulo: "QR Bs", clave: "qr" },
        { titulo: "Total Bs", clave: "total" },
      ],
      filas: porBarra,
    },
    producto: {
      titulo: "Por producto",
      columnas: [
        { titulo: "Producto", clave: "producto" },
        { titulo: "Cantidad vendida", clave: "cantidad" },
        { titulo: barraDef ? `Saldo en ${barraDef.etiqueta}` : "Saldo en existencia (todo el bar)", clave: "existencia" },
        { titulo: "Total Bs", clave: "total" },
      ],
      filas: porProducto,
    },
    comandas: {
      titulo: "Reporte de comandas",
      columnas: [
        { titulo: "N°", clave: "n" },
        { titulo: "N° comanda", clave: "comanda" },
        { titulo: "Fecha y hora", clave: "fecha" },
        { titulo: "Barra", clave: "barra" },
        { titulo: "Mesero", clave: "mesero" },
        { titulo: "Producto", clave: "producto" },
        { titulo: "Cantidad", clave: "cantidad" },
        { titulo: "Unidad", clave: "unidad" },
        { titulo: "Monto Bs", clave: "monto" },
        { titulo: "Forma de pago", clave: "formaPago" },
        { titulo: "Estado", clave: "estado" },
        { titulo: "Total Bs", clave: "total" },
        { titulo: "Observaciones", clave: "observaciones" },
      ],
      filas: comandas,
    },
    cortesias: {
      titulo: "Cortesías (solo control, no se suman)",
      columnas: [
        { titulo: "N° comanda", clave: "comanda" },
        { titulo: "Fecha y hora", clave: "fecha" },
        { titulo: "Mesero", clave: "mesero" },
        { titulo: "Producto", clave: "producto" },
        { titulo: "Cantidad", clave: "cantidad" },
        { titulo: "Unidad", clave: "unidad" },
        { titulo: "Precio botella Bs", clave: "precio" },
        { titulo: "Observaciones", clave: "observaciones" },
      ],
      filas: cortesias,
    },
  };

  const actual = configuraciones[vista];

  // Descargas: todas las filas + una fila final de TOTAL para poder validar.
  function filasParaDescargar() {
    const base = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
      monto: f.monto?.toFixed ? f.monto.toFixed(2) : f.monto,
      precio: f.precio?.toFixed ? f.precio.toFixed(2) : f.precio,
      efectivo: f.efectivo?.toFixed ? f.efectivo.toFixed(2) : f.efectivo,
      qr: f.qr?.toFixed ? f.qr.toFixed(2) : f.qr,
    }));
    const suma = (k) => actual.filas.reduce((a, f) => a + Number(f[k] || 0), 0);
    if (vista === "mesero") base.push({ mesero: "TOTAL", ventas: suma("ventas"), total: suma("total").toFixed(2) });
    if (vista === "barra")
      base.push({ barra: "TOTAL", ventas: suma("ventas"), efectivo: suma("efectivo").toFixed(2), qr: suma("qr").toFixed(2), total: suma("total").toFixed(2) });
    if (vista === "producto") base.push({ producto: "TOTAL", cantidad: suma("cantidad"), total: suma("total").toFixed(2) });
    if (vista === "comandas") base.push({ producto: "TOTAL VENDIDO", cantidad: actual.filas.filter((f) => f.estado === "Vendida").reduce((a, f) => a + Number(f.cantidad || 0), 0), total: suma("total").toFixed(2) });
    return base;
  }

  function exportarCSV() {
    const filas = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
      monto: f.monto?.toFixed ? f.monto.toFixed(2) : f.monto,
      precio: f.precio?.toFixed ? f.precio.toFixed(2) : f.precio,
    }));
    descargarCSV(`reporte-${vista}-${sufijoArchivo}${sufijoFamilia}${sufijoBarra}`, actual.columnas, filasParaDescargar());
  }

  function exportarExcel() {
    descargarXLSX(`reporte-${vista}-${sufijoArchivo}${sufijoFamilia}${sufijoBarra}`, actual.columnas, filasParaDescargar(), actual.titulo);
  }

  function exportarPDF() {
    const filas = actual.filas.map((f) => ({
      ...f,
      total: f.total?.toFixed ? f.total.toFixed(2) : f.total,
      monto: f.monto?.toFixed ? f.monto.toFixed(2) : f.monto,
      precio: f.precio?.toFixed ? f.precio.toFixed(2) : f.precio,
    }));
    descargarPDF(`${actual.titulo} — ${textoEvento}${textoFamilia}${textoBarra}`, actual.columnas, filasParaDescargar(), `reporte-${vista}-${sufijoArchivo}${sufijoFamilia}${sufijoBarra}`);
  }

  function exportarAjusteCSV() {
    const columnas = [
      { titulo: "Producto", clave: "producto" },
      { titulo: "Unidad", clave: "unidad" },
      { titulo: "Monto Bs", clave: "monto" },
      { titulo: "Apertura", clave: "apertura" },
      { titulo: "Venta", clave: "venta" },
      { titulo: "Final", clave: "final" },
      { titulo: "Saldo", clave: "saldo" },
      { titulo: "Diferencia", clave: "diferencia" },
    ];
    const filas = filasAjuste.map((f) => ({
      ...f,
      monto: f.monto.toFixed(2),
      apertura: f.apertura.toFixed(2),
      venta: f.venta.toFixed(2),
      final: f.final.toFixed(2),
      saldo: f.saldo.toFixed(2),
      diferencia: f.diferencia.toFixed(2),
    }));
    descargarCSV(`ajuste-inventario-${sufijoArchivo}`, columnas, filas);
  }

  function exportarAjusteExcel() {
    const columnas = [
      { titulo: "Producto", clave: "producto" },
      { titulo: "Unidad", clave: "unidad" },
      { titulo: "Monto Bs", clave: "monto" },
      { titulo: "Apertura", clave: "apertura" },
      { titulo: "Venta", clave: "venta" },
      { titulo: "Final", clave: "final" },
      { titulo: "Saldo", clave: "saldo" },
      { titulo: "Diferencia", clave: "diferencia" },
    ];
    descargarXLSX(`ajuste-inventario-${sufijoArchivo}`, columnas, filasAjuste, "Ajuste de inventario");
  }

  function exportarAjustePDF() {
    const columnas = [
      { titulo: "Producto", clave: "producto" },
      { titulo: "Unidad", clave: "unidad" },
      { titulo: "Apertura", clave: "apertura" },
      { titulo: "Venta", clave: "venta" },
      { titulo: "Final", clave: "final" },
      { titulo: "Saldo", clave: "saldo" },
      { titulo: "Dif.", clave: "diferencia" },
    ];
    const filas = filasAjuste.map((f) => ({
      ...f,
      apertura: f.apertura.toFixed(2),
      venta: f.venta.toFixed(2),
      final: f.final.toFixed(2),
      saldo: f.saldo.toFixed(2),
      diferencia: f.diferencia.toFixed(2),
    }));
    descargarPDF(`Ajuste de inventario — ${textoEvento}`, columnas, filas, `ajuste-inventario-${sufijoArchivo}`);
  }

  const columnasInventario = [
    { titulo: "Producto", clave: "producto" },
    { titulo: "Almacén", clave: "almacen" },
    ...BARRAS.map((b) => ({ titulo: b.etiqueta, clave: b.valor })),
    { titulo: "Valor total Bs", clave: "valorTotal" },
  ];

  function exportarInventarioCSV() {
    const filas = inventarioPorBarra.filas.map((f) => ({ ...f, valorTotal: f.valorTotal.toFixed(2) }));
    descargarCSV("reporte-inventario-barras", columnasInventario, filas);
  }

  function exportarInventarioExcel() {
    descargarXLSX(`reporte-inventario-barras${sufijoFamilia}`, columnasInventario, inventarioPorBarra.filas, "Inventario y barras");
  }

  function exportarInventarioPDF() {
    const filas = inventarioPorBarra.filas.map((f) => ({ ...f, valorTotal: f.valorTotal.toFixed(2) }));
    descargarPDF("Inventario y barras", columnasInventario, filas, "reporte-inventario-barras");
  }

  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1>Reportes</h1>
        <p>Elige el evento (y la familia) y descarga en Excel, CSV o PDF. Cada evento incluye toda la noche, aunque pase de medianoche.</p>
      </header>

      <div className="formulario__fila">
        <label>
          Evento
          <select value={eventoId} onChange={(e) => setEventoElegido(e.target.value)}>
            <option value={TODOS}>Todos los eventos</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.etiqueta}</option>
            ))}
          </select>
        </label>
        {vista !== "ajuste" && vista !== "inventario" && (
          <label>
            Barra
            <select value={barraActiva} onChange={(e) => setBarra(e.target.value)}>
              <option value={TODOS}>Todas las barras</option>
              {BARRAS.map((b) => (
                <option key={b.valor} value={b.valor}>{b.etiqueta}</option>
              ))}
            </select>
          </label>
        )}
        {vista !== "ajuste" && (
          <label>
            Familia
            <select value={familiaActiva} onChange={(e) => setFamilia(e.target.value)}>
              <option value={TODOS}>Todas (comida, bebidas, tragos…)</option>
              {familias.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Saldo efectivo</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalEfectivo.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="tarjeta-metrica__etiqueta">Saldo QR</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalQr.toFixed(2)}</span>
        </div>
        <div className="tarjeta-metrica tarjeta-metrica--destacada">
          <span className="tarjeta-metrica__etiqueta">Saldo total</span>
          <span className="tarjeta-metrica__valor">Bs {saldos.totalGeneral.toFixed(2)}</span>
        </div>
      </div>

      {vista !== "ajuste" && vista !== "inventario" && (
        <p className="texto-vacio" style={{ marginTop: -8 }}>
          Control del evento{textoFamilia}{textoBarra}: <strong>{resumenControl.comandas}</strong> comandas ·{" "}
          <strong>{resumenControl.lineas}</strong> líneas ({resumenControl.vendidas} vendidas, {resumenControl.cortesias} cortesías,{" "}
          {resumenControl.anuladas} anuladas) · Total vendido <strong>Bs {resumenControl.totalVendido.toFixed(2)}</strong>. Las anuladas y
          cortesías aparecen en «Comandas» con su estado y no suman.
        </p>
      )}

      <div className="pestañas">
        <button
          className={`pestañas__item ${vista === "mesero" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("mesero")}
        >
          Por mesero
        </button>
        <button
          className={`pestañas__item ${vista === "barra" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("barra")}
        >
          Por barra
        </button>
        <button
          className={`pestañas__item ${vista === "producto" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("producto")}
        >
          Por producto
        </button>
        <button
          className={`pestañas__item ${vista === "comandas" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("comandas")}
        >
          Comandas
        </button>
        <button
          className={`pestañas__item ${vista === "cortesias" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("cortesias")}
        >
          Cortesías
        </button>
        <button
          className={`pestañas__item ${vista === "inventario" ? "pestañas__item--activa" : ""}`}
          onClick={() => setVista("inventario")}
        >
          Inventario y barras
        </button>
        {!soloLectura && (
          <button
            className={`pestañas__item ${vista === "ajuste" ? "pestañas__item--activa" : ""}`}
            onClick={() => setVista("ajuste")}
          >
            Ajuste de inventario
          </button>
        )}
      </div>

      {vista === "ajuste" && !soloLectura ? (
        <>
          <p className="texto-vacio">
            Ingresa la apertura (stock con el que empezó el evento) y, al final, el saldo real contado.
            "Final" se calcula solo (apertura − venta del evento elegido); "Diferencia" es Final − Saldo,
            para detectar faltantes o sobrantes.
          </p>
          <section className="lista-reciente">
            {filasAjuste.length === 0 ? (
              <p className="texto-vacio">Todavía no hay productos cargados en inventario.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidad</th>
                    <th>Monto</th>
                    <th>Apertura</th>
                    <th>Venta</th>
                    <th>Final</th>
                    <th>Saldo real</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {filasAjuste.map((f) => (
                    <tr key={f.productoId} className={Math.abs(f.diferencia) > 0.01 ? "tabla__fila--alerta" : ""}>
                      <td>{f.producto}</td>
                      <td className="tabla__etiqueta">{f.unidad}</td>
                      <td>Bs {f.monto.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="celda-editable"
                          value={aperturas[f.productoId] ?? f.apertura}
                          onChange={(e) =>
                            setAperturas((a) => ({ ...a, [f.productoId]: e.target.value }))
                          }
                        />
                      </td>
                      <td>{Number(f.venta).toFixed(2)}</td>
                      <td>{f.final.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="celda-editable"
                          value={saldosAjuste[f.productoId] ?? ""}
                          placeholder={f.final.toFixed(2)}
                          onChange={(e) => setSaldosAjuste((s) => ({ ...s, [f.productoId]: e.target.value }))}
                        />
                      </td>
                      <td>{f.diferencia.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="formulario__acciones">
            <button className="boton boton--primario" onClick={guardarAjusteInventario} disabled={guardandoAjuste}>
              {guardandoAjuste ? "Guardando…" : "Guardar ajuste de inventario"}
            </button>
            <button className="boton boton--fantasma" onClick={exportarAjusteCSV}>Descargar CSV</button>
            <button className="boton boton--fantasma" onClick={exportarAjusteExcel}>Descargar Excel</button>
            <button className="boton boton--fantasma" onClick={exportarAjustePDF}>Descargar PDF</button>
          </div>
          {mensajeAjuste && <div className="formulario__error formulario__error--exito">{mensajeAjuste}</div>}

          <section className="lista-reciente">
            <h2>Historial de ajustes guardados</h2>
            {ajustesInventario.length === 0 ? (
              <p className="texto-vacio">Todavía no hay ajustes guardados.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Evento</th>
                    <th>Producto</th>
                    <th>Apertura</th>
                    <th>Venta</th>
                    <th>Final</th>
                    <th>Saldo</th>
                    <th>Diferencia</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ajustesInventario.slice(0, 40).map((a) => (
                    <tr key={a.id} className={Math.abs(a.diferencia || 0) > 0.01 ? "tabla__fila--alerta" : ""}>
                      <td>{new Date(a.fecha).toLocaleString("es-BO")}</td>
                      <td>{a.evento || "—"}</td>
                      <td>{a.producto}</td>
                      <td>{Number(a.apertura ?? 0).toFixed(2)}</td>
                      <td>{Number(a.venta ?? 0).toFixed(2)}</td>
                      <td>{Number(a.final ?? 0).toFixed(2)}</td>
                      <td>{Number(a.saldo ?? 0).toFixed(2)}</td>
                      <td>{Number(a.diferencia ?? 0).toFixed(2)}</td>
                      <td>
                        <button
                          className="boton boton--enlace boton--peligro"
                          onClick={() => eliminarAjusteInventario(a.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : vista === "inventario" ? (
        <>
          <div className="tarjetas-resumen">
            <div className="tarjeta-metrica">
              <span className="tarjeta-metrica__etiqueta">Almacén general</span>
              <span className="tarjeta-metrica__valor">Bs {inventarioPorBarra.totales.almacen.toFixed(2)}</span>
            </div>
            {BARRAS.map((b) => (
              <div className="tarjeta-metrica" key={b.valor}>
                <span className="tarjeta-metrica__etiqueta">{b.etiqueta}</span>
                <span className="tarjeta-metrica__valor">Bs {inventarioPorBarra.totales[b.valor].toFixed(2)}</span>
              </div>
            ))}
            <div className="tarjeta-metrica tarjeta-metrica--destacada">
              <span className="tarjeta-metrica__etiqueta">Valor total del inventario</span>
              <span className="tarjeta-metrica__valor">Bs {inventarioPorBarra.totales.total.toFixed(2)}</span>
            </div>
          </div>

          <section className="lista-reciente">
            {inventarioPorBarra.filas.length === 0 ? (
              <p className="texto-vacio">Todavía no hay productos cargados.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Almacén</th>
                    {BARRAS.map((b) => (
                      <th key={b.valor}>{b.etiqueta}</th>
                    ))}
                    <th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioPorBarra.filas.map((f, i) => (
                    <tr key={i}>
                      <td>{f.producto}</td>
                      <td>{f.almacen}</td>
                      {BARRAS.map((b) => (
                        <td key={b.valor}>{f[b.valor]}</td>
                      ))}
                      <td>Bs {f.valorTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="formulario__acciones">
            <button
              className="boton boton--primario"
              onClick={exportarInventarioCSV}
              disabled={inventarioPorBarra.filas.length === 0}
            >
              Descargar CSV
            </button>
            <button
              className="boton boton--fantasma"
              onClick={exportarInventarioExcel}
              disabled={inventarioPorBarra.filas.length === 0}
            >
              Descargar Excel
            </button>
            <button
              className="boton boton--fantasma"
              onClick={exportarInventarioPDF}
              disabled={inventarioPorBarra.filas.length === 0}
            >
              Descargar PDF
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="lista-reciente">
            {actual.filas.length === 0 ? (
              <p className="texto-vacio">
                {vista === "cortesias" ? "No hay cortesías en este filtro." : "No hay datos para este filtro."}
              </p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    {actual.columnas.map((c) => (
                      <th key={c.clave}>{c.titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actual.filas.map((fila, i) => (
                    <tr key={i} style={fila.estado === "ANULADA" ? { textDecoration: "line-through", opacity: 0.55 } : undefined}>
                      {actual.columnas.map((c) => (
                        <td key={c.clave} className={c.clave === "formaPago" ? "tabla__etiqueta" : undefined}>
                          {c.clave === "total" || c.clave === "monto" || c.clave === "precio"
                            ? `Bs ${Number(fila[c.clave] || 0).toFixed(2)}`
                            : fila[c.clave]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="formulario__acciones">
            <button className="boton boton--primario" onClick={exportarCSV} disabled={actual.filas.length === 0}>
              Descargar CSV
            </button>
            <button className="boton boton--fantasma" onClick={exportarExcel} disabled={actual.filas.length === 0}>
              Descargar Excel
            </button>
            <button className="boton boton--fantasma" onClick={exportarPDF} disabled={actual.filas.length === 0}>
              Descargar PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}