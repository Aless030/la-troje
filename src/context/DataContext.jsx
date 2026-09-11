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

  const todoListo =
    autenticado &&
    productosListos &&
    ventasListas &&
    cierresListos &&
    movimientosListos &&
    ingresosListos &&
    gastosListos;

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

  async function registrarVenta(venta) {
    await addDoc(collection(db, "ventas"), {
      ...venta,
      creadoEn: serverTimestamp(),
    });
    const producto = productos.find((p) => p.id === venta.productoId);
    if (producto) {
      const nuevoStock = Math.max(0, (producto.stock || 0) - venta.cantidad);
      await actualizarProducto(producto.id, { stock: nuevoStock });
    }
  }

  async function registrarCierre(cierre) {
    await addDoc(collection(db, "cierres"), {
      ...cierre,
      creadoEn: serverTimestamp(),
    });
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

  const value = {
    listo: todoListo,
    productos,
    ventas,
    cierres,
    movimientos,
    ingresos,
    gastos,
    agregarProducto,
    actualizarProducto,
    eliminarProducto,
    registrarVenta,
    registrarCierre,
    registrarMovimiento,
    registrarIngreso,
    registrarGasto,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de DataProvider");
  return ctx;
}
