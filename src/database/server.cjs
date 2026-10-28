const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os'); 

const app = express();
app.use(cors());

// Límite ampliado a 150MB para soportar respaldos completos con imágenes en Base64
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// --- FUNCIONES DE FECHA LOCAL EXACTA ---
const getFechaLocal = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const getFechaHoraLocal = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// --- LÓGICA DE RUTAS COMPATIBLE CON EJECUTABLE (.EXE) Y DESARROLLO ---
let RUTA_DB_ACTUAL;
let RUTA_BACKUPS;

if (process.pkg) {
  const baseAppData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const RUTA_DIR_APP = path.join(baseAppData, 'AsadelPOS');
  
  if (!fs.existsSync(RUTA_DIR_APP)) {
    fs.mkdirSync(RUTA_DIR_APP, { recursive: true });
  }
  
  RUTA_DB_ACTUAL = path.join(RUTA_DIR_APP, 'puntos_de_venta.db');
  RUTA_BACKUPS = path.join(RUTA_DIR_APP, 'backups');
} else {
  RUTA_DB_ACTUAL = fs.existsSync(path.resolve(__dirname, 'puntos_de_venta.db'))
    ? path.resolve(__dirname, 'puntos_de_venta.db')
    : path.resolve(__dirname, 'src/database/puntos_de_venta.db');

  const RUTA_DIR_DB = path.dirname(RUTA_DB_ACTUAL);
  if (!fs.existsSync(RUTA_DIR_DB)) {
    fs.mkdirSync(RUTA_DIR_DB, { recursive: true });
  }

  const RUTA_RAIZ_PROYECTO = path.resolve(RUTA_DIR_DB, '..', '..');
  RUTA_BACKUPS = path.resolve(RUTA_RAIZ_PROYECTO, 'backups');
}

if (!fs.existsSync(RUTA_BACKUPS)) {
  fs.mkdirSync(RUTA_BACKUPS, { recursive: true });
}

let db = new sqlite3.Database(RUTA_DB_ACTUAL, (err) => {
  if (err) console.error('Error al abrir la base de datos:', err.message);
  else console.log('✅ Base de datos SQLite conectada correctamente en:', RUTA_DB_ACTUAL);
});

// Inicialización y migración automática de tablas
const inicializarBaseDeDatos = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigoBarras TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        locacion TEXT,
        claveUnidad TEXT,
        atributoColor TEXT,
        departamento_id INTEGER,
        categoria_id INTEGER,
        proveedor_id INTEGER,
        imagen TEXT, 
        imagenLocacion TEXT,
        costoPaquete REAL DEFAULT 0,
        piezasPorPaquete INTEGER DEFAULT 1,
        precioVentaPaquete REAL DEFAULT 0,
        notaPaquete TEXT,
        costo REAL DEFAULT 0,
        precioVenta REAL DEFAULT 0,
        ganancia REAL DEFAULT 0,
        invMinimo INTEGER DEFAULT 0,
        invActual REAL DEFAULT 0,
        puntosLealtad INTEGER DEFAULT 0,
        esServicio BOOLEAN DEFAULT 0,
        esKit BOOLEAN DEFAULT 0,
        aGranel BOOLEAN DEFAULT 0,
        noInventariado BOOLEAN DEFAULT 0,
        fechaCompra TEXT,
        insumo_producto_id INTEGER DEFAULT NULL,
        insumo_cantidad REAL DEFAULT 0
      )
    `);

    // Parches automáticos para bases existentes sin pérdida de información
    db.run(`ALTER TABLE productos ADD COLUMN fechaCompra TEXT`, () => {});
    db.run(`ALTER TABLE productos ADD COLUMN insumo_producto_id INTEGER DEFAULT NULL`, () => {});
    db.run(`ALTER TABLE productos ADD COLUMN insumo_cantidad REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE productos ADD COLUMN redondear_granel BOOLEAN DEFAULT 0`, () => {});
    db.run(`ALTER TABLE productos ADD COLUMN tipo_redondeo TEXT DEFAULT 'peso_arriba'`, () => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS historial_costos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        proveedor TEXT NOT NULL,
        costo_paquete REAL DEFAULT 0,
        piezas_por_paquete INTEGER DEFAULT 1,
        costo_unitario REAL NOT NULL,
        cantidad_comprada REAL DEFAULT 0,
        nota TEXT,
        fecha_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(producto_id) REFERENCES productos(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS compras_manuales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        cantidad REAL DEFAULT 1,
        proveedor_id INTEGER,
        proveedor_nombre TEXT,
        costo_estimado REAL DEFAULT 0,
        nota TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS promociones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL,
        valor REAL DEFAULT 0
      )
    `, () => {
      db.get('SELECT COUNT(*) as count FROM promociones', (err, row) => {
        if (row && row.count === 0) {
          const stmt = db.prepare('INSERT INTO promociones (nombre, tipo, valor) VALUES (?, ?, ?)');
          stmt.run('10% Mayoreo Escolar', 'porcentaje', 10);
          stmt.run('15% Campaña Temporada', 'porcentaje', 15);
          stmt.run('20% Remate de Stock', 'porcentaje', 20);
          stmt.finalize();
        }
      });
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS cierres_globales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT UNIQUE NOT NULL,
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        caja_inicial REAL DEFAULT 0,
        billetes REAL DEFAULT 0,
        morralla REAL DEFAULT 0,
        total_fisico REAL DEFAULT 0,
        ventas_dia REAL DEFAULT 0,
        ganancia_estimada REAL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT UNIQUE NOT NULL,
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        total REAL NOT NULL,
        metodo_pago TEXT NOT NULL,
        monto_efectivo REAL DEFAULT 0,
        monto_tarjeta REAL DEFAULT 0,
        monto_vales REAL DEFAULT 0,
        monto_codi REAL DEFAULT 0,
        cajero TEXT NOT NULL,
        cliente_id INTEGER,
        puntos_ganados INTEGER DEFAULT 0,
        puntos_canjeados INTEGER DEFAULT 0,
        estado TEXT DEFAULT 'completada'
      )
    `);

    db.run(`ALTER TABLE ventas ADD COLUMN cliente_id INTEGER`, () => {});
    db.run(`ALTER TABLE ventas ADD COLUMN puntos_ganados INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE ventas ADD COLUMN puntos_canjeados INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE ventas ADD COLUMN estado TEXT DEFAULT 'completada'`, () => {});
    db.run(`ALTER TABLE ventas ADD COLUMN monto_vales REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE ventas ADD COLUMN monto_codi REAL DEFAULT 0`, () => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS detalle_ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        precio_aplicado REAL NOT NULL,
        descuento_porcentaje REAL DEFAULT 0,
        comentario TEXT,
        piezas_por_paquete REAL DEFAULT 1,
        insumo_descontado_id INTEGER DEFAULT NULL,
        insumo_descontado_cant REAL DEFAULT 0,
        FOREIGN KEY(venta_id) REFERENCES ventas(id),
        FOREIGN KEY(producto_id) REFERENCES productos(id)
      )
    `);

    db.run(`ALTER TABLE detalle_ventas ADD COLUMN piezas_por_paquete REAL DEFAULT 1`, () => {});
    db.run(`ALTER TABLE detalle_ventas ADD COLUMN insumo_descontado_id INTEGER DEFAULT NULL`, () => {});
    db.run(`ALTER TABLE detalle_ventas ADD COLUMN insumo_descontado_cant REAL DEFAULT 0`, () => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS movimientos_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        monto REAL NOT NULL,
        motivo TEXT NOT NULL,
        cajero TEXT NOT NULL,
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cortes_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT UNIQUE NOT NULL,
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        cajero TEXT NOT NULL,
        total_ventas_efectivo REAL DEFAULT 0,
        total_ventas_tarjeta REAL DEFAULT 0,
        total_ventas_vales REAL DEFAULT 0,
        total_ventas_codi REAL DEFAULT 0,
        total_entradas REAL DEFAULT 0,
        total_salidas REAL DEFAULT 0,
        saldo_esperado REAL DEFAULT 0,
        saldo_declarado REAL DEFAULT 0,
        diferencia REAL DEFAULT 0,
        observaciones TEXT
      )
    `);

    db.run(`ALTER TABLE cortes_caja ADD COLUMN total_ventas_vales REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE cortes_caja ADD COLUMN total_ventas_codi REAL DEFAULT 0`, () => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS kits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        precio REAL NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS kit_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kit_id INTEGER,
        producto_id INTEGER,
        cantidad REAL,
        FOREIGN KEY(kit_id) REFERENCES kits(id),
        FOREIGN KEY(producto_id) REFERENCES productos(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS departamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS proveedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        telefono TEXT,
        contacto TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        telefono TEXT UNIQUE NOT NULL,
        puntos_acumulados INTEGER DEFAULT 0,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS empresa_datos (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        nombre TEXT NOT NULL,
        sucursal TEXT,
        direccion TEXT,
        telefono TEXT,
        mensaje_ticket TEXT,
        logo TEXT,
        imprimir_ticket_auto BOOLEAN DEFAULT 1
      )
    `, () => {
      db.run(`ALTER TABLE empresa_datos ADD COLUMN imprimir_ticket_auto BOOLEAN DEFAULT 1`, () => {});
      db.get('SELECT COUNT(*) as count FROM empresa_datos', (err, row) => {
        if (row && row.count === 0) {
          db.run(`
            INSERT INTO empresa_datos (id, nombre, sucursal, direccion, telefono, mensaje_ticket, imprimir_ticket_auto)
            VALUES (1, 'PAPELERÍA ASADEL', 'Sucursal Centro', 'Av. Principal #123, Col. Centro', '55 1234 5678', '¡Gracias por su compra y preferencia!', 1)
          `);
        }
      });
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        password TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'cajero',
        activo BOOLEAN DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, () => {
      db.get('SELECT COUNT(*) as count FROM usuarios', (err, row) => {
        if (row && row.count === 0) {
          const stmt = db.prepare('INSERT INTO usuarios (usuario, nombre, password, rol, activo) VALUES (?, ?, ?, ?, ?)');
          stmt.run('admin', 'Administrador Principal', 'admin123', 'admin', 1);
          stmt.run('turno1', 'Cajero Turno 1', 'caja123', 'cajero', 1);
          stmt.finalize();
        }
      });
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS configuracion_lealtad (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      )
    `, () => {
      db.get('SELECT COUNT(*) as count FROM configuracion_lealtad', (err, row) => {
        if (row && row.count === 0) {
          const stmt = db.prepare('INSERT INTO configuracion_lealtad (clave, valor) VALUES (?, ?)');
          stmt.run('valor_punto_pesos', '1.0');
          stmt.run('minimo_puntos_canje', '0');
          stmt.run('porcentaje_max_descuento', '100');
          stmt.finalize();
        }
      });
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS configuracion_respaldos (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      )
    `, () => {
      db.get('SELECT COUNT(*) as count FROM configuracion_respaldos', (err, row) => {
        if (row && row.count === 0) {
          const stmt = db.prepare('INSERT INTO configuracion_respaldos (clave, valor) VALUES (?, ?)');
          stmt.run('frecuencia_respaldo', 'diario');
          stmt.run('ultimo_respaldo', getFechaHoraLocal());
          stmt.finalize();
        }
      });
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS configuracion_impresiones (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      )
    `, () => {
      db.get('SELECT COUNT(*) as count FROM configuracion_impresiones', (err, row) => {
        if (row && row.count === 0) {
          const stmt = db.prepare('INSERT INTO configuracion_impresiones (clave, valor) VALUES (?, ?)');
          stmt.run('precio_bn', '1.0');
          stmt.run('precio_color_leve', '2.5');
          stmt.run('precio_color_completo', '5.0');
          stmt.run('umbral_bn_max', '1.0');
          stmt.run('umbral_leve_max', '25.0');
          stmt.run('insumo_producto_id', ''); // <-- NUEVO
          stmt.run('insumo_cantidad', '1');
          stmt.finalize();
        }
      });
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS reglas_tarifas_impresion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        nombre TEXT NOT NULL,
        hasta_porcentaje REAL NOT NULL,
        precio REAL NOT NULL
      )
    `, () => {
      db.get('SELECT COUNT(*) as count FROM reglas_tarifas_impresion', (err, row) => {
        if (row && row.count === 0) {
          const stmt = db.prepare('INSERT INTO reglas_tarifas_impresion (tipo, nombre, hasta_porcentaje, precio) VALUES (?, ?, ?, ?)');
          // Reglas de tipo Negro de CyberPlanet
          stmt.run('negro', 'Texto', 21.0, 2.0);
          stmt.run('negro', 'Texto/Foto', 50.0, 2.0);
          stmt.run('negro', 'Foto Grande', 80.0, 3.0);
          stmt.run('negro', 'Pleno', 100.0, 3.0);

          // Reglas de tipo Color de CyberPlanet
          stmt.run('color', 'Texto Color1', 4.0, 2.0);
          stmt.run('color', 'Texto Color2', 4.6, 3.0);
          stmt.run('color', 'Texto Color3', 18.0, 3.0);
          stmt.run('color', 'Texto Color4', 20.0, 4.0);
          stmt.run('color', 'Texto Color5', 25.0, 5.0);
          stmt.run('color', 'Texto Color6', 35.0, 5.0);
          stmt.run('color', 'Texto Color40', 40.0, 6.0);
          stmt.run('color', 'Color50', 50.0, 7.0);
          stmt.run('color', 'Pleno Color', 100.0, 10.0);
          stmt.finalize();
        }
      });
    });

  });
};

inicializarBaseDeDatos();

// --- RESPALDO CON MOTOR SQLITE SEGURO (VACUUM INTO) ---
const ejecutarRespaldoEnDisco = (callback) => {
  try {
    if (!fs.existsSync(RUTA_DB_ACTUAL)) {
      console.error('❌ No se encontró la base de datos en:', RUTA_DB_ACTUAL);
      if (callback) callback(new Error('Base de datos no encontrada'));
      return;
    }
    const fechaStr = getFechaHoraLocal().replace(/[:.]/g, '-');
    const destino = path.join(RUTA_BACKUPS, `respaldo_asadel_${fechaStr}.db`);
    const destinoSql = destino.replace(/'/g, "''");

    db.run(`VACUUM INTO '${destinoSql}'`, [], (err) => {
      if (err) {
        // Fallback por si la versión interna no permite VACUUM INTO
        try {
          fs.copyFileSync(RUTA_DB_ACTUAL, destino);
          db.run(`UPDATE configuracion_respaldos SET valor = ? WHERE clave = 'ultimo_respaldo'`, [getFechaHoraLocal()]);
          console.log(`💾 Respaldo generado por copia física en: ${destino}`);
          if (callback) callback(null, destino);
        } catch (copyErr) {
          console.error('Error en fallback de respaldo:', copyErr);
          if (callback) callback(copyErr);
        }
      } else {
        db.run(`UPDATE configuracion_respaldos SET valor = ? WHERE clave = 'ultimo_respaldo'`, [getFechaHoraLocal()]);
        console.log(`💾 Respaldo generado con éxito vía VACUUM INTO: ${destino}`);
        if (callback) callback(null, destino);
      }
    });
  } catch (err) {
    console.error('Error general al generar respaldo:', err);
    if (callback) callback(err);
  }
};

setInterval(() => {
  db.all('SELECT * FROM configuracion_respaldos', [], (err, rows) => {
    if (err || !rows) return;
    const config = {};
    rows.forEach(r => config[r.clave] = r.valor);

    if (config.frecuencia_respaldo === 'desactivado') return;

    const ultimo = new Date(config.ultimo_respaldo || 0).getTime();
    const ahora = Date.now();
    const horasTranscurridas = (ahora - ultimo) / (1000 * 60 * 60);

    if (config.frecuencia_respaldo === '12h' && horasTranscurridas >= 12) {
      ejecutarRespaldoEnDisco();
    } else if (config.frecuencia_respaldo === 'diario' && horasTranscurridas >= 24) {
      ejecutarRespaldoEnDisco();
    } else if (config.frecuencia_respaldo === 'semanal' && horasTranscurridas >= 168) {
      ejecutarRespaldoEnDisco();
    }
  });
}, 1000 * 60 * 60);

app.get('/api/productos', (req, res) => {
  const sql = `
    SELECT 
      p.*,
      d.nombre AS departamento_nombre,
      c.nombre AS categoria_nombre,
      pr.nombre AS proveedor_nombre,
      ins.nombre AS insumo_nombre,
      ins.invActual AS insumo_stock
    FROM productos p
    LEFT JOIN departamentos d ON p.departamento_id = d.id
    LEFT JOIN categorias c ON p.categoria_id = c.id
    LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
    LEFT JOIN productos ins ON p.insumo_producto_id = ins.id
    ORDER BY p.id DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/productos', (req, res) => {
  const {
    codigoBarras, nombre, locacion, claveUnidad, atributoColor,
    departamento, categoria, proveedor,
    departamento_id, categoria_id, proveedor_id,
    imagen, imagenLocacion,
    costoPaquete, piezasPorPaquete, precioVentaPaquete, notaPaquete,
    costo, precioVenta, ganancia,
    invMinimo, invActual, puntosLealtad,
    esServicio, esKit, aGranel, noInventariado,
    fechaCompra,
    insumo_producto_id, insumo_cantidad,
    redondear_granel, tipo_redondeo
  } = req.body;

  const sql = `
    INSERT INTO productos (
      codigoBarras, nombre, locacion, claveUnidad, atributoColor,
      departamento_id, categoria_id, proveedor_id, imagen, imagenLocacion,
      costoPaquete, piezasPorPaquete, precioVentaPaquete, notaPaquete,
      costo, precioVenta, ganancia,
      invMinimo, invActual, puntosLealtad,
      esServicio, esKit, aGranel, noInventariado, fechaCompra,
      insumo_producto_id, insumo_cantidad,
      redondear_granel, tipo_redondeo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const fechaCompraFinal = fechaCompra || getFechaLocal();
  const insumoIdFinal = (esServicio && insumo_producto_id) ? parseInt(insumo_producto_id, 10) : null;
  const insumoCantFinal = (esServicio && insumo_cantidad) ? parseFloat(insumo_cantidad) : 0;

  const params = [
    codigoBarras || '', nombre, locacion || '', claveUnidad || 'PZA', atributoColor || '',
    departamento_id || departamento || null,
    categoria_id || categoria || null,
    proveedor_id || proveedor || null,
    imagen || null, imagenLocacion || null,
    costoPaquete || 0, piezasPorPaquete || 1, precioVentaPaquete || 0, notaPaquete || '',
    costo || 0, precioVenta || 0, ganancia || 0,
    esServicio || noInventariado ? 0 : (invMinimo || 0),
    esServicio || noInventariado ? 0 : (parseFloat(invActual) || 0),
    puntosLealtad || 0,
    esServicio ? 1 : 0, esKit ? 1 : 0, aGranel ? 1 : 0, noInventariado ? 1 : 0,
    fechaCompraFinal,
    insumoIdFinal,
    insumoCantFinal,
    redondear_granel ? 1 : 0,
    tipo_redondeo || 'peso_arriba'
  ];

  db.run(sql, params, function (err) {
    if (err) return res.status(400).json({ error: err.message || 'Error al insertar producto.' });
    const nuevoId = this.lastID;

    if (parseFloat(costo) > 0 || parseFloat(costoPaquete) > 0) {
      db.run(
        `INSERT INTO historial_costos (producto_id, proveedor, costo_paquete, piezas_por_paquete, costo_unitario, cantidad_comprada, nota, fecha_compra)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nuevoId,
          'Alta Inicial',
          parseFloat(costoPaquete) || 0,
          parseInt(piezasPorPaquete, 10) || 1,
          parseFloat(costo) || 0,
          esServicio || noInventariado ? 0 : (parseFloat(invActual) || 0),
          'Costo inicial registrado al crear el producto',
          fechaCompraFinal
        ]
      );
    }
    res.json({ id: nuevoId, mensaje: 'Producto guardado correctamente' });
  });
});

app.put('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  const {
    codigoBarras, nombre, locacion, claveUnidad, atributoColor,
    departamento, categoria, proveedor,
    departamento_id, categoria_id, proveedor_id,
    imagen, imagenLocacion,
    costoPaquete, piezasPorPaquete, precioVentaPaquete, notaPaquete,
    costo, precioVenta, ganancia,
    invMinimo, invActual, puntosLealtad,
    esServicio, esKit, aGranel, noInventariado,
    fechaCompra,
    insumo_producto_id, insumo_cantidad,
    redondear_granel, tipo_redondeo
  } = req.body;

  const insumoIdFinal = (esServicio && insumo_producto_id) ? parseInt(insumo_producto_id, 10) : null;
  const insumoCantFinal = (esServicio && insumo_cantidad) ? parseFloat(insumo_cantidad) : 0;

  const sql = `
    UPDATE productos SET
      codigoBarras = ?, nombre = ?, locacion = ?, claveUnidad = ?, atributoColor = ?,
      departamento_id = ?, categoria_id = ?, proveedor_id = ?, imagen = ?, imagenLocacion = ?,
      costoPaquete = ?, piezasPorPaquete = ?, precioVentaPaquete = ?, notaPaquete = ?,
      costo = ?, precioVenta = ?, ganancia = ?,
      invMinimo = ?, invActual = ?, puntosLealtad = ?,
      esServicio = ?, esKit = ?, aGranel = ?, noInventariado = ?,
      fechaCompra = ?,
      insumo_producto_id = ?,
      insumo_cantidad = ?,
      redondear_granel = ?,
      tipo_redondeo = ?
    WHERE id = ?
  `;

  const params = [
    codigoBarras || '', nombre, locacion || '', claveUnidad || 'PZA', atributoColor || '',
    departamento_id || departamento || null,
    categoria_id || categoria || null,
    proveedor_id || proveedor || null,
    imagen || null, imagenLocacion || null,
    costoPaquete || 0, piezasPorPaquete || 1, precioVentaPaquete || 0, notaPaquete || '',
    costo || 0, precioVenta || 0, ganancia || 0,
    esServicio || noInventariado ? 0 : (invMinimo || 0),
    esServicio || noInventariado ? 0 : (parseFloat(invActual) || 0),
    puntosLealtad || 0,
    esServicio ? 1 : 0, esKit ? 1 : 0, aGranel ? 1 : 0, noInventariado ? 1 : 0,
    fechaCompra || getFechaLocal(),
    insumoIdFinal,
    insumoCantFinal,
    redondear_granel ? 1 : 0,
    tipo_redondeo || 'peso_arriba',
    id
  ];

  db.run(sql, params, function (err) {
    if (err) return res.status(400).json({ error: err.message || 'Error al actualizar producto.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto actualizado exitosamente' });
  });
});

app.delete('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM historial_costos WHERE producto_id = ?', [id], () => {
    db.run('DELETE FROM productos WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: 'Error al intentar eliminar el producto.' });
      res.json({ mensaje: 'Producto eliminado correctamente', id: Number(id) });
    });
  });
});

app.get('/api/productos/:id/historial-costos', (req, res) => {
  const { id } = req.params;
  db.all(`SELECT * FROM historial_costos WHERE producto_id = ? ORDER BY id DESC`, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/productos/:id/registrar-compra', (req, res) => {
  const {
    proveedor,
    costoPaquete,
    piezasPorPaquete,
    costoUnitario,
    cantidadComprada,
    nota,
    fechaCompra,
    actualizarPrecioVenta,
    nuevoPrecioVenta
  } = req.body;
  const { id } = req.params;

  if (!proveedor || !costoUnitario) {
    return res.status(400).json({ error: 'Faltan datos obligatorios de la compra.' });
  }

  const cantCompradaNum = parseFloat(cantidadComprada) || 0;
  const costoUniNum = parseFloat(costoUnitario) || 0;
  const costoPaqNum = parseFloat(costoPaquete) || 0;
  const pzsPaqNum = parseInt(piezasPorPaquete, 10) || 1;
  const fechaFinal = fechaCompra || getFechaLocal();

  const sqlHistorial = `
    INSERT INTO historial_costos (
      producto_id, proveedor, costo_paquete, piezas_por_paquete,
      costo_unitario, cantidad_comprada, nota, fecha_compra
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sqlHistorial,
    [id, proveedor.trim(), costoPaqNum, pzsPaqNum, costoUniNum, cantCompradaNum, nota ? nota.trim() : '', fechaFinal],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      let sqlUpdate = `
        UPDATE productos 
        SET 
          invActual = invActual + ?,
          costo = ?,
          costoPaquete = CASE WHEN ? > 0 THEN ? ELSE costoPaquete END,
          piezasPorPaquete = CASE WHEN ? > 0 THEN ? ELSE piezasPorPaquete END,
          fechaCompra = ?
      `;
      let paramsUpdate = [cantCompradaNum, costoUniNum, costoPaqNum, costoPaqNum, pzsPaqNum, pzsPaqNum, fechaFinal];

      if (actualizarPrecioVenta && parseFloat(nuevoPrecioVenta) > 0) {
        sqlUpdate += `, precioVenta = ? `;
        paramsUpdate.push(parseFloat(nuevoPrecioVenta));
      }

      sqlUpdate += ` WHERE id = ?`;
      paramsUpdate.push(id);

      db.run(sqlUpdate, paramsUpdate, function (errUp) {
        if (errUp) return res.status(500).json({ error: errUp.message });
        res.json({ mensaje: 'Compra e historial registrados con éxito' });
      });
    }
  );
});

app.get('/api/promociones', (req, res) => {
  db.all('SELECT * FROM promociones ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/promociones', (req, res) => {
  const { nombre, tipo, valor } = req.body;
  db.run('INSERT INTO promociones (nombre, tipo, valor) VALUES (?, ?, ?)', [nombre, tipo, valor || 0], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, nombre, tipo, valor });
  });
});

app.delete('/api/promociones/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM promociones WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Promoción eliminada correctamente' });
  });
});

app.post('/api/movimientos-caja', (req, res) => {
  const { tipo, monto, motivo, cajero } = req.body;
  if (!tipo || !monto || !motivo) return res.status(400).json({ error: 'Faltan campos obligatorios.' });

  const sql = `INSERT INTO movimientos_caja (tipo, monto, motivo, cajero, fecha_hora) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [tipo, parseFloat(monto) || 0, motivo.trim(), cajero || 'Turno 1', getFechaHoraLocal()], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Movimiento registrado correctamente', id: this.lastID });
  });
});

app.get('/api/movimientos-caja', (req, res) => {
  db.all('SELECT * FROM movimientos_caja ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/corte-caja/balance-actual', (req, res) => {
  db.get('SELECT fecha_hora FROM cortes_caja ORDER BY id DESC LIMIT 1', [], (errUltimo, rowUltimo) => {
    if (errUltimo) return res.status(500).json({ error: errUltimo.message });

    const fechaHoy = getFechaLocal();
    
    let filtroFechaVentas = "estado != 'cancelada'";
    let filtroFechaMovs = "1=1";
    let parametros = [];

    if (rowUltimo && rowUltimo.fecha_hora) {
      filtroFechaVentas += " AND fecha_hora > ?";
      filtroFechaMovs += " AND fecha_hora > ?";
      parametros.push(rowUltimo.fecha_hora);
    } else {
      filtroFechaVentas += " AND substr(fecha_hora, 1, 10) = ?";
      filtroFechaMovs += " AND substr(fecha_hora, 1, 10) = ?";
      parametros.push(fechaHoy);
    }

    const sqlVentas = `
      SELECT 
        COALESCE(SUM(CASE WHEN metodo_pago IN ('efectivo', 'mixto') THEN monto_efectivo ELSE 0 END), 0) as ventasEfectivo,
        COALESCE(SUM(CASE WHEN metodo_pago IN ('tarjeta', 'mixto') THEN monto_tarjeta ELSE 0 END), 0) as ventasTarjeta,
        COALESCE(SUM(CASE WHEN metodo_pago IN ('vales', 'mixto') THEN monto_vales ELSE 0 END), 0) as ventasVales,
        COALESCE(SUM(CASE WHEN metodo_pago IN ('codi', 'mixto') THEN monto_codi ELSE 0 END), 0) as ventasCodi,
        COALESCE(SUM(total), 0) as totalVentas,
        COUNT(*) as ticketsTotal
      FROM ventas
      WHERE ${filtroFechaVentas}
    `;

    const sqlMovs = `
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE 0 END), 0) as totalEntradas,
        COALESCE(SUM(CASE WHEN tipo = 'salida' THEN monto ELSE 0 END), 0) as totalSalidas
      FROM movimientos_caja
      WHERE ${filtroFechaMovs}
    `;

    db.get(sqlVentas, parametros, (errV, rowV) => {
      if (errV) return res.status(500).json({ error: errV.message });
      db.get(sqlMovs, parametros, (errM, rowM) => {
        if (errM) return res.status(500).json({ error: errM.message });

        const ventasEfectivo = rowV.ventasEfectivo || 0;
        const ventasTarjeta = rowV.ventasTarjeta || 0;
        const ventasVales = rowV.ventasVales || 0;
        const ventasCodi = rowV.ventasCodi || 0;
        const totalEntradas = rowM.totalEntradas || 0;
        const totalSalidas = rowM.totalSalidas || 0;
        
        const saldoEsperado = ventasEfectivo + totalEntradas - totalSalidas;

        res.json({
          ventasEfectivo,
          ventasTarjeta,
          ventasVales,
          ventasCodi,
          totalVentas: rowV.totalVentas || 0,
          ticketsTotal: rowV.ticketsTotal || 0,
          totalEntradas,
          totalSalidas,
          saldoEsperado
        });
      });
    });
  });
});

app.post('/api/cierre-global', (req, res) => {
  const { caja_inicial, billetes, morralla, total_fisico, ventas_dia, ganancia_estimada, fecha_hora } = req.body;
  const folio = `CIERRE-${Date.now().toString().slice(-6)}`;
  const fechaHoraActual = fecha_hora || getFechaHoraLocal();

  const sql = `
    INSERT INTO cierres_globales (
      folio, fecha_hora, caja_inicial, billetes, morralla, total_fisico, ventas_dia, ganancia_estimada
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [folio, fechaHoraActual, caja_inicial, billetes, morralla, total_fisico, ventas_dia, ganancia_estimada], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Cierre Global registrado correctamente', id: this.lastID, folio });
  });
});

// Validar si hay un día anterior con ventas sin Cierre Z
app.get('/api/cierre-global/pendiente', (req, res) => {
  const fechaHoy = getFechaLocal();

  // Buscar el día más reciente con ventas anteriores a hoy
  const sqlUltimoDiaVentas = `
    SELECT substr(fecha_hora, 1, 10) as fecha_venta
    FROM ventas
    WHERE substr(fecha_hora, 1, 10) < ? AND estado != 'cancelada'
    ORDER BY fecha_hora DESC
    LIMIT 1
  `;

  db.get(sqlUltimoDiaVentas, [fechaHoy], (errV, rowVenta) => {
    if (errV) return res.status(500).json({ error: errV.message });
    if (!rowVenta || !rowVenta.fecha_venta) {
      return res.json({ tienePendiente: false });
    }

    const fechaPendiente = rowVenta.fecha_venta;

    // Verificar si ese día ya cuenta con un Cierre Z registrado
    const sqlCierreExiste = `
      SELECT id FROM cierres_globales
      WHERE substr(fecha_hora, 1, 10) = ?
      LIMIT 1
    `;

    db.get(sqlCierreExiste, [fechaPendiente], (errC, rowCierre) => {
      if (errC) return res.status(500).json({ error: errC.message });
      if (rowCierre) {
        return res.json({ tienePendiente: false });
      }

      // Si no hay cierre registrado para ese día, se calculan las métricas de esa jornada
      const sqlTotalesDia = `
        SELECT 
          COALESCE(SUM(total), 0) as ventasDia,
          COALESCE(SUM(CASE WHEN metodo_pago IN ('efectivo', 'mixto') THEN monto_efectivo ELSE 0 END), 0) as efectivoEsperado,
          COUNT(*) as totalTickets
        FROM ventas
        WHERE substr(fecha_hora, 1, 10) = ? AND estado != 'cancelada'
      `;

      db.get(sqlTotalesDia, [fechaPendiente], (errT, totales) => {
        if (errT) return res.status(500).json({ error: errT.message });

        res.json({
          tienePendiente: true,
          fechaPendiente,
          ventasDia: totales?.ventasDia || 0,
          efectivoEsperado: totales?.efectivoEsperado || 0,
          totalTickets: totales?.totalTickets || 0,
          gananciaEstimada: (totales?.ventasDia || 0) * 0.53
        });
      });
    });
  });
});

app.get('/api/cierre-global', (req, res) => {
  db.all(`SELECT * FROM cierres_globales ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/corte-caja', (req, res) => {
  const {
    cajero,
    ventasEfectivo,
    ventasTarjeta,
    ventasVales,
    ventasCodi,
    totalEntradas,
    totalSalidas,
    saldoEsperado,
    saldoDeclarado,
    diferencia,
    observaciones
  } = req.body;

  const folio = `CORTE-${Date.now().toString().slice(-6)}`;
  const fechaHoraActual = getFechaHoraLocal(); 
  const sql = `
    INSERT INTO cortes_caja (
      folio, fecha_hora, cajero, total_ventas_efectivo, total_ventas_tarjeta, total_ventas_vales, total_ventas_codi,
      total_entradas, total_salidas, saldo_esperado, saldo_declarado,
      diferencia, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      folio,
      fechaHoraActual,
      cajero || 'Turno 1',
      ventasEfectivo || 0,
      ventasTarjeta || 0,
      ventasVales || 0,
      ventasCodi || 0,
      totalEntradas || 0,
      totalSalidas || 0,
      saldoEsperado || 0,
      saldoDeclarado || 0,
      diferencia || 0,
      observaciones || ''
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Corte de turno registrado correctamente', id: this.lastID, folio });
    }
  );
});

// PROCESAMIENTO DE VENTAS CON DEDUCCIÓN DE INSUMOS
app.post('/api/ventas', (req, res) => {
  const {
    folio,
    total,
    metodo_pago,
    monto_efectivo,
    monto_tarjeta,
    monto_vales,
    monto_codi,
    cajero,
    items,
    cliente_id,
    puntos_ganados,
    puntos_canjeados,
    fecha_hora
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No se puede procesar una venta sin artículos.' });
  }

  const demandaPorProducto = {};

  items.forEach((item) => {
    const cant = parseFloat(item.cantidad) || 0;

    if (!item.esServicio && !item.noInventariado && item.id > 0 && !item.esKit) {
      const pzsFactor = item.esVentaPaquete ? (parseFloat(item.piezasPorPaquete) || 1) : 1;
      const piezasReales = cant * pzsFactor;
      demandaPorProducto[item.id] = (demandaPorProducto[item.id] || 0) + piezasReales;
    }

    if (item.esServicio && item.insumo_producto_id && parseFloat(item.insumo_cantidad) > 0) {
      const insumoId = parseInt(item.insumo_producto_id, 10);
      const totalInsumo = cant * parseFloat(item.insumo_cantidad);
      demandaPorProducto[insumoId] = (demandaPorProducto[insumoId] || 0) + totalInsumo;
    }
  });

  const idsFisicos = Object.keys(demandaPorProducto);

  const procesarGuardado = () => {
    const fechaHoraFinal = fecha_hora || getFechaHoraLocal();

    db.run(
      `INSERT INTO ventas (folio, fecha_hora, total, metodo_pago, monto_efectivo, monto_tarjeta, monto_vales, monto_codi, cajero, cliente_id, puntos_ganados, puntos_canjeados, estado) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completada')`,
      [
        folio,
        fechaHoraFinal,
        total,
        metodo_pago,
        monto_efectivo || 0,
        monto_tarjeta || 0,
        monto_vales || 0,
        monto_codi || 0,
        cajero || 'Turno 1',
        cliente_id || null,
        puntos_ganados || 0,
        puntos_canjeados || 0
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const ventaId = this.lastID;

        const stmtDetalle = db.prepare(
          `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_aplicado, descuento_porcentaje, comentario, piezas_por_paquete, insumo_descontado_id, insumo_descontado_cant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const stmtStock = db.prepare(`UPDATE productos SET invActual = invActual - ? WHERE id = ?`);

        items.forEach((item) => {
          const cantItem = parseFloat(item.cantidad) || 0;
          const factorEmpaque = item.esVentaPaquete ? (parseFloat(item.piezasPorPaquete) || 1) : 1;

          if (item.esKit && item.kit_id) {
            stmtDetalle.run(ventaId, item.id || 0, cantItem, item.precioUnitario, item.descuento || 0, `Kit: ${item.nombre}`, 1, null, 0);

            db.all(`SELECT producto_id, cantidad FROM kit_detalles WHERE kit_id = ?`, [item.kit_id], (errK, componentes) => {
              if (!errK && componentes) {
                componentes.forEach((c) => {
                  const totalADescontar = (parseFloat(c.cantidad) || 1) * cantItem;
                  stmtStock.run(totalADescontar, c.producto_id);
                });
              }
            });
          } else if (item.esServicio) {
            const tieneInsumo = Boolean(item.insumo_producto_id && parseFloat(item.insumo_cantidad) > 0);
            const insumoId = tieneInsumo ? parseInt(item.insumo_producto_id, 10) : null;
            const cantInsumoTotal = tieneInsumo ? (cantItem * parseFloat(item.insumo_cantidad)) : 0;

            stmtDetalle.run(ventaId, item.id || 0, cantItem, item.precioUnitario, item.descuento || 0, item.comentario || '', 1, insumoId, cantInsumoTotal);

            if (tieneInsumo) {
              stmtStock.run(cantInsumoTotal, insumoId);
            }
          } else {
            const notaItem = item.esVentaPaquete ? `[PAQUETE ${item.piezasPorPaquete} pzs] ${item.comentario || ''}`.trim() : (item.comentario || '');
            stmtDetalle.run(ventaId, item.id || 0, cantItem, item.precioUnitario, item.descuento || 0, notaItem, factorEmpaque, null, 0);

            if (!item.noInventariado && item.id > 0) {
              const totalPiezasADescontar = cantItem * factorEmpaque;
              stmtStock.run(totalPiezasADescontar, item.id);
            }
          }
        });

        stmtDetalle.finalize();
        stmtStock.finalize();

        if (cliente_id) {
          const ganados = parseInt(puntos_ganados, 10) || 0;
          const canjeados = parseInt(puntos_canjeados, 10) || 0;
          const delta = ganados - canjeados;

          db.run(
            `UPDATE clientes SET puntos_acumulados = MAX(0, puntos_acumulados + ?) WHERE id = ?`,
            [delta, cliente_id]
          );
        }

        res.json({ mensaje: 'Venta registrada con éxito', ventaId });
      }
    );
  };

  if (idsFisicos.length > 0) {
    const placeholders = idsFisicos.map(() => '?').join(',');
    db.all(`SELECT id, nombre, invActual FROM productos WHERE id IN (${placeholders})`, idsFisicos, (errStock, prodsBD) => {
      if (errStock) return res.status(500).json({ error: errStock.message });

      for (const prodBD of prodsBD) {
        const requeridas = demandaPorProducto[prodBD.id] || 0;
        const disponible = parseFloat(prodBD.invActual) || 0;

        if (disponible < requeridas) {
          return res.status(400).json({
            error: `Existencias insuficientes para "${prodBD.nombre}". Requeridas: ${requeridas} pz(s), disponibles: ${disponible} pz(s).`
          });
        }
      }
      procesarGuardado();
    });
  } else {
    procesarGuardado();
  }
});

// CANCELACIÓN DE VENTA CON RESTITUCIÓN DE INSUMOS
app.post('/api/ventas/:id/cancelar', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM ventas WHERE id = ?`, [id], (err, venta) => {
    if (err || !venta) return res.status(404).json({ error: 'Venta no encontrada.' });
    if (venta.estado === 'cancelada') return res.status(400).json({ error: 'Esta venta ya se encuentra cancelada.' });

    db.all(`SELECT * FROM detalle_ventas WHERE venta_id = ?`, [id], (errDet, detalles) => {
      if (errDet) return res.status(500).json({ error: errDet.message });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`UPDATE ventas SET estado = 'cancelada' WHERE id = ?`, [id]);

        const stmtStock = db.prepare(`UPDATE productos SET invActual = invActual + ? WHERE id = ?`);

        detalles.forEach((det) => {
          if (det.insumo_descontado_id && parseFloat(det.insumo_descontado_cant) > 0) {
            stmtStock.run(parseFloat(det.insumo_descontado_cant), det.insumo_descontado_id);
          } else if (det.producto_id && det.producto_id > 0) {
            const cant = parseFloat(det.cantidad) || 0;
            const factor = parseFloat(det.piezas_por_paquete) || 1;
            stmtStock.run(cant * factor, det.producto_id);
          }
        });
        stmtStock.finalize();

        if (venta.cliente_id) {
          const ganados = parseInt(venta.puntos_ganados, 10) || 0;
          const canjeados = parseInt(venta.puntos_canjeados, 10) || 0;
          const delta = canjeados - ganados;

          db.run(
            `UPDATE clientes SET puntos_acumulados = MAX(0, puntos_acumulados + ?) WHERE id = ?`,
            [delta, cliente_id]
          );
        }

        db.run('COMMIT', (errCommit) => {
          if (errCommit) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Error al procesar la cancelación.' });
          }
          res.json({ mensaje: 'Venta cancelada exitosamente y stock devuelto.' });
        });
      });
    });
  });
});

app.post('/api/kits', (req, res) => {
  const { codigo, nombre, precio, items } = req.body;

  db.run(`INSERT INTO kits (codigo, nombre, precio) VALUES (?, ?, ?)`, [codigo, nombre, precio], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const kitId = this.lastID;

    const stmt = db.prepare(`INSERT INTO kit_detalles (kit_id, producto_id, cantidad) VALUES (?, ?, ?)`);
    items.forEach((item) => {
      stmt.run(kitId, item.producto_id, parseFloat(item.cantidad) || 1);
    });
    stmt.finalize();

    res.json({ mensaje: 'Kit creado exitosamente', id: kitId });
  });
});

app.put('/api/kits/:id', (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, precio, items } = req.body;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run(
      `UPDATE kits SET codigo = ?, nombre = ?, precio = ? WHERE id = ?`,
      [codigo, nombre, precio, id]
    );

    db.run(`DELETE FROM kit_detalles WHERE kit_id = ?`, [id]);

    const stmt = db.prepare(`INSERT INTO kit_detalles (kit_id, producto_id, cantidad) VALUES (?, ?, ?)`);
    items.forEach((item) => {
      stmt.run(id, item.producto_id, parseFloat(item.cantidad) || 1);
    });
    stmt.finalize();

    db.run('COMMIT', (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Error al actualizar el kit.' });
      }
      res.json({ mensaje: 'Kit actualizado exitosamente' });
    });
  });
});

app.get('/api/kits', (req, res) => {
  db.all(`SELECT * FROM kits ORDER BY id DESC`, [], (err, rowsKits) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rowsKits.length === 0) return res.json([]);

    const sqlDetalles = `
      SELECT kd.*, p.nombre, p.codigoBarras, p.precioVenta, p.invActual
      FROM kit_detalles kd
      JOIN productos p ON kd.producto_id = p.id
    `;

    db.all(sqlDetalles, [], (errDet, rowsDet) => {
      if (errDet) return res.status(500).json({ error: errDet.message });
      const kitsConComponentes = rowsKits.map((k) => ({
        ...k,
        items: rowsDet.filter((d) => d.kit_id === k.id)
      }));
      res.json(kitsConComponentes);
    });
  });
});

app.delete('/api/kits/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM kit_detalles WHERE kit_id = ?', [id], () => {
    db.run('DELETE FROM kits WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Kit eliminado correctamente' });
    });
  });
});

app.get('/api/departamentos', (req, res) => {
  db.all('SELECT * FROM departamentos ORDER BY nombre ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/departamentos', (req, res) => {
  const { nombre } = req.body;
  db.run('INSERT INTO departamentos (nombre) VALUES (?)', [nombre], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, nombre });
  });
});

app.put('/api/departamentos/:id', (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  db.run('UPDATE departamentos SET nombre = ? WHERE id = ?', [nombre.trim(), id], function (err) {
    if (err) return res.status(400).json({ error: 'El departamento ya existe o hay un error.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Departamento no encontrado.' });
    res.json({ mensaje: 'Departamento actualizado correctamente.' });
  });
});

app.delete('/api/departamentos/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT COUNT(*) as count FROM productos WHERE departamento_id = ?', [id], (err, row) => {
    if (row && row.count > 0) {
      return res.status(400).json({ error: `No se puede eliminar: hay ${row.count} producto(s) asignados a este departamento.` });
    }
    db.run('DELETE FROM departamentos WHERE id = ?', [id], function (errDel) {
      if (errDel) return res.status(500).json({ error: 'Error al eliminar departamento.' });
      res.json({ mensaje: 'Departamento eliminado correctamente.' });
    });
  });
});

app.get('/api/categorias', (req, res) => {
  db.all('SELECT * FROM categorias ORDER BY nombre ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/categorias', (req, res) => {
  const { nombre } = req.body;
  db.run('INSERT INTO categorias (nombre) VALUES (?)', [nombre], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, nombre });
  });
});

app.put('/api/categorias/:id', (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  db.run('UPDATE categorias SET nombre = ? WHERE id = ?', [nombre.trim(), id], function (err) {
    if (err) return res.status(400).json({ error: 'La categoría ya existe o hay un error.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada.' });
    res.json({ mensaje: 'Categoría actualizada correctamente.' });
  });
});

app.delete('/api/categorias/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT COUNT(*) as count FROM productos WHERE categoria_id = ?', [id], (err, row) => {
    if (row && row.count > 0) {
      return res.status(400).json({ error: `No se puede eliminar: hay ${row.count} producto(s) asignados a esta categoría.` });
    }
    db.run('DELETE FROM categorias WHERE id = ?', [id], function (errDel) {
      if (errDel) return res.status(500).json({ error: 'Error al eliminar categoría.' });
      res.json({ mensaje: 'Categoría eliminada correctamente.' });
    });
  });
});

app.get('/api/proveedores', (req, res) => {
  db.all('SELECT * FROM proveedores ORDER BY nombre ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/proveedores', (req, res) => {
  const { nombre, telefono, contacto } = req.body;
  db.run('INSERT INTO proveedores (nombre, telefono, contacto) VALUES (?, ?, ?)', [nombre, telefono, contacto], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, nombre, telefono, contacto });
  });
});

app.put('/api/proveedores/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, contacto } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  db.run('UPDATE proveedores SET nombre = ?, telefono = ?, contacto = ? WHERE id = ?', [nombre.trim(), telefono || '', contacto || '', id], function (err) {
    if (err) return res.status(400).json({ error: 'El proveedor ya existe o hay un error.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    res.json({ mensaje: 'Proveedor actualizado correctamente.' });
  });
});

app.delete('/api/proveedores/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT COUNT(*) as count FROM productos WHERE proveedor_id = ?', [id], (err, row) => {
    if (row && row.count > 0) {
      return res.status(400).json({ error: `No se puede eliminar: hay ${row.count} producto(s) asignados a este proveedor.` });
    }
    db.run('DELETE FROM proveedores WHERE id = ?', [id], function (errDel) {
      if (errDel) return res.status(500).json({ error: 'Error al eliminar proveedor.' });
      res.json({ mensaje: 'Proveedor eliminado correctamente.' });
    });
  });
});

app.get('/api/clientes/buscar', (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  if (!q) return res.json([]);

  const sql = `SELECT * FROM clientes WHERE telefono LIKE ? OR nombre LIKE ? LIMIT 6`;
  db.all(sql, [`%${q}%`, `%${q}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/clientes', (req, res) => {
  const sql = `
    SELECT 
      c.*,
      COUNT(v.id) AS total_compras,
      COALESCE(SUM(CASE WHEN v.estado != 'cancelada' THEN v.total ELSE 0 END), 0) AS total_gastado
    FROM clientes c
    LEFT JOIN ventas v ON c.id = v.cliente_id
    GROUP BY c.id
    ORDER BY c.puntos_acumulados DESC, c.id DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/clientes', (req, res) => {
  const { nombre, telefono } = req.body;
  if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios.' });

  const sql = `INSERT INTO clientes (nombre, telefono, puntos_acumulados) VALUES (?, ?, 0)`;
  db.run(sql, [nombre.trim(), telefono.trim()], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Ya existe un cliente con ese teléfono.' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, nombre, telefono, puntos_acumulados: 0 });
  });
});

app.put('/api/clientes/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, puntos_acumulados } = req.body;
  if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios.' });

  const sql = `UPDATE clientes SET nombre = ?, telefono = ?, puntos_acumulados = ? WHERE id = ?`;
  db.run(sql, [nombre.trim(), telefono.trim(), parseInt(puntos_acumulados, 10) || 0, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ mensaje: 'Cliente actualizado correctamente.' });
  });
});

app.delete('/api/clientes/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM clientes WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ mensaje: 'Cliente eliminado correctamente.' });
  });
});

app.get('/api/clientes/:id/historial', (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT id, folio, fecha_hora, total, metodo_pago, puntos_ganados, puntos_canjeados, estado
    FROM ventas 
    WHERE cliente_id = ? 
    ORDER BY id DESC
  `;
  db.all(sql, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/configuracion/impresiones', (req, res) => {
  db.all('SELECT * FROM configuracion_impresiones', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const config = {};
    if (rows) rows.forEach((r) => { config[r.clave] = r.valor; });
    res.json({
      precio_bn: config.precio_bn !== undefined ? parseFloat(config.precio_bn) : 1.0,
      precio_color_leve: config.precio_color_leve !== undefined ? parseFloat(config.precio_color_leve) : 2.5,
      precio_color_completo: config.precio_color_completo !== undefined ? parseFloat(config.precio_color_completo) : 5.0,
      umbral_bn_max: config.umbral_bn_max !== undefined ? parseFloat(config.umbral_bn_max) : 1.0,
      umbral_leve_max: config.umbral_leve_max !== undefined ? parseFloat(config.umbral_leve_max) : 25.0,
      insumo_producto_id: config.insumo_producto_id ? parseInt(config.insumo_producto_id, 10) : null,
      insumo_cantidad: config.insumo_cantidad !== undefined ? parseFloat(config.insumo_cantidad) : 1
    });
  });
});

app.post('/api/configuracion/impresiones', (req, res) => {
  const { 
    precio_bn, precio_color_leve, precio_color_completo, 
    umbral_bn_max, umbral_leve_max,
    insumo_producto_id, insumo_cantidad 
  } = req.body;

  const sql = `
    INSERT INTO configuracion_impresiones (clave, valor)
    VALUES (?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `;

  db.serialize(() => {
    const stmt = db.prepare(sql);
    if (precio_bn !== undefined) stmt.run('precio_bn', String(precio_bn));
    if (precio_color_leve !== undefined) stmt.run('precio_color_leve', String(precio_color_leve));
    if (precio_color_completo !== undefined) stmt.run('precio_color_completo', String(precio_color_completo));
    if (umbral_bn_max !== undefined) stmt.run('umbral_bn_max', String(umbral_bn_max));
    if (umbral_leve_max !== undefined) stmt.run('umbral_leve_max', String(umbral_leve_max));
    if (insumo_producto_id !== undefined) stmt.run('insumo_producto_id', insumo_producto_id ? String(insumo_producto_id) : '');
    if (insumo_cantidad !== undefined) stmt.run('insumo_cantidad', String(insumo_cantidad));
    stmt.finalize();
    res.json({ mensaje: 'Configuración de impresiones e insumo actualizada correctamente.' });
  });
});

app.get('/api/configuracion/lealtad', (req, res) => {
  db.all('SELECT * FROM configuracion_lealtad', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const config = {};
    rows.forEach((r) => { config[r.clave] = r.valor; });
    res.json({
      valor_punto_pesos: parseFloat(config.valor_punto_pesos) || 1.0,
      minimo_puntos_canje: parseInt(config.minimo_puntos_canje, 10) || 0,
      porcentaje_max_descuento: parseInt(config.porcentaje_max_descuento, 10) || 100
    });
  });
});

app.post('/api/configuracion/lealtad', (req, res) => {
  const { valor_punto_pesos, minimo_puntos_canje, porcentaje_max_descuento } = req.body;
  const sql = `
    INSERT INTO configuracion_lealtad (clave, valor)
    VALUES (?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `;

  db.serialize(() => {
    const stmt = db.prepare(sql);
    if (valor_punto_pesos !== undefined) stmt.run('valor_punto_pesos', String(valor_punto_pesos));
    if (minimo_puntos_canje !== undefined) stmt.run('minimo_puntos_canje', String(minimo_puntos_canje));
    if (porcentaje_max_descuento !== undefined) stmt.run('porcentaje_max_descuento', String(porcentaje_max_descuento));
    stmt.finalize();
    res.json({ mensaje: 'Reglas de lealtad actualizadas correctamente.' });
  });
});

app.get('/api/empresa', (req, res) => {
  db.get('SELECT * FROM empresa_datos WHERE id = 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const datos = row || {};
    const autoTicket = !(datos.imprimir_ticket_auto === 0 || datos.imprimir_ticket_auto === '0' || datos.imprimir_ticket_auto === false);
    res.json({ ...datos, imprimir_ticket_auto: autoTicket });
  });
});

app.post('/api/empresa', (req, res) => {
  const { nombre, sucursal, direccion, telefono, mensaje_ticket, logo, imprimir_ticket_auto } = req.body;
  const autoTicket = (imprimir_ticket_auto === false || imprimir_ticket_auto === 0 || imprimir_ticket_auto === '0') ? 0 : 1;

  const sql = `
    INSERT INTO empresa_datos (id, nombre, sucursal, direccion, telefono, mensaje_ticket, logo, imprimir_ticket_auto)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      nombre = excluded.nombre,
      sucursal = excluded.sucursal,
      direccion = excluded.direccion,
      telefono = excluded.telefono,
      mensaje_ticket = excluded.mensaje_ticket,
      logo = CASE WHEN excluded.logo IS NOT NULL AND excluded.logo != '' THEN excluded.logo ELSE empresa_datos.logo END,
      imprimir_ticket_auto = excluded.imprimir_ticket_auto
  `;

  db.run(sql, [nombre || '', sucursal || '', direccion || '', telefono || '', mensaje_ticket || '', logo || null, autoTicket], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Datos de la empresa actualizados correctamente.' });
  });
});

app.get('/api/usuarios', (req, res) => {
  db.all('SELECT id, usuario, nombre, rol, activo, fecha_creacion, password FROM usuarios ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/usuarios', (req, res) => {
  const { usuario, nombre, password, rol } = req.body;
  if (!usuario || !password || !nombre) {
    return res.status(400).json({ error: 'Usuario, nombre y contraseña son requeridos.' });
  }

  const sql = `INSERT INTO usuarios (usuario, nombre, password, rol, activo) VALUES (?, ?, ?, ?, 1)`;
  db.run(sql, [usuario.trim().toLowerCase(), nombre.trim(), password.trim(), rol || 'cajero'], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'El usuario ya existe.' });
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, mensaje: 'Usuario registrado correctamente.' });
  });
});

app.put('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, password, rol, activo } = req.body;

  let sql = `UPDATE usuarios SET nombre = ?, rol = ?, activo = ?`;
  const params = [nombre.trim(), rol, activo ? 1 : 0];

  if (password && password.trim() !== '') {
    sql += `, password = ?`;
    params.push(password.trim());
  }

  sql += ` WHERE id = ?`;
  params.push(id);

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Usuario actualizado correctamente.' });
  });
});

app.delete('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  if (parseInt(id, 10) === 1) return res.status(400).json({ error: 'No es posible eliminar al Administrador principal.' });

  db.run('DELETE FROM usuarios WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Usuario eliminado exitosamente.' });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Ingresa tu usuario y contraseña.' });

  const sql = `SELECT id, usuario, nombre, rol, activo FROM usuarios WHERE usuario = ? AND password = ?`;
  db.get(sql, [usuario.trim().toLowerCase(), password.trim()], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    if (!row.activo) return res.status(403).json({ error: 'Cuenta desactivada.' });

    res.json({ id: row.id, usuario: row.usuario, nombre: row.nombre, rol: row.rol });
  });
});

app.get('/api/dashboard/resumen', (req, res) => {
  db.get('SELECT fecha_hora FROM cierres_globales ORDER BY id DESC LIMIT 1', [], (errUltimo, rowUltimo) => {
    if (errUltimo) return res.status(500).json({ error: errUltimo.message });

    const fechaHoy = getFechaLocal();
    
    const filtroDiaCompleto = "substr(fecha_hora, 1, 10) = ? AND estado != 'cancelada'";

    let filtroEfectivoTurno = "substr(fecha_hora, 1, 10) = ? AND estado != 'cancelada'";
    let filtroMovsTurno = "substr(fecha_hora, 1, 10) = ?";
    let paramsTurno = [fechaHoy];

    if (rowUltimo && rowUltimo.fecha_hora && rowUltimo.fecha_hora.startsWith(fechaHoy)) {
      filtroEfectivoTurno = "fecha_hora > ? AND estado != 'cancelada'";
      filtroMovsTurno = "fecha_hora > ?";
      paramsTurno = [rowUltimo.fecha_hora];
    }

    const sqlMetricasDia = `
      SELECT 
        COALESCE(SUM(total), 0) as totalVentas,
        COUNT(CASE WHEN estado != 'cancelada' THEN 1 END) as totalTickets,
        (SELECT COUNT(*) FROM ventas WHERE substr(fecha_hora, 1, 10) = ? AND estado = 'cancelada') as totalDevoluciones
      FROM ventas
      WHERE ${filtroDiaCompleto}
    `;

    db.get(sqlMetricasDia, [fechaHoy, fechaHoy], (errV, rowDia) => {
      if (errV) return res.status(500).json({ error: errV.message });

      const sqlEfectivoTurno = `
        SELECT 
          COALESCE(SUM(CASE WHEN metodo_pago IN ('efectivo', 'mixto') THEN monto_efectivo ELSE 0 END), 0) as totalEfectivoTurno
        FROM ventas
        WHERE ${filtroEfectivoTurno}
      `;

      db.get(sqlEfectivoTurno, paramsTurno, (errE, rowEf) => {
        if (errE) return res.status(500).json({ error: errE.message });

        const sqlMovs = `
          SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE 0 END), 0) as totalEntradas,
            COALESCE(SUM(CASE WHEN tipo = 'salida' THEN monto ELSE 0 END), 0) as totalSalidas
          FROM movimientos_caja
          WHERE ${filtroMovsTurno}
        `;

        db.get(sqlMovs, paramsTurno, (errMov, rowMovs) => {
          if (errMov) return res.status(500).json({ error: errMov.message });

          db.all(
            `SELECT * FROM productos WHERE (invActual <= invMinimo OR invActual <= 5) AND esServicio = 0 AND noInventariado = 0 LIMIT 5`,
            [],
            (err2, rowsProd) => {
              if (err2) return res.status(500).json({ error: err2.message });

              db.all(`
                SELECT d.nombre, COUNT(p.id) as totalProductos 
                FROM departamentos d 
                LEFT JOIN productos p ON d.id = p.departamento_id 
                GROUP BY d.id 
                ORDER BY totalProductos DESC
              `, [], (errDept, rowsDept) => {
                if (errDept) return res.status(500).json({ error: errDept.message });

                const ventasDia = rowDia?.totalVentas || 0;
                const totalTickets = rowDia?.totalTickets || 0;
                const devoluciones = rowDia?.totalDevoluciones || 0;

                const efectivoTurno = rowEf?.totalEfectivoTurno || 0;
                const totalEntradas = rowMovs?.totalEntradas || 0;
                const totalSalidas = rowMovs?.totalSalidas || 0;
                const dineroCaja = efectivoTurno + totalEntradas - totalSalidas;

                res.json({
                  ventasDia,
                  ticketsDia: totalTickets,
                  devoluciones,
                  totalEntradas,
                  totalSalidas,
                  dineroCaja,
                  inventarioBajo: rowsProd,
                  departamentosResumen: rowsDept || []
                });
              });
            }
          );
        });
      });
    });
  });
});

app.get('/api/reportes/ventas', (req, res) => {
  const sqlVentas = `
    SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
    FROM ventas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    ORDER BY v.id DESC
  `;

  db.all(sqlVentas, [], (err, ventas) => {
    if (err) return res.status(500).json({ error: err.message });
    if (ventas.length === 0) return res.json([]);

    const sqlDetalles = `
      SELECT dv.*, p.nombre, p.codigoBarras 
      FROM detalle_ventas dv
      LEFT JOIN productos p ON dv.producto_id = p.id
    `;

    db.all(sqlDetalles, [], (errDet, detalles) => {
      if (errDet) return res.status(500).json({ error: errDet.message });
      const ventasConDetalle = ventas.map((v) => ({
        ...v,
        items: detalles.filter((d) => d.venta_id === v.id)
      }));
      res.json(ventasConDetalle);
    });
  });
});

app.get('/api/reportes/cortes', (req, res) => {
  db.all(`SELECT * FROM cortes_caja ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/reportes/resurtido', (req, res) => {
  const proveedorId = req.query.proveedor_id;

  let sqlProductos = `
    SELECT 
      p.id, p.codigoBarras, p.nombre, p.locacion, p.costo, p.costoPaquete, p.piezasPorPaquete,
      p.invActual, p.invMinimo, COALESCE(pr.nombre, 'Sin Proveedor Asignado') AS proveedor_nombre,
      p.proveedor_id, 0 AS esManual, '' AS nota_manual
    FROM productos p
    LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
    WHERE (p.invActual <= p.invMinimo OR p.invActual <= 5) AND p.esServicio = 0 AND p.noInventariado = 0
  `;
  const paramsProd = [];

  if (proveedorId && proveedorId !== 'todos') {
    if (proveedorId === 'sin_proveedor') {
      sqlProductos += ` AND p.proveedor_id IS NULL`;
    } else {
      sqlProductos += ` AND p.proveedor_id = ?`;
      paramsProd.push(proveedorId);
    }
  }

  let sqlManuales = `
    SELECT 
      cm.id, 'ENCARGO' AS codigoBarras, cm.nombre, 'Encargo / Novedad' AS locacion,
      cm.costo_estimado AS costo, 0 AS costoPaquete, 1 AS piezasPorPaquete, 0 AS invActual,
      cm.cantidad AS invMinimo, COALESCE(pr.nombre, cm.proveedor_nombre, 'Sin Proveedor Asignado') AS proveedor_nombre,
      cm.proveedor_id, 1 AS esManual, cm.nota AS nota_manual
    FROM compras_manuales cm
    LEFT JOIN proveedores pr ON cm.proveedor_id = pr.id
  `;
  const paramsManual = [];

  if (proveedorId && proveedorId !== 'todos') {
    if (proveedorId === 'sin_proveedor') {
      sqlManuales += ` AND cm.proveedor_id IS NULL`;
    } else {
      sqlManuales += ` AND cm.proveedor_id = ?`;
      paramsManual.push(proveedorId);
    }
  }

  db.all(sqlProductos, paramsProd, (errP, rowsProd) => {
    if (errP) return res.status(500).json({ error: errP.message });
    db.all(sqlManuales, paramsManual, (errM, rowsManual) => {
      if (errM) return res.status(500).json({ error: errM.message });
      const combinado = [...(rowsProd || []), ...(rowsManual || [])];
      combinado.sort((a, b) => (a.proveedor_nombre || '').localeCompare(b.proveedor_nombre || '') || (a.nombre || '').localeCompare(b.nombre || ''));
      res.json(combinado);
    });
  });
});

app.post('/api/reportes/resurtido/manual', (req, res) => {
  const { nombre, cantidad, proveedor_id, proveedor_nombre, costo_estimado, nota } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Escribe el nombre del producto.' });

  const sql = `INSERT INTO compras_manuales (nombre, cantidad, proveedor_id, proveedor_nombre, costo_estimado, nota) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(
    sql,
    [nombre.trim(), parseFloat(cantidad) || 1, proveedor_id ? parseInt(proveedor_id, 10) : null, proveedor_nombre || null, parseFloat(costo_estimado) || 0, nota ? nota.trim() : ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Encargo registrado exitosamente.' });
    }
  );
});

app.delete('/api/reportes/resurtido/manual/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM compras_manuales WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Encargo eliminado de la lista.' });
  });
});

app.post('/api/productos/importar-masivo', (req, res) => {
  const { productos } = req.body;
  if (!Array.isArray(productos) || productos.length === 0) return res.status(400).json({ error: 'No se recibieron productos.' });

  const sql = `
    INSERT INTO productos (
      codigoBarras, nombre, locacion, claveUnidad, atributoColor,
      departamento_id, categoria_id, proveedor_id, imagen,
      costoPaquete, piezasPorPaquete, precioVentaPaquete, notaPaquete,
      costo, precioVenta, ganancia,
      invMinimo, invActual, puntosLealtad,
      esServicio, esKit, aGranel, noInventariado, fechaCompra
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(codigoBarras) DO UPDATE SET
      nombre = excluded.nombre,
      costo = excluded.costo,
      precioVenta = excluded.precioVenta,
      invActual = invActual + excluded.invActual,
      locacion = CASE WHEN excluded.locacion != '' THEN excluded.locacion ELSE productos.locacion END,
      fechaCompra = excluded.fechaCompra
  `;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare(sql);
    let errores = 0;

    for (const p of productos) {
      if (!p.codigoBarras || !p.nombre) continue;
      const params = [
        p.codigoBarras, p.nombre, p.locacion || '', p.claveUnidad || 'PZA', p.atributoColor || '',
        p.departamento_id || null, p.categoria_id || null, p.proveedor_id || null, p.imagen || null,
        p.costoPaquete || 0, p.piezasPorPaquete || 1, p.precioVentaPaquete || 0, p.notaPaquete || '',
        p.costo || 0, p.precioVenta || 0, p.ganancia || 0, p.invMinimo || 0, parseFloat(p.invActual) || 0,
        p.puntosLealtad || 0, p.esServicio ? 1 : 0, p.esKit ? 1 : 0, p.aGranel ? 1 : 0, p.noInventariado ? 1 : 0,
        p.fechaCompra || getFechaLocal()
      ];
      stmt.run(params, (err) => { if (err) errores++; });
    }
    stmt.finalize();

    db.run('COMMIT', (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Error al procesar la importación.' });
      }
      res.json({ mensaje: 'Importación completada exitosamente.', errores });
    });
  });
});

// --- GESTIÓN DE BASE DE DATOS Y RESPALDOS (CORREGIDO) ---

app.get('/api/backup/estado', (req, res) => {
  try {
    const stats = fs.existsSync(RUTA_DB_ACTUAL) ? fs.statSync(RUTA_DB_ACTUAL) : null;
    const pesoMB = stats ? (stats.size / (1024 * 1024)).toFixed(2) : '0';

    db.get(`
      SELECT 
        (SELECT COUNT(*) FROM productos) as totalProductos,
        (SELECT COUNT(*) FROM ventas) as totalVentas,
        (SELECT COUNT(*) FROM clientes) as totalClientes,
        (SELECT COUNT(*) FROM detalle_ventas) as totalRenglonesVenta
    `, [], (err, conteos) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all('SELECT * FROM configuracion_respaldos', [], (errC, rowsC) => {
        const config = {};
        if (rowsC) rowsC.forEach(r => config[r.clave] = r.valor);

        let archivosBackups = [];
        if (fs.existsSync(RUTA_BACKUPS)) {
          archivosBackups = fs.readdirSync(RUTA_BACKUPS)
            .filter(f => f.endsWith('.db'))
            .map(f => {
              const fStats = fs.statSync(path.join(RUTA_BACKUPS, f));
              return {
                archivo: f,
                pesoKB: (fStats.size / 1024).toFixed(1),
                fecha: fStats.mtime
              };
            })
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }

        res.json({
          pesoMB,
          conteo: conteos || {},
          frecuencia: config.frecuencia_respaldo || 'diario',
          ultimoRespaldo: config.ultimo_respaldo || null,
          respaldosLocales: archivosBackups.slice(0, 10)
        });
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Descarga directa sin riesgo de bloqueo por procesos de Windows
app.get('/api/backup/descargar', (req, res) => {
  if (!fs.existsSync(RUTA_DB_ACTUAL)) {
    return res.status(404).send('Archivo de base de datos no encontrado.');
  }

  const fechaStr = getFechaLocal();
  const nombreDescarga = `respaldo_asadel_${fechaStr}.db`;
  const archivoTemp = path.join(os.tmpdir(), `temp_${Date.now()}_${nombreDescarga}`);
  const archivoTempSql = archivoTemp.replace(/'/g, "''");

  db.run(`VACUUM INTO '${archivoTempSql}'`, [], (err) => {
    const archivoAEnviar = err ? RUTA_DB_ACTUAL : archivoTemp;

    res.download(archivoAEnviar, nombreDescarga, (errDownload) => {
      if (fs.existsSync(archivoTemp)) {
        try { fs.unlinkSync(archivoTemp); } catch (e) {}
      }
      if (!errDownload) {
        db.run(`UPDATE configuracion_respaldos SET valor = ? WHERE clave = 'ultimo_respaldo'`, [getFechaHoraLocal()]);
      }
    });
  });
});

app.post('/api/backup/configuracion', (req, res) => {
  const { frecuencia } = req.body;
  db.run(
    `INSERT INTO configuracion_respaldos (clave, valor) VALUES ('frecuencia_respaldo', ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    [frecuencia],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Frecuencia de respaldo actualizada.' });
    }
  );
});

app.post('/api/backup/generar-manual', (req, res) => {
  ejecutarRespaldoEnDisco((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo generar la copia en disco.' });
    res.json({ mensaje: 'Copia de seguridad guardada exitosamente en el equipo.' });
  });
});

app.post('/api/backup/optimizar', (req, res) => {
  db.run('VACUUM', [], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Base de datos optimizada y compactada correctamente.' });
  });
});

app.post('/api/backup/borrar-db', (req, res) => {
  const { password } = req.body;
  db.get(`SELECT id FROM usuarios WHERE rol = 'admin' AND password = ?`, [password], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Contraseña de administrador incorrecta.' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const tablas = [
        'detalle_ventas', 'ventas', 'movimientos_caja', 'cortes_caja',
        'cierres_globales', 'kit_detalles', 'kits', 'historial_costos',
        'compras_manuales', 'clientes', 'productos', 'categorias',
        'departamentos', 'proveedores', 'promociones', 'usuarios', 'empresa_datos'
      ];

      tablas.forEach((t) => {
        db.run(`DELETE FROM ${t}`);
      });

      db.run(`DELETE FROM sqlite_sequence`);

      db.run(`
        INSERT INTO empresa_datos (id, nombre, sucursal, direccion, telefono, mensaje_ticket, imprimir_ticket_auto)
        VALUES (1, 'PAPELERÍA ASADEL', 'Sucursal Centro', 'Av. Principal #123, Col. Centro', '55 1234 5678', '¡Gracias por su compra y preferencia!', 1)
      `);

      db.run(`
        INSERT INTO usuarios (usuario, nombre, password, rol, activo)
        VALUES ('admin', 'Administrador Principal', 'admin123', 'admin', 1)
      `);

      db.run(`
        INSERT INTO usuarios (usuario, nombre, password, rol, activo)
        VALUES ('turno1', 'Cajero Turno 1', 'caja123', 'cajero', 1)
      `);

      db.run('COMMIT', (errCommit) => {
        if (errCommit) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Error al restablecer las tablas.' });
        }
        res.json({ mensaje: 'Base de datos restablecida de fábrica exitosamente.' });
      });
    });
  });
});

// Restauración sin bloqueos de archivo ni fugas temporales en Windows
app.post('/api/backup/restaurar', (req, res) => {
  const { archivoBase64 } = req.body;
  if (!archivoBase64) return res.status(400).json({ error: 'No se recibió el archivo de respaldo.' });

  try {
    const base64Limpio = archivoBase64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Limpio, 'base64');

    db.close((errClose) => {
      if (errClose) console.warn('Advertencia al cerrar SQLite previo a restaurar:', errClose.message);

      try {
        const walPath = `${RUTA_DB_ACTUAL}-wal`;
        const shmPath = `${RUTA_DB_ACTUAL}-shm`;
        if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch (e) {}
        if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch (e) {}

        fs.writeFileSync(RUTA_DB_ACTUAL, buffer);

        db = new sqlite3.Database(RUTA_DB_ACTUAL, (errOpen) => {
          if (errOpen) {
            console.error('Error al reconectar la base de datos:', errOpen);
            return res.status(500).json({ error: 'Error al reconectar la base de datos restaurada.' });
          }

          console.log('✅ Base de datos restaurada y reconectada con éxito.');
          db.get('PRAGMA integrity_check', [], (errCheck, rowCheck) => {
            if (errCheck || !rowCheck || rowCheck.integrity_check !== 'ok') {
              console.warn('Advertencia de integridad tras restauración:', rowCheck);
            }
            res.json({ mensaje: 'Base de datos restaurada con éxito.' });
          });
        });
      } catch (writeErr) {
        console.error('Error al escribir el archivo restaurado en disco:', writeErr);
        db = new sqlite3.Database(RUTA_DB_ACTUAL);
        return res.status(500).json({ error: 'No se pudo reemplazar el archivo de base de datos en Windows (recurso en uso).' });
      }
    });
  } catch (err) {
    console.error('Error al procesar el buffer base64:', err);
    res.status(500).json({ error: 'El archivo de respaldo está dañado o no es válido.' });
  }
});

// Endpoint para apagar el servidor limpiamente cuando se cierra la app
app.post('/api/sistema/apagar', (req, res) => {
  res.json({ mensaje: 'Cerrando servidor...' });

  // Cerrar la base de datos de forma segura
  if (db) {
    db.close((err) => {
      if (err) console.error('Error al cerrar DB al apagar:', err);
      else console.log('🛑 Base de datos cerrada correctamente.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

const { exec } = require('child_process');

// Función auxiliar para localizar el ejecutable de LibreOffice en Windows
function obtenerRutaLibreOffice() {
  const rutasPosibles = [
    'soffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    path.join(__dirname, 'bin', 'libreoffice', 'program', 'soffice.exe')
  ];

  for (const r of rutasPosibles) {
    if (r === 'soffice') continue;
    if (fs.existsSync(r)) return `"${r}"`;
  }
  return 'soffice';
}

// Variable global en memoria para el último PDF listo
let ultimoPdfImpresionBuffer = null;
let ultimoNombrePdf = 'documento.pdf';

// Endpoint para guardar PDF directo o imagen
app.post('/api/impresiones/preparar-pdf', (req, res) => {
  const { base64Data, nombreArchivo } = req.body;
  if (!base64Data) {
    return res.status(400).json({ error: 'Falta base64' });
  }

  ultimoPdfImpresionBuffer = Buffer.from(base64Data, 'base64');
  ultimoNombrePdf = nombreArchivo || 'documento.pdf';
  res.json({ ok: true });
});

// Endpoint que sirve el PDF con visualización limpia
app.get('/api/impresiones/ver-pdf-temporal', (req, res) => {
  if (!ultimoPdfImpresionBuffer) {
    return res.status(404).send('No hay documento cargado para imprimir');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${ultimoNombrePdf}"`);
  res.send(ultimoPdfImpresionBuffer);
});

// Endpoint ÚNICO para convertir DOCX a PDF guardando en memoria
app.post('/api/impresiones/convertir-docx-a-pdf', (req, res) => {
  const { nombreArchivo, base64Data } = req.body;

  if (!base64Data) {
    return res.status(400).json({ error: 'No se recibieron datos del archivo' });
  }

  const marcaTiempo = Date.now();
  const dirTemp = os.tmpdir();
  const docxTemp = path.join(dirTemp, `input_${marcaTiempo}.docx`);
  const pdfEsperado = path.join(dirTemp, `input_${marcaTiempo}.pdf`);

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(docxTemp, buffer);

    const sofficeCmd = obtenerRutaLibreOffice();
    const comando = `${sofficeCmd} --headless --convert-to pdf:writer_pdf_Export "${docxTemp}" --outdir "${dirTemp}"`;

    exec(comando, (err, stdout, stderr) => {
      try { fs.unlinkSync(docxTemp); } catch (e) {}

      if (err || !fs.existsSync(pdfEsperado)) {
        console.error('Error al convertir con LibreOffice:', err || stderr);
        return res.status(500).json({
          error: 'No se pudo convertir el archivo DOCX a PDF.'
        });
      }

      const pdfBuffer = fs.readFileSync(pdfEsperado);
      
      // Guardar en memoria para que ver-pdf-temporal lo encuentre de inmediato
      ultimoPdfImpresionBuffer = pdfBuffer;
      ultimoNombrePdf = nombreArchivo ? nombreArchivo.replace(/\.docx$/i, '.pdf') : 'documento.pdf';

      const pdfBase64 = pdfBuffer.toString('base64');

      try { fs.unlinkSync(pdfEsperado); } catch (e) {}

      res.json({
        nombreArchivo: ultimoNombrePdf,
        pdfBase64
      });
    });
  } catch (error) {
    console.error('Error en proceso de conversión:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/configuracion/tarifas-impresion', (req, res) => {
  db.all('SELECT * FROM reglas_tarifas_impresion ORDER BY tipo ASC, hasta_porcentaje ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const negro = (rows || []).filter(r => r.tipo === 'negro');
    const color = (rows || []).filter(r => r.tipo === 'color');
    res.json({ negro, color });
  });
});

app.post('/api/configuracion/tarifas-impresion', (req, res) => {
  const { tipo, nombre, hasta_porcentaje, precio } = req.body;
  if (!tipo || !nombre || hasta_porcentaje === undefined || precio === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const sql = `INSERT INTO reglas_tarifas_impresion (tipo, nombre, hasta_porcentaje, precio) VALUES (?, ?, ?, ?)`;
  db.run(sql, [tipo, nombre.trim(), parseFloat(hasta_porcentaje), parseFloat(precio)], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, mensaje: 'Regla agregada' });
  });
});

app.put('/api/configuracion/tarifas-impresion/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, hasta_porcentaje, precio } = req.body;

  const sql = `UPDATE reglas_tarifas_impresion SET nombre = ?, hasta_porcentaje = ?, precio = ? WHERE id = ?`;
  db.run(sql, [nombre.trim(), parseFloat(hasta_porcentaje), parseFloat(precio), id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Regla actualizada' });
  });
});

app.delete('/api/configuracion/tarifas-impresion/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM reglas_tarifas_impresion WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Regla eliminada' });
  });
});

// Endpoint para cargar un archivo arrastrado desde su ruta local en Windows (Tauri)
app.post('/api/impresiones/cargar-desde-ruta', (req, res) => {
  const { rutaArchivo } = req.body;
  if (!rutaArchivo || !fs.existsSync(rutaArchivo)) {
    return res.status(400).json({ error: 'El archivo no existe en el equipo' });
  }

  try {
    const nombreArchivo = path.basename(rutaArchivo);
    const buffer = fs.readFileSync(rutaArchivo);
    const base64Data = buffer.toString('base64');
    
    // Obtener mime type básico
    const ext = path.extname(rutaArchivo).toLowerCase();
    let tipo = 'application/octet-stream';
    if (ext === '.pdf') tipo = 'application/pdf';
    else if (ext === '.docx') tipo = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (['.jpg', '.jpeg'].includes(ext)) tipo = 'image/jpeg';
    else if (ext === '.png') tipo = 'image/png';

    res.json({
      nombreArchivo,
      tipo,
      base64Data
    });
  } catch (err) {
    console.error('Error al leer archivo desde ruta:', err);
    res.status(500).json({ error: err.message });
  }
});

const { execFile } = require('child_process');

app.post('/api/impresiones/procesar-archivo-disco', (req, res) => {
  const { rutaArchivo } = req.body;
  console.log('📥 [/api/impresiones/procesar-archivo-disco] Ruta recibida:', rutaArchivo);

  if (!rutaArchivo || !fs.existsSync(rutaArchivo)) {
    console.error('❌ Archivo inexistente o inaccesible:', rutaArchivo);
    return res.status(400).json({ error: `El archivo no existe en el equipo: ${rutaArchivo}` });
  }

  const ext = path.extname(rutaArchivo).toLowerCase();
  const nombreArchivoOriginal = path.basename(rutaArchivo);

  if (ext === '.docx') {
    const dirTemp = os.tmpdir();
    const idTemp = `tauri_${Date.now()}`;
    const docxTemp = path.join(dirTemp, `${idTemp}.docx`);
    const pdfEsperado = path.join(dirTemp, `${idTemp}.pdf`);

    try {
      fs.copyFileSync(rutaArchivo, docxTemp);

      let sofficeExe = 'soffice';
      const rutasPosibles = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        path.join(__dirname, 'bin', 'libreoffice', 'program', 'soffice.exe')
      ];
      for (const r of rutasPosibles) {
        if (fs.existsSync(r)) {
          sofficeExe = r;
          break;
        }
      }

      console.log('⚙️ Ejecutable LibreOffice seleccionado:', sofficeExe);

      // Carpeta de perfil temporal única para aislar cada proceso de LibreOffice
      const perfilTemp = path.join(dirTemp, `lo_profile_${Date.now()}`);
      const perfilUri = `file:///${perfilTemp.replace(/\\/g, '/')}`;

      const args = [
        `-env:UserInstallation=${perfilUri}`,
        '--headless',
        '--convert-to',
        'pdf:writer_pdf_Export',
        docxTemp,
        '--outdir',
        dirTemp
      ];

      execFile(sofficeExe, args, (err, stdout, stderr) => {
        try { if (fs.existsSync(docxTemp)) fs.unlinkSync(docxTemp); } catch (e) {}

        if (err || !fs.existsSync(pdfEsperado)) {
          console.error('❌ Error de LibreOffice:', err || stderr);
          return res.status(500).json({ 
            error: `Error LibreOffice: ${err ? err.message : stderr || 'No se generó el PDF esperado'}` 
          });
        }

        const pdfBuffer = fs.readFileSync(pdfEsperado);
        ultimoPdfImpresionBuffer = pdfBuffer;
        ultimoNombrePdf = nombreArchivoOriginal.replace(/\.docx$/i, '.pdf');

        try { fs.unlinkSync(pdfEsperado); } catch (e) {}

        console.log('✅ DOCX convertido y enviado exitosamente');
        res.json({
          nombreArchivo: ultimoNombrePdf,
          esPdf: true,
          pdfBase64: pdfBuffer.toString('base64')
        });
      });
    } catch (e) {
      console.error('❌ Excepción preparando DOCX:', e);
      res.status(500).json({ error: e.message });
    }
  } else if (ext === '.pdf') {
    try {
      const pdfBuffer = fs.readFileSync(rutaArchivo);
      ultimoPdfImpresionBuffer = pdfBuffer;
      ultimoNombrePdf = nombreArchivoOriginal;
      res.json({
        nombreArchivo: ultimoNombrePdf,
        esPdf: true,
        pdfBase64: pdfBuffer.toString('base64')
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    try {
      const imgBuffer = fs.readFileSync(rutaArchivo);
      res.json({
        nombreArchivo: nombreArchivoOriginal,
        esPdf: false,
        mimeType: ext === '.png' ? 'image/png' : 'image/jpeg',
        base64Data: imgBuffer.toString('base64')
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
});

// Endpoint para abrir el visor de impresión en Edge desde Tauri/Windows
app.post('/api/impresiones/lanzar-visor-edge', (req, res) => {
  const urlPdf = `http://localhost:${PORT || 3001}/api/impresiones/ver-pdf-temporal`;
  // Comando universal de Windows para abrir la URL en el visor/navegador por defecto
  const comando = `start "" "${urlPdf}"`;

  exec(comando, (err) => {
    if (err) console.error('Error en fallback de impresión:', err);
    res.json({ ok: true });
  });
});

// Endpoint para disparar el cuadro de impresión nativo (Ctrl + P) en Windows
app.post('/api/impresiones/disparar-print-nativo', (req, res) => {
  // PowerShell simula la pulsación de Ctrl + P en la ventana que tiene el foco
  const comando = `powershell -Command "$wshell = New-Object -ComObject wscript.shell; Start-Sleep -Milliseconds 150; $wshell.SendKeys('^p')"`;

  exec(comando, (err) => {
    if (err) {
      console.warn('Error enviando Ctrl+P por PowerShell:', err);
    }
    res.json({ ok: true });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});