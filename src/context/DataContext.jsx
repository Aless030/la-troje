import { createContext, useContext, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, ensureAuth } from "../firebase";

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
  const [ventas, ventasListas] = useColeccion("ventas");
  const [cierres, cierresListos] = useColeccion("cierres");
  const [movimientos, movimientosListos] = useColeccion("movimientos");
  const [ingresos, ingresosListos] = useColeccion("ingresos");
  const [gastos, gastosListos] = useColeccion("gastos");
  const [movimientosBarra, movimientosBarraListos] = useColeccion("movimientosBarra");
  const [comprasInventario, comprasInventarioListas] = useColeccion("comprasInventario");
  const [recetas, recetasListas] = useColeccion("recetas", "nombre");
  const [ajustesInventario, ajustesInventarioListos] = useColeccion("ajustesInventario");

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
    ajustesInventarioListos;

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

  // La venta descuenta de la barra donde se vendió (Interior/Semicubierto). Si no
  // se indica barra (o es "general"), descuenta del almacén general como antes.
  async function registrarVenta(venta) {
    await addDoc(collection(db, "ventas"), {
      ...venta,
      creadoEn: serverTimestamp(),
    });
    const producto = productos.find((p) => p.id === venta.productoId);
    if (producto) {
      const campo =
        venta.barra === "interior"
          ? "stockInterior"
          : venta.barra === "semicubierto"
          ? "stockSemicubierto"
          : "stock";
      const nuevoValor = Math.max(0, (producto[campo] || 0) - venta.cantidad);
      await actualizarProducto(producto.id, { [campo]: nuevoValor });
    }
  }

  async function registrarCierre(cierre) {
    await addDoc(collection(db, "cierres"), {
      ...cierre,
      creadoEn: serverTimestamp(),
    });
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
    cierres,
    movimientos,
    ingresos,
    gastos,
    movimientosBarra,
    comprasInventario,
    recetas,
    ajustesInventario,
    agregarProducto,
    actualizarProducto,
    eliminarProducto,
    registrarVenta,
    registrarCierre,
    eliminarCierre,
    limpiarCierresAntiguos,
    registrarMovimiento,
    registrarIngreso,
    registrarGasto,
    registrarMovimientoBarra,
    registrarCompra,
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