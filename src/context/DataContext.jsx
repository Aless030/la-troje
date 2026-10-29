import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, ensureAuth } from "../firebase";
import { buscarAperturasActivas } from "../utils/Turno";
import { normalizarNombreEvento, resolverEventoParaApertura } from "../utils/Evento";

const DataContext = createContext(null);

function useColeccion(nombre, campoOrden = "creadoEn") {
  const [datos, setDatos] = useState([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const q = query(collection(db, nombre), orderBy(campoOrden, "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDatos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setListo(true);
      },
      (err) => {
        console.error(`Error leyendo ${nombre}:`, err);
        setListo(true);
      }
    );
    return () => unsub();
  }, [nombre, campoOrden]);

  return [datos, listo];
}

export function DataProvider({ children }) {
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    ensureAuth(() => setAutenticado(true));
  }, []);

  const [productos, productosListos] = useColeccion("productos", "nombre");
  const [ventasTodas, ventasListas] = useColeccion("ventas");
  // "ventas" excluye las anuladas: así reportes, dashboard, cierres y movimientos
  // dejan de contarlas solos. "ventasTodas" las incluye (para mostrarlas tachadas).
  const ventas = useMemo(() => ventasTodas.filter((v) => !v.anulada), [ventasTodas]);
  const [cierres, cierresListos] = useColeccion("cierres");
  const [movimientos, movimientosListos] = useColeccion("movimientos");
  const [ingresos, ingresosListos] = useColeccion("ingresos");
  const [gastos, gastosListos] = useColeccion("gastos");
  const [movimientosBarra, movimientosBarraListos] = useColeccion("movimientosBarra");
  const [comprasInventario, comprasInventarioListas] = useColeccion("comprasInventario");
  const [recetas, recetasListas] = useColeccion("recetas", "nombre");
  const [ajustesInventario, ajustesInventarioListos] = useColeccion("ajustesInventario");
  const [aperturasCaja, aperturasCajaListas] = useColeccion("aperturasCaja");
  const [gastosCaja, gastosCajaListos] = useColeccion("gastosCaja");

  const todoListo =
    autenticado &&
    productosListos &&
    ventasListas &&
    cierresListos &&
    movimientosListos &&
    ingresosListos &&
    gastosListos &&
    movimientosBarraListos &&
    comprasInventarioListas &&
    recetasListas &&
    ajustesInventarioListos &&
    aperturasCajaListas &&
    gastosCajaListos;

  async function agregarProducto(producto) {
    await addDoc(collection(db, "productos"), {
      ...producto,
      creadoEn: serverTimestamp(),
    });
  }

  async function actualizarProducto(id, cambios) {
    await updateDoc(doc(db, "productos", id), cambios);
  }

  async function eliminarProducto(id) {
    await deleteDoc(doc(db, "productos", id));
  }

  // Deja en 0 el stock (almacén general, interior y semicubierto) de TODOS los
  // productos, sin borrarlos. Firestore permite máx. 500 escrituras por lote.
  // Borra TODOS los documentos de las colecciones indicadas (nunca "productos" ni "usuarios").
  // Devuelve cuántos documentos se borraron.
  async function limpiarColecciones(nombres) {
    const PERMITIDAS = ["ventas", "aperturasCaja", "cierres", "gastosCaja", "movimientos", "ingresos", "gastos", "movimientosBarra", "ajustesInventario", "comprasInventario"];
    let borrados = 0;
    for (const nombre of nombres.filter((n) => PERMITIDAS.includes(n))) {
      const snap = await getDocs(collection(db, nombre));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const lote = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => lote.delete(d.ref));
        await lote.commit();
        borrados += Math.min(400, snap.docs.length - i);
      }
    }
    return borrados;
  }

  async function ponerStockEnCero() {
    const TAMANO_LOTE = 400;
    for (let i = 0; i < productos.length; i += TAMANO_LOTE) {
      const lote = writeBatch(db);
      productos.slice(i, i + TAMANO_LOTE).forEach((p) => {
        lote.update(doc(db, "productos", p.id), {
          stock: 0,
          stockInterior: 0,
          stockSemicubierto: 0,
        });
      });
      await lote.commit();
    }
    return productos.length;
  }

  // Descuenta del inventario, de forma segura (transacción), lo que consumió una venta.
  // consumos = [{ productoId, cantidad }]; la cantidad puede ser fraccionaria
  // (por ejemplo 0.0714 de botella por una dosis). Descuenta de la barra donde se
  // vendió; si no hay barra (o es "general") descuenta del almacén general.
  async function descontarStock(consumos, barra) {
    const campo =
      barra === "interior" ? "stockInterior" : barra === "semicubierto" ? "stockSemicubierto" : "stock";
    const porProducto = {};
    consumos.forEach((c) => {
      if (!c.productoId) return;
      porProducto[c.productoId] = (porProducto[c.productoId] || 0) + Number(c.cantidad || 0);
    });
    const ids = Object.keys(porProducto);
    if (ids.length === 0) return;
    await runTransaction(db, async (tx) => {
      const refs = ids.map((id) => doc(db, "productos", id));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      snaps.forEach((snap, i) => {
        if (!snap.exists()) return;
        const actual = Number(snap.data()[campo] || 0);
        const nuevo = Math.max(0, Math.round((actual - porProducto[ids[i]]) * 10000) / 10000);
        tx.update(refs[i], { [campo]: nuevo });
      });
    });
  }

  // Un producto normal descuenta su cantidad; un trago (venta.consumo) descuenta
  // cada ingrediente de su receta.
  async function registrarVenta(venta) {
    await addDoc(collection(db, "ventas"), {
      ...venta,
      creadoEn: serverTimestamp(),
    });
    const consumos =
      Array.isArray(venta.consumo) && venta.consumo.length > 0
        ? venta.consumo
        : [{ productoId: venta.productoId, cantidad: venta.cantidad }];
    await descontarStock(consumos, venta.barra);
  }

  // Anula una o varias ventas (las líneas de una comanda): quedan marcadas como
  // anuladas (no se borran) y se devuelve al inventario lo que se había descontado.
  async function anularVentas(lista, { motivo, por }) {
    if (!lista || lista.length === 0) return 0;
    let anuladas = 0;
    await runTransaction(db, async (tx) => {
      anuladas = 0;
      const vRefs = lista.map((v) => doc(db, "ventas", v.id));
      const vSnaps = await Promise.all(vRefs.map((r) => tx.get(r)));
      const devolver = {}; // "productoId|campo" -> cantidad
      const validas = [];
      vSnaps.forEach((snap, i) => {
        if (!snap.exists() || snap.data().anulada) return;
        validas.push(vRefs[i]);
        const v = snap.data();
        const campo =
          v.barra === "interior" ? "stockInterior" : v.barra === "semicubierto" ? "stockSemicubierto" : "stock";
        const consumos =
          Array.isArray(v.consumo) && v.consumo.length > 0
            ? v.consumo
            : [{ productoId: v.productoId, cantidad: v.cantidad }];
        consumos.forEach((c) => {
          if (!c.productoId) return;
          const k = `${c.productoId}|${campo}`;
          devolver[k] = (devolver[k] || 0) + Number(c.cantidad || 0);
        });
      });
      const ids = [...new Set(Object.keys(devolver).map((k) => k.split("|")[0]))];
      const pRefs = ids.map((id) => doc(db, "productos", id));
      const pSnaps = await Promise.all(pRefs.map((r) => tx.get(r)));
      pSnaps.forEach((snap, i) => {
        if (!snap.exists()) return;
        const cambios = {};
        Object.entries(devolver).forEach(([k, cant]) => {
          const [pid, campo] = k.split("|");
          if (pid !== ids[i]) return;
          cambios[campo] = Math.round((Number(snap.data()[campo] || 0) + cant) * 10000) / 10000;
        });
        tx.update(pRefs[i], cambios);
      });
      validas.forEach((ref) =>
        tx.update(ref, {
          anulada: true,
          anuladaPor: por || "",
          anuladaEn: new Date().toISOString(),
          motivoAnulacion: motivo || "",
        })
      );
      anuladas = validas.length;
    });
    return anuladas;
  }

  // Un cierre por apertura: el id es fijo, así un reintento no crea un reporte duplicado.
  async function registrarCierre(cierre) {
    const datos = { ...cierre, creadoEn: serverTimestamp() };
    if (cierre.aperturaId) {
      await setDoc(doc(db, "cierres", `apertura-${cierre.aperturaId}`), datos);
    } else {
      await addDoc(collection(db, "cierres"), datos);
    }
  }

  async function eliminarCierre(id) {
    await deleteDoc(doc(db, "cierres", id));
  }

  // Borra los cierres con más de `diasAntiguedad` días (30 por defecto = 1 mes).
  // Se llama solo cuando el usuario lo pide explícitamente desde Cierre de caja.
  async function limpiarCierresAntiguos(diasAntiguedad = 30) {
    const limite = Date.now() - diasAntiguedad * 24 * 60 * 60 * 1000;
    const antiguos = cierres.filter((c) => new Date(c.fecha).getTime() < limite);
    await Promise.all(antiguos.map((c) => deleteDoc(doc(db, "cierres", c.id))));
    return antiguos.length;
  }

  async function registrarMovimiento(mov) {
    await addDoc(collection(db, "movimientos"), {
      ...mov,
      creadoEn: serverTimestamp(),
    });
  }

  async function actualizarMovimiento(id, cambios) {
    await updateDoc(doc(db, "movimientos", id), cambios);
  }

  async function registrarIngreso(ing) {
    await addDoc(collection(db, "ingresos"), {
      ...ing,
      creadoEn: serverTimestamp(),
    });
  }

  async function registrarGasto(gas) {
    await addDoc(collection(db, "gastos"), {
      ...gas,
      creadoEn: serverTimestamp(),
    });
  }

  // Distribución: mueve stock del almacén general a una barra (ingreso), entre
  // barras (traspaso), o lo da de baja en una barra (rotura, derrame, etc.).
  // Actualiza el producto (stock general + stock de la barra) y deja un registro
  // en "movimientosBarra" con la fecha para el historial.
  async function registrarMovimientoBarra({ tipo, barra, productoId, cantidad, motivo }) {
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) throw new Error("Producto no encontrado.");

    const campoBarra = barra === "interior" ? "stockInterior" : "stockSemicubierto";
    const campoOtraBarra = barra === "interior" ? "stockSemicubierto" : "stockInterior";
    const stockBarraActual = producto[campoBarra] || 0;

    const cambios = {};
    let destino = null;

    if (tipo === "ingreso") {
      cambios.stock = Math.max(0, (producto.stock || 0) - cantidad);
      cambios[campoBarra] = stockBarraActual + cantidad;
    } else if (tipo === "traspaso") {
      destino = barra === "interior" ? "semicubierto" : "interior";
      cambios[campoBarra] = Math.max(0, stockBarraActual - cantidad);
      cambios[campoOtraBarra] = (producto[campoOtraBarra] || 0) + cantidad;
    } else if (tipo === "baja") {
      cambios[campoBarra] = Math.max(0, stockBarraActual - cantidad);
    }

    await actualizarProducto(productoId, cambios);
    await addDoc(collection(db, "movimientosBarra"), {
      fecha: new Date().toISOString(),
      tipo,
      barra,
      destino,
      productoId,
      producto: producto.nombre,
      cantidad,
      motivo: motivo || "",
      creadoEn: serverTimestamp(),
    });
  }

  // Carga de inventario con factura y destino directo (almacén general o una
  // barra), como en la planilla vieja. Crea el producto si es nuevo, o si ya
  // existe le suma la cantidad al destino elegido. Además deja un registro en
  // "comprasInventario" con la factura para poder buscarlo después.
  async function registrarCompra({ productoExistenteId, datosProducto, destino, cantidad, factura }) {
    const campo =
      destino === "interior" ? "stockInterior" : destino === "semicubierto" ? "stockSemicubierto" : "stock";

    let productoId = productoExistenteId;
    let nombreProducto = datosProducto.nombre;

    if (productoExistenteId) {
      const producto = productos.find((p) => p.id === productoExistenteId);
      nombreProducto = producto?.nombre || datosProducto.nombre;
      await actualizarProducto(productoExistenteId, {
        ...datosProducto,
        [campo]: (producto?.[campo] || 0) + cantidad,
      });
    } else {
      const nuevo = await addDoc(collection(db, "productos"), {
        ...datosProducto,
        stock: 0,
        stockInterior: 0,
        stockSemicubierto: 0,
        [campo]: cantidad,
        creadoEn: serverTimestamp(),
      });
      productoId = nuevo.id;
    }

    await addDoc(collection(db, "comprasInventario"), {
      fecha: new Date().toISOString(),
      productoId,
      producto: nombreProducto,
      destino,
      cantidad,
      factura: factura || "",
      precio: datosProducto.precio,
      precioVenta: datosProducto.precioVenta,
      creadoEn: serverTimestamp(),
    });
  }


  async function registrarAperturaCaja(apertura) {
    // Pueden estar abiertas varias cajas a la vez (una por barra o por cajera),
    // pero no dos iguales (misma cajera y misma barra).
    const nombre = String(apertura.cajera || "").trim().toLowerCase();
    const repetida = buscarAperturasActivas(aperturasCaja).some(
      (a) => a.barra === apertura.barra && String(a.cajera || "").trim().toLowerCase() === nombre
    );
    if (repetida) throw new Error("Ya hay una caja abierta para esta cajera en esta barra.");
    // El evento (la noche/fiesta) agrupa todo lo que pase en las cajas de ese evento,
    // aunque se pase de medianoche. Las dos barras con el mismo nombre comparten evento.
    if (!normalizarNombreEvento(apertura.evento)) throw new Error("Falta el nombre del evento.");
    const { evento, eventoId } = resolverEventoParaApertura(apertura.evento, aperturasCaja);
    const ref = await addDoc(collection(db, "aperturasCaja"), {
      ...apertura,
      evento,
      eventoId,
      estado: "abierta",
      creadoEn: serverTimestamp(),
    });
    return ref.id;
  }

  async function cerrarAperturaCaja(id, datosCierre = {}) {
    await updateDoc(doc(db, "aperturasCaja", id), {
      estado: "cerrada",
      cerradaEn: new Date().toISOString(),
      ...datosCierre,
    });
  }

  async function registrarGastoCaja(gasto) {
    await addDoc(collection(db, "gastosCaja"), {
      ...gasto,
      creadoEn: serverTimestamp(),
    });
  }

  async function registrarReceta(receta) {
    await addDoc(collection(db, "recetas"), {
      ...receta,
      creadoEn: serverTimestamp(),
    });
  }

  async function actualizarReceta(id, cambios) {
    await updateDoc(doc(db, "recetas", id), cambios);
  }

  async function eliminarReceta(id) {
    await deleteDoc(doc(db, "recetas", id));
  }

  // Guarda una "foto" del cierre de inventario de un período: apertura, venta,
  // final esperado, saldo real contado y la diferencia, producto por producto.
  async function registrarAjusteInventario(ajuste) {
    await addDoc(collection(db, "ajustesInventario"), {
      ...ajuste,
      creadoEn: serverTimestamp(),
    });
  }

  async function eliminarAjusteInventario(id) {
    await deleteDoc(doc(db, "ajustesInventario", id));
  }

  const value = {
    listo: todoListo,
    productos,
    ventas,
    ventasTodas,
    cierres,
    movimientos,
    ingresos,
    gastos,
    movimientosBarra,
    comprasInventario,
    recetas,
    ajustesInventario,
    aperturasCaja,
    gastosCaja,
    agregarProducto,
    actualizarProducto,
    eliminarProducto,
    ponerStockEnCero,
    limpiarColecciones,
    registrarVenta,
    anularVentas,
    registrarCierre,
    eliminarCierre,
    limpiarCierresAntiguos,
    registrarMovimiento,
    actualizarMovimiento,
    registrarIngreso,
    registrarGasto,
    registrarMovimientoBarra,
    registrarCompra,
    registrarAperturaCaja,
    cerrarAperturaCaja,
    registrarGastoCaja,
    registrarReceta,
    actualizarReceta,
    eliminarReceta,
    registrarAjusteInventario,
    eliminarAjusteInventario,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de DataProvider");
  return ctx;
}