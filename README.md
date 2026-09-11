# La Troje — Sistema de ventas, inventario y caja

Sistema completo para "La Troje": menú principal, registro de ventas, inventario,
cierre de caja, reportes (CSV/PDF), dashboard de métricas, movimientos de caja
(sueldos, proveedores, facturas) e ingresos/gastos semanales.

- **Frontend:** React + Vite
- **Base de datos:** Firebase (Firestore), en tiempo real — todos los meseros ven
  lo mismo al instante desde cualquier celular o computadora.
- **Hosting:** Netlify

---

## 1. Crear el proyecto de Firebase (una sola vez)

1. Ve a https://console.firebase.google.com y crea un proyecto nuevo (ej: "la-troje").
2. En el menú izquierdo entra a **Compilación → Firestore Database** → **Crear base de datos**.
   - Elige modo **producción** y la región más cercana (ej: `southamerica-east1`).
3. Entra a **Compilación → Authentication** → **Comenzar** → pestaña **Sign-in method** →
   habilita **Anónimo**. (La app registra cada sesión de forma anónima para que las
   reglas de seguridad de Firestore funcionen; los meseros no necesitan crear cuenta
   ni contraseña).
4. Ve a **Configuración del proyecto** (ícono de engranaje) → baja hasta **Tus apps**
   → clic en el ícono `</>` (Web) → registra la app (ej: "la-troje-web").
   Firebase te mostrará un bloque `firebaseConfig` con estos datos: `apiKey`,
   `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
   **Guarda esos valores**, los necesitas en el paso 3.
5. En **Firestore Database → Reglas**, pega el contenido del archivo
   `firestore.rules` (incluido en este proyecto) y publica. Esto permite leer y
   escribir solo a usuarios autenticados (incluida la autenticación anónima).

---

## 2. Probar en tu computadora (opcional, antes de publicar)

Necesitas tener [Node.js](https://nodejs.org) instalado (versión 18 o superior).

```bash
cd la-troje
npm install
cp .env.example .env
```

Abre `.env` y pega los valores de tu `firebaseConfig` (paso 1.4):

```
VITE_FIREBASE_API_KEY=xxxxx
VITE_FIREBASE_AUTH_DOMAIN=la-troje.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=la-troje
VITE_FIREBASE_STORAGE_BUCKET=la-troje.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxx
VITE_FIREBASE_APP_ID=xxxxx
```

Luego:

```bash
npm run dev
```

Abre el link que aparece (normalmente `http://localhost:5173`).

---

## 3. Publicar en Netlify

**Opción A — Arrastrando la carpeta (la más simple, sin GitHub):**

1. En tu computadora: `npm install` y luego `npm run build`. Esto crea una
   carpeta `dist/`.
2. Entra a https://app.netlify.com → **Add new site → Deploy manually** →
   arrastra la carpeta `dist`.
3. Ve a **Site configuration → Environment variables** y agrega las mismas
   6 variables `VITE_FIREBASE_...` del paso 2.
4. Como los archivos de `dist` ya quedaron generados con placeholders, después
   de guardar las variables ve a **Deploys → Trigger deploy → Clear cache and
   deploy site** para que las tome en cuenta (o mejor usa la Opción B, que las
   aplica automáticamente en cada build).

**Opción B — Conectando tu repositorio de GitHub (recomendada, permite
actualizar el sistema después sin volver a arrastrar nada):**

1. Sube esta carpeta a un repositorio nuevo en GitHub.
2. En Netlify: **Add new site → Import an existing project** → elige el
   repositorio. Netlify detecta automáticamente `npm run build` y la carpeta
   `dist` (ya viene configurado en `netlify.toml`).
3. Antes de darle a "Deploy", agrega las 6 variables de entorno
   `VITE_FIREBASE_...` en **Site configuration → Environment variables**.
4. Dale a **Deploy site**. Cada vez que subas cambios al repositorio, Netlify
   vuelve a publicar solo.

Al terminar, Netlify te da un link tipo `https://la-troje.netlify.app` — ese es
el que comparten los meseros y la caja (puedes ponerlo como acceso directo en
la pantalla de inicio del celular).

---

## 4. Cómo usar cada módulo

- **Menú principal:** resumen del día (ventas, efectivo, QR) y accesos rápidos
  a todo lo demás.
- **Inventario:** primero carga aquí tus productos (nombre, categoría, precio,
  stock). Esto es lo que después aparece automáticamente en el formulario de
  Venta. Puedes editar, eliminar o ajustar el stock manualmente con los
  botones `−` / `+`.
- **Venta:** el mesero elige su nombre, el producto (el precio se llena solo),
  la cantidad, la forma de pago (efectivo, QR o ambos — si es "ambos" pide
  cuánto de cada uno) y observaciones. Al guardar, se descuenta el stock
  automáticamente del inventario.
- **Cierre de caja:** muestra todo lo vendido en el día, separado en efectivo
  y QR, con el detalle por producto. El botón "Cerrar caja de hoy" guarda ese
  resumen como histórico (una vez cerrado el día, no se puede volver a cerrar
  el mismo día). También se puede descargar en PDF.
- **Reportes:** filtra por rango de fechas y mira ventas por mesero, por
  producto y los saldos en efectivo/QR. Se descarga en CSV o PDF.
- **Dashboard:** métricas generales — producto más vendido, producto de menor
  rotación, ingresos totales, distribución efectivo vs QR, valor del
  inventario actual.
- **Movimientos de caja:** registra sueldos, pagos a proveedores y facturas
  (con número de factura si aplica) y ve el total de salidas.
- **Semanales:** ingresos (efectivo o QR) y gastos por categoría (agua, luz,
  internet, sueldos, planillas) de la semana actual (lunes a domingo), con
  balance y descarga en CSV.

---

## 5. Notas importantes

- **Sin login individual por mesero:** por simplicidad, cualquiera que abra el
  link puede usar el sistema (queda protegido de gente externa gracias a la
  autenticación anónima + las reglas de Firestore, pero no distingue "quién"
  es cada mesero más allá del nombre que escribe en el formulario). Si más
  adelante quieres que cada mesero tenga su usuario y contraseña, se puede
  agregar Firebase Authentication con email/contraseña — avísame y lo sumamos.
- **Respaldo de datos:** todo vive en Firestore, así que puedes ver y exportar
  tus datos también desde la consola de Firebase en cualquier momento.
- **Costo:** Firebase (plan gratuito "Spark") y Netlify (plan gratuito) cubren
  perfectamente el uso de un restaurante como La Troje sin costo, salvo que el
  volumen de datos crezca mucho — ahí Firebase avisa antes de cobrar.
