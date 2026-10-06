const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Ubicar el archivo de Excel
let inputPath = path.resolve(__dirname, '..', 'Productos_2026-9-22.xlsx');
if (!fs.existsSync(inputPath)) {
  inputPath = path.resolve(__dirname, 'Productos_2026-9-22.xlsx');
}

if (!fs.existsSync(inputPath)) {
  console.error('❌ No se encontró el archivo Productos_2026-9-22.xlsx.');
  process.exit(1);
}

console.log('📖 Leyendo libro de Excel desde:', inputPath);

// 2. Leer las hojas del archivo
const workbook = XLSX.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
console.log('📑 Procesando hoja:', sheetName);

const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
console.log(`📊 Filas encontradas en el Excel: ${rows.length}`);

// 3. Mapear las columnas a la estructura del sistema
const encabezados = [
  'codigoBarras',
  'nombre',
  'precioVenta',
  'costo',
  'invActual',
  'invMinimo',
  'piezasPorPaquete',
  'precioVentaPaquete',
  'locacion',
  'claveUnidad'
];

const outLines = [encabezados.join(',')];

for (const fila of rows) {
  // Soporta nombres con o sin guiones bajos escapados
  const cbarras = String(fila.cbarras || fila['cbarras'] || '').trim();
  const nombre = String(fila.nombre_producto || fila['nombre\\_producto'] || fila.descripcion_producto || '').replace(/"/g, '""').trim();

  if (!cbarras && !nombre) continue;

  const precioVenta = parseFloat(fila.precio_venta || fila['precio\\_venta']) || 0;
  const costo = parseFloat(fila.precio_compra || fila['precio\\_compra']) || 0;
  const invActual = parseFloat(fila.existencia) || 0;
  const invMinimo = parseInt(fila.dInvMin || fila['dInvMin'], 10) || 0;

  let claveUnidad = String(fila.clave_unidad || fila['clave\\_unidad'] || 'PZA').trim();
  if (claveUnidad === 'H87' || claveUnidad === 'PIEZA' || !claveUnidad) {
    claveUnidad = 'PZA';
  }

  outLines.push(`"${cbarras}","${nombre}",${precioVenta},${costo},${invActual},${invMinimo},1,0.0,,"${claveUnidad}"`);
}

// 4. Guardar archivo CSV listo para importar en la raíz del proyecto
const outPath = path.resolve(__dirname, '..', 'catalogo_productos_importar.csv');
fs.writeFileSync(outPath, '\ufeff' + outLines.join('\r\n'), 'utf8');

console.log('====================================');
console.log('✅ ¡CONVERSIÓN EXITOSA!');
console.log(`📦 Productos procesados: ${outLines.length - 1}`);
console.log('📍 Archivo generado en:', outPath);
console.log('====================================');