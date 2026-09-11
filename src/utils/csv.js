export function descargarCSV(nombreArchivo, columnas, filas) {
  const escapar = (valor) => {
    const texto = String(valor ?? "");
    if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };

  const encabezado = columnas.map((c) => escapar(c.titulo)).join(",");
  const lineas = filas.map((fila) =>
    columnas.map((c) => escapar(fila[c.clave])).join(",")
  );
  const contenido = [encabezado, ...lineas].join("\n");

  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo.endsWith(".csv")
    ? nombreArchivo
    : `${nombreArchivo}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
