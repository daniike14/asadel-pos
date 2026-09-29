const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// Aumentamos el límite del body a 10MB para recibir múltiples imágenes en Base64
app.use(express.json({ limit: '10mb' }));

const db = new sqlite3.Database('./src/database/puntos_de_venta.db', (err) => {
  if (err) console.error('Error al abrir la base de datos:', err.message);
  else console.log('✅ Base de datos SQLite conectada correctamente.');
});

// Asegurar existencia de carpeta de respaldos automáticos
const RUTA_BACKUPS = path.join(__dirname, 'backups');
if (!fs.existsSync(RUTA_BACKUPS)) {
  fs.mkdirSync(RUTA_BACKUPS, { recursive: true });
}

const RUTA_DB_ACTUAL = path.join(__dirname, 'src', 'database', 'puntos_de_venta.db');

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
    fechaCompra TEXT
  )
`);

  db.run(`ALTER TABLE productos ADD COLUMN fechaCompra TEXT`, () => {});

  // TABLA DE HISTORIAL DE COMPRAS Y COSTOS POR PRODUCTO
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

  // TABLA DE ENCARGOS Y COMPRAS MANUALES / NOVEDADES
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
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
      total REAL NOT NULL,
      metodo_pago TEXT NOT NULL,
      monto_efectivo REAL DEFAULT 0,
      monto_tarjeta REAL DEFAULT 0,
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

  db.run(`
    CREATE TABLE IF NOT EXISTS detalle_ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad REAL NOT NULL,
      precio_aplicado REAL NOT NULL,
      descuento_porcentaje REAL DEFAULT 0,
      comentario TEXT,
      FOREIGN KEY(venta_id) REFERENCES ventas(id),
      FOREIGN KEY(producto_id) REFERENCES productos(id)
    )
  `);

  // TABLA DE ENTRADAS Y SALIDAS DE DINERO EN CAJA
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

  // TABLA DE HISTORIAL DE CORTES DE CAJA / CIERRES DE TURNO
  db.run(`
    CREATE TABLE IF NOT EXISTS cortes_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
      cajero TEXT NOT NULL,
      total_ventas_efectivo REAL DEFAULT 0,
      total_ventas_tarjeta REAL DEFAULT 0,
      total_entradas REAL DEFAULT 0,
      total_salidas REAL DEFAULT 0,
      saldo_esperado REAL DEFAULT 0,
      saldo_declarado REAL DEFAULT 0,
      diferencia REAL DEFAULT 0,
      observaciones TEXT
    )
  `);

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

  // TABLA DE CLIENTES Y MONEDERO DE PUNTOS DE LEALTAD
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT UNIQUE NOT NULL,
      puntos_acumulados INTEGER DEFAULT 0,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TABLA DE DATOS GENERALES DE LA EMPRESA / SUCURSAL
  db.run(`
    CREATE TABLE IF NOT EXISTS empresa_datos (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nombre TEXT NOT NULL,
      sucursal TEXT,
      direccion TEXT,
      telefono TEXT,
      mensaje_ticket TEXT,
      logo TEXT
    )
  `, () => {
    db.get('SELECT COUNT(*) as count FROM empresa_datos', (err, row) => {
      if (row && row.count === 0) {
        db.run(`
          INSERT INTO empresa_datos (id, nombre, sucursal, direccion, telefono, mensaje_ticket)
          VALUES (1, 'PAPELERÍA ASADEL', 'Sucursal Centro', 'Av. Principal #123, Col. Centro', '55 1234 5678', '¡Gracias por su compra y preferencia!')
        `);
      }
    });
  });

  // TABLA DE USUARIOS DEL SISTEMA (ADMINISTRADOR Y CAJEROS)
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

  // TABLA DE CONFIGURACIÓN DE REGLAS DE LEALTAD
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

  // TABLA DE CONFIGURACIÓN DE RESPALDOS
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
        stmt.run('ultimo_respaldo', new Date().toISOString());
        stmt.finalize();
      }
    });
  });

  db.get('SELECT COUNT(*) as count FROM productos', (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare(`
        INSERT INTO productos (codigoBarras, nombre, precioVenta, locacion, invActual, piezasPorPaquete, fechaCompra)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run('75010001', 'Cuaderno Profesional Raya (100 Hojas)', 25.00, 'Anaquel A-F5', 340, 34, '2026-09-01');
      stmt.run('75010002', 'Cuaderno Profesional Cuadro Chico (100 Hojas)', 25.00, 'Anaquel A-F6', 45, 34, '2026-09-05');
      stmt.run('75010003', 'Cuaderno Forma Italiana Doblado', 18.00, 'Anaquel A-F2', 12, 20, '2026-09-10');
      stmt.finalize();
    }
  });

  db.get('SELECT COUNT(*) as count FROM departamentos', (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare('INSERT INTO departamentos (nombre) VALUES (?)');
      stmt.run('Papelería Escolar');
      stmt.run('Oficina y Escritorio');
      stmt.run('Arte y Dibujo');
      stmt.finalize();
    }
  });

  db.get('SELECT COUNT(*) as count FROM categorias', (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare('INSERT INTO categorias (nombre) VALUES (?)');
      stmt.run('Cuadernos y Libretas');
      stmt.run('Escritura y Corrección');
      stmt.run('Hojas y Papel');
      stmt.finalize();
    }
  });

  db.get('SELECT COUNT(*) as count FROM proveedores', (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare('INSERT INTO proveedores (nombre, telefono, contacto) VALUES (?, ?, ?)');
      stmt.run('Tony Papelerías', '5551234567', 'Sucursal Centro');
      stmt.run('Scribe México', '5559876543', 'Ventas Directas');
      stmt.run('Bic México', '5555551122', 'Atención Distribuidores');
      stmt.finalize();
    }
  });
});

// Rutina de respaldo automático en disco
const ejecutarRespaldoEnDisco = () => {
  try {
    const fechaStr = new Date().toISOString().replace(/[:.]/g, '-');
    const destino = path.join(RUTA_BACKUPS, `respaldo_asadel_${fechaStr}.db`);
    fs.copyFileSync(RUTA_DB_ACTUAL, destino);
    db.run(`UPDATE configuracion_respaldos SET valor = ? WHERE clave = 'ultimo_respaldo'`, [new Date().toISOString()]);
    console.log(`💾 Respaldo automático generado en: ${destino}`);
  } catch (err) {
    console.error('Error al generar respaldo automático:', err);
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
      pr.nombre AS proveedor_nombre
    FROM productos p
    LEFT JOIN departamentos d ON p.departamento_id = d.id
    LEFT JOIN categorias c ON p.categoria_id = c.id
    LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
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
    fechaCompra
  } = req.body;

  const sql = `
    INSERT INTO productos (
      codigoBarras, nombre, locacion, claveUnidad, atributoColor,
      departamento_id, categoria_id, proveedor_id, imagen, imagenLocacion,
      costoPaquete, piezasPorPaquete, precioVentaPaquete, notaPaquete,
      costo, precioVenta, ganancia,
      invMinimo, invActual, puntosLealtad,
      esServicio, esKit, aGranel, noInventariado, fechaCompra
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const fechaCompraFinal = fechaCompra || new Date().toISOString().split('T')[0];

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
    fechaCompraFinal
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error(err);
      return res.status(400).json({ error: err.message || 'Error al insertar producto.' });
    }

    const nuevoId = this.lastID;

    if (parseFloat(costo) > 0 || parseFloat(costoPaquete) > 0) {
      db.run(
        `INSERT INTO historial_costos (producto_id, proveedor, costo_paquete, piezas_por_paquete, costo_unitario, cantidad_comprada, nota, fecha_compra)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nuevoId,
          'Alta Inicial',
          parseFloat(costoPaquete) || 0,
          parseInt(piezasPorPaquete) || 1,
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
    fechaCompra
  } = req.body;

  const sql = `
    UPDATE productos SET
      codigoBarras = ?, nombre = ?, locacion = ?, claveUnidad = ?, atributoColor = ?,
      departamento_id = ?, categoria_id = ?, proveedor_id = ?, imagen = ?, imagenLocacion = ?,
      costoPaquete = ?, piezasPorPaquete = ?, precioVentaPaquete = ?, notaPaquete = ?,
      costo = ?, precioVenta = ?, ganancia = ?,
      invMinimo = ?, invActual = ?, puntosLealtad = ?,
      esServicio = ?, esKit = ?, aGranel = ?, noInventariado = ?,
      fechaCompra = ?
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
    fechaCompra || new Date().toISOString().split('T')[0],
    id
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error(err);
      return res.status(400).json({ error: err.message || 'Error al actualizar producto.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
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

// --- HISTORIAL DE COSTOS ---
app.get('/api/productos/:id/historial-costos', (req, res) => {
  const { id } = req.params;
  const sql = `SELECT * FROM historial_costos WHERE producto_id = ? ORDER BY id DESC`;

  db.all(sql, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/productos/:id/registrar-compra', (req, res) => {
  const { id } = req.params;
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

  if (!proveedor || !costoUnitario) {
    return res.status(400).json({ error: 'Faltan datos obligatorios de la compra.' });
  }

  const cantCompradaNum = parseFloat(cantidadComprada) || 0;
  const costoUniNum = parseFloat(costoUnitario) || 0;
  const costoPaqNum = parseFloat(costoPaquete) || 0;
  const pzsPaqNum = parseInt(piezasPorPaquete) || 1;
  const fechaFinal = fechaCompra || new Date().toISOString().split('T')[0];

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

// --- PROMOCIONES ---
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

// --- MOVIMIENTOS DE CAJA ---
app.post('/api/movimientos-caja', (req, res) => {
  const { tipo, monto, motivo, cajero } = req.body;

  if (!tipo || !monto || !motivo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar el movimiento.' });
  }

  const sql = `INSERT INTO movimientos_caja (tipo, monto, motivo, cajero) VALUES (?, ?, ?, ?)`;
  db.run(sql, [tipo, parseFloat(monto) || 0, motivo.trim(), cajero || 'Turno 1'], function (err) {
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

// --- CORTE DE CAJA ---
app.get('/api/corte-caja/balance-actual', (req, res) => {
  const sqlVentas = `
    SELECT 
      COALESCE(SUM(CASE WHEN metodo_pago IN ('efectivo', 'mixto') THEN monto_efectivo ELSE 0 END), 0) as ventasEfectivo,
      COALESCE(SUM(CASE WHEN metodo_pago IN ('tarjeta', 'mixto') THEN monto_tarjeta ELSE 0 END), 0) as ventasTarjeta,
      COALESCE(SUM(total), 0) as totalVentas,
      COUNT(*) as ticketsTotal
    FROM ventas
    WHERE estado != 'cancelada'
  `;

  const sqlMovs = `
    SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE 0 END), 0) as totalEntradas,
      COALESCE(SUM(CASE WHEN tipo = 'salida' THEN monto ELSE 0 END), 0) as totalSalidas
    FROM movimientos_caja
  `;

  db.get(sqlVentas, [], (errV, rowV) => {
    if (errV) return res.status(500).json({ error: errV.message });

    db.get(sqlMovs, [], (errM, rowM) => {
      if (errM) return res.status(500).json({ error: errM.message });

      const ventasEfectivo = rowV.ventasEfectivo || 0;
      const ventasTarjeta = rowV.ventasTarjeta || 0;
      const totalEntradas = rowM.totalEntradas || 0;
      const totalSalidas = rowM.totalSalidas || 0;
      const saldoEsperado = ventasEfectivo + totalEntradas - totalSalidas;

      res.json({
        ventasEfectivo,
        ventasTarjeta,
        totalVentas: rowV.totalVentas || 0,
        ticketsTotal: rowV.ticketsTotal || 0,
        totalEntradas,
        totalSalidas,
        saldoEsperado
      });
    });
  });
});

app.post('/api/corte-caja', (req, res) => {
  const {
    cajero,
    ventasEfectivo,
    ventasTarjeta,
    totalEntradas,
    totalSalidas,
    saldoEsperado,
    saldoDeclarado,
    diferencia,
    observaciones
  } = req.body;

  const folio = `CORTE-${Date.now().toString().slice(-6)}`;
  const sql = `
    INSERT INTO cortes_caja (
      folio, cajero, total_ventas_efectivo, total_ventas_tarjeta,
      total_entradas, total_salidas, saldo_esperado, saldo_declarado,
      diferencia, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      folio,
      cajero || 'Turno 1',
      ventasEfectivo || 0,
      ventasTarjeta || 0,
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

// Guardar Venta (Con validación estricta de inventario)
app.post('/api/ventas', (req, res) => {
  const {
    folio,
    total,
    metodo_pago,
    monto_efectivo,
    monto_tarjeta,
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

  // Filtrar productos físicos inventariados
  const itemsFisicos = items.filter((it) => !it.esServicio && !it.noInventariado && it.id > 0 && !it.esKit);
  const idsFisicos = itemsFisicos.map((it) => it.id);

  const procesarGuardado = () => {
    const fechaHoraFinal = fecha_hora || new Date().toISOString();

    db.run(
      `INSERT INTO ventas (folio, fecha_hora, total, metodo_pago, monto_efectivo, monto_tarjeta, cajero, cliente_id, puntos_ganados, puntos_canjeados, estado) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completada')`,
      [
        folio,
        fechaHoraFinal,
        total,
        metodo_pago,
        monto_efectivo || 0,
        monto_tarjeta || 0,
        cajero || 'Turno 1',
        cliente_id || null,
        puntos_ganados || 0,
        puntos_canjeados || 0
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const ventaId = this.lastID;

        const stmtDetalle = db.prepare(
          `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_aplicado, descuento_porcentaje, comentario) VALUES (?, ?, ?, ?, ?, ?)`
        );
        const stmtStock = db.prepare(`UPDATE productos SET invActual = invActual - ? WHERE id = ?`);

        items.forEach((item) => {
          const cantItem = parseFloat(item.cantidad) || 0;

          if (item.esKit && item.kit_id) {
            stmtDetalle.run(ventaId, item.id || 0, cantItem, item.precioUnitario, item.descuento || 0, `Kit: ${item.nombre}`);

            db.all(`SELECT producto_id, cantidad FROM kit_detalles WHERE kit_id = ?`, [item.kit_id], (errK, componentes) => {
              if (!errK && componentes) {
                componentes.forEach((c) => {
                  const totalADescontar = (parseFloat(c.cantidad) || 1) * cantItem;
                  stmtStock.run(totalADescontar, c.producto_id);
                });
              }
            });
          } else {
            stmtDetalle.run(ventaId, item.id || 0, cantItem, item.precioUnitario, item.descuento || 0, item.comentario || '');
            if (!item.esServicio && !item.noInventariado && item.id > 0) {
              stmtStock.run(cantItem, item.id);
            }
          }
        });

        stmtDetalle.finalize();
        stmtStock.finalize();

        if (cliente_id) {
          const ganados = parseInt(puntos_ganados) || 0;
          const canjeados = parseInt(puntos_canjeados) || 0;
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

  // Verificación de stock en base de datos antes de cobrar
  if (idsFisicos.length > 0) {
    const placeholders = idsFisicos.map(() => '?').join(',');
    db.all(`SELECT id, nombre, invActual FROM productos WHERE id IN (${placeholders})`, idsFisicos, (errStock, prodsBD) => {
      if (errStock) return res.status(500).json({ error: errStock.message });

      for (const itemVenta of itemsFisicos) {
        const prodBD = prodsBD.find((p) => p.id === itemVenta.id);
        const cantRequerida = parseFloat(itemVenta.cantidad) || 0;
        const stockDisponible = parseFloat(prodBD?.invActual) || 0;

        if (!prodBD || stockDisponible < cantRequerida) {
          return res.status(400).json({
            error: `Existencias insuficientes para "${itemVenta.nombre}". Stock disponible: ${stockDisponible} pz(s).`
          });
        }
      }
      procesarGuardado();
    });
  } else {
    procesarGuardado();
  }
});

// CANCELAR / ANULAR VENTA (Devuelve existencias y revierte puntos de lealtad)
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

        // Regresar el inventario al stock físico
        const stmtStock = db.prepare(`
          UPDATE productos 
          SET invActual = invActual + ? 
          WHERE id = ? AND esServicio = 0 AND noInventariado = 0
        `);

        detalles.forEach((det) => {
          if (det.producto_id && det.producto_id > 0) {
            stmtStock.run(parseFloat(det.cantidad) || 0, det.producto_id);
          }
        });
        stmtStock.finalize();

        // Revertir puntos si hubo cliente registrado
        if (venta.cliente_id) {
          const ganados = parseInt(venta.puntos_ganados) || 0;
          const canjeados = parseInt(venta.puntos_canjeados) || 0;
          const delta = canjeados - ganados;

          db.run(
            `UPDATE clientes SET puntos_acumulados = MAX(0, puntos_acumulados + ?) WHERE id = ?`,
            [delta, venta.cliente_id]
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

app.get('/api/proveedores', (req, res) => {
  db.all('SELECT * FROM proveedores ORDER BY nombre ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/proveedores', (req, res) => {
  const { nombre, telefono, contacto } = req.body;
  db.run(
    'INSERT INTO proveedores (nombre, telefono, contacto) VALUES (?, ?, ?)',
    [nombre, telefono, contacto],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, nombre, telefono, contacto });
    }
  );
});

// --- CLIENTES ---
app.get('/api/clientes/buscar', (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  if (!q) return res.json([]);

  const sql = `SELECT * FROM clientes WHERE telefono LIKE ? OR nombre LIKE ? LIMIT 6`;
  db.all(sql, [`%${q}%`, `%${q}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/clientes', (req, res) => {
  const { nombre, telefono } = req.body;
  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'Nombre y teléfono son obligatorios.' });
  }

  const sql = `INSERT INTO clientes (nombre, telefono, puntos_acumulados) VALUES (?, ?, 0)`;
  db.run(sql, [nombre.trim(), telefono.trim()], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Ya existe un cliente registrado con ese número de teléfono.' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, nombre, telefono, puntos_acumulados: 0 });
  });
});

// --- CONFIGURACIÓN DE LEALTAD ---
app.get('/api/configuracion/lealtad', (req, res) => {
  db.all('SELECT * FROM configuracion_lealtad', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const config = {};
    rows.forEach((r) => {
      config[r.clave] = r.valor;
    });
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

// --- DASHBOARD RESUMEN ---
app.get('/api/dashboard/resumen', (req, res) => {
  const sqlVentas = `
    SELECT 
      COALESCE(SUM(CASE WHEN estado != 'cancelada' THEN total ELSE 0 END), 0) as totalVentas,
      COALESCE(SUM(CASE WHEN estado != 'cancelada' AND metodo_pago IN ('efectivo', 'mixto') THEN monto_efectivo ELSE 0 END), 0) as totalEfectivoVentas,
      COUNT(CASE WHEN estado != 'cancelada' THEN 1 END) as totalTickets,
      COUNT(CASE WHEN estado = 'cancelada' THEN 1 END) as totalDevoluciones
    FROM ventas
  `;

  db.get(sqlVentas, [], (err, rowVentas) => {
    if (err) return res.status(500).json({ error: err.message });

    const sqlMovs = `
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE 0 END), 0) as totalEntradas,
        COALESCE(SUM(CASE WHEN tipo = 'salida' THEN monto ELSE 0 END), 0) as totalSalidas
      FROM movimientos_caja
    `;

    db.get(sqlMovs, [], (errMov, rowMovs) => {
      if (errMov) return res.status(500).json({ error: errMov.message });

      db.all(
        `SELECT * FROM productos WHERE (invActual <= invMinimo OR invActual <= 5) AND esServicio = 0 AND noInventariado = 0 LIMIT 5`,
        [],
        (err2, rowsProd) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const ventasDia = rowVentas?.totalVentas || 0;
          const efectivoVentas = rowVentas?.totalEfectivoVentas || 0;
          const totalEntradas = rowMovs?.totalEntradas || 0;
          const totalSalidas = rowMovs?.totalSalidas || 0;
          const dineroCaja = efectivoVentas + totalEntradas - totalSalidas;

          res.json({
            ventasDia,
            ticketsDia: rowVentas?.totalTickets || 0,
            devoluciones: rowVentas?.totalDevoluciones || 0,
            totalEntradas,
            totalSalidas,
            dineroCaja,
            inventarioBajo: rowsProd
          });
        }
      );
    });
  });
});

app.post('/api/productos/importar-masivo', (req, res) => {
  const { productos } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'No se recibieron productos para importar.' });
  }

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
        p.codigoBarras,
        p.nombre,
        p.locacion || '',
        p.claveUnidad || 'PZA',
        p.atributoColor || '',
        p.departamento_id || null,
        p.categoria_id || null,
        p.proveedor_id || null,
        p.imagen || null,
        p.costoPaquete || 0,
        p.piezasPorPaquete || 1,
        p.precioVentaPaquete || 0,
        p.notaPaquete || '',
        p.costo || 0,
        p.precioVenta || 0,
        p.ganancia || 0,
        p.invMinimo || 0,
        parseFloat(p.invActual) || 0,
        p.puntosLealtad || 0,
        p.esServicio ? 1 : 0,
        p.esKit ? 1 : 0,
        p.aGranel ? 1 : 0,
        p.noInventariado ? 1 : 0,
        p.fechaCompra || new Date().toISOString().split('T')[0]
      ];

      stmt.run(params, (err) => {
        if (err) errores++;
      });
    }

    stmt.finalize();

    db.run('COMMIT', (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Error al procesar la transacción de importación.' });
      }
      res.json({
        mensaje: `Importación completada. Se procesaron los productos correctamente.`,
        errores
      });
    });
  });
});

// HISTORIAL COMPLETO DE VENTAS
app.get('/api/reportes/ventas', (req, res) => {
  const sqlVentas = `
    SELECT 
      v.*,
      c.nombre AS cliente_nombre,
      c.telefono AS cliente_telefono
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

// HISTORIAL DE CORTES DE CAJA
app.get('/api/reportes/cortes', (req, res) => {
  const sql = `SELECT * FROM cortes_caja ORDER BY id DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// KITS
app.get('/api/kits', (req, res) => {
  const sqlKits = `SELECT * FROM kits ORDER BY id DESC`;

  db.all(sqlKits, [], (err, rowsKits) => {
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

// Obtener lista completa de clientes con estadísticas
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

// Actualizar datos o saldo de puntos de un cliente
app.put('/api/clientes/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, puntos_acumulados } = req.body;

  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'Nombre y teléfono son obligatorios.' });
  }

  const sql = `
    UPDATE clientes 
    SET nombre = ?, telefono = ?, puntos_acumulados = ?
    WHERE id = ?
  `;

  db.run(sql, [nombre.trim(), telefono.trim(), parseInt(puntos_acumulados) || 0, id], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Ya existe otro cliente con ese número telefónico.' });
      }
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    res.json({ mensaje: 'Cliente actualizado correctamente.' });
  });
});

// Eliminar cliente
app.delete('/api/clientes/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM clientes WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ mensaje: 'Cliente eliminado correctamente.' });
  });
});

// Ver historial de compras asociadas a un cliente
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

// --- ENDPOINTS DE EMPRESA Y CONFIGURACIÓN ---
app.get('/api/empresa', (req, res) => {
  db.get('SELECT * FROM empresa_datos WHERE id = 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || {});
  });
});

app.post('/api/empresa', (req, res) => {
  const { nombre, sucursal, direccion, telefono, mensaje_ticket, logo } = req.body;

  const sql = `
    INSERT INTO empresa_datos (id, nombre, sucursal, direccion, telefono, mensaje_ticket, logo)
    VALUES (1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      nombre = excluded.nombre,
      sucursal = excluded.sucursal,
      direccion = excluded.direccion,
      telefono = excluded.telefono,
      mensaje_ticket = excluded.mensaje_ticket,
      logo = CASE WHEN excluded.logo IS NOT NULL AND excluded.logo != '' THEN excluded.logo ELSE empresa_datos.logo END
  `;

  db.run(sql, [nombre || '', sucursal || '', direccion || '', telefono || '', mensaje_ticket || '', logo || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Datos de la empresa actualizados correctamente.' });
  });
});

// --- ENDPOINTS DE GESTIÓN DE USUARIOS ---
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
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
      }
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
  if (parseInt(id, 10) === 1) {
    return res.status(400).json({ error: 'No es posible eliminar al Administrador principal.' });
  }

  db.run('DELETE FROM usuarios WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Usuario eliminado exitosamente.' });
  });
});

// --- ENDPOINT DE AUTENTICACIÓN / LOGIN ---
app.post('/api/auth/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Ingresa tu usuario y contraseña.' });
  }

  const sql = `SELECT id, usuario, nombre, rol, activo FROM usuarios WHERE usuario = ? AND password = ?`;
  db.get(sql, [usuario.trim().toLowerCase(), password.trim()], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    if (!row.activo) {
      return res.status(403).json({ error: 'Esta cuenta se encuentra desactivada. Contacta al administrador.' });
    }

    res.json({
      id: row.id,
      usuario: row.usuario,
      nombre: row.nombre,
      rol: row.rol
    });
  });
});

// --- ENDPOINTS DEL MÓDULO BASE DE DATOS (RESPALDOS) ---
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
          respaldosLocales: archivosBackups.slice(0, 8)
        });
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backup/descargar', (req, res) => {
  if (!fs.existsSync(RUTA_DB_ACTUAL)) {
    return res.status(404).send('Archivo de base de datos no encontrado.');
  }

  const fechaStr = new Date().toISOString().split('T')[0];
  const nombreDescarga = `respaldo_asadel_${fechaStr}.db`;

  res.download(RUTA_DB_ACTUAL, nombreDescarga, (err) => {
    if (!err) {
      db.run(`UPDATE configuracion_respaldos SET valor = ? WHERE clave = 'ultimo_respaldo'`, [new Date().toISOString()]);
    }
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
  ejecutarRespaldoEnDisco();
  res.json({ mensaje: 'Copia de seguridad guardada en el equipo.' });
});

app.post('/api/backup/optimizar', (req, res) => {
  db.run('VACUUM', [], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Base de datos optimizada y compactada correctamente.' });
  });
});

// REPORTE DE RESURTIDO COMBINADO (Inventario bajo automático + Encargos manuales)
app.get('/api/reportes/resurtido', (req, res) => {
  const proveedorId = req.query.proveedor_id;

  let sqlProductos = `
    SELECT 
      p.id,
      p.codigoBarras,
      p.nombre,
      p.locacion,
      p.costo,
      p.costoPaquete,
      p.piezasPorPaquete,
      p.invActual,
      p.invMinimo,
      COALESCE(pr.nombre, 'Sin Proveedor Asignado') AS proveedor_nombre,
      p.proveedor_id,
      0 AS esManual,
      '' AS nota_manual
    FROM productos p
    LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
    WHERE (p.invActual <= p.invMinimo OR p.invActual <= 5)
      AND p.esServicio = 0 
      AND p.noInventariado = 0
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
      cm.id,
      'ENCARGO' AS codigoBarras,
      cm.nombre,
      'Encargo / Novedad' AS locacion,
      cm.costo_estimado AS costo,
      0 AS costoPaquete,
      1 AS piezasPorPaquete,
      0 AS invActual,
      cm.cantidad AS invMinimo,
      COALESCE(pr.nombre, cm.proveedor_nombre, 'Sin Proveedor Asignado') AS proveedor_nombre,
      cm.proveedor_id,
      1 AS esManual,
      cm.nota AS nota_manual
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

// Guardar producto manual por encargo / novedad
app.post('/api/reportes/resurtido/manual', (req, res) => {
  const { nombre, cantidad, proveedor_id, proveedor_nombre, costo_estimado, nota } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'Escribe el nombre o descripción del producto a buscar.' });
  }

  const sql = `
    INSERT INTO compras_manuales (nombre, cantidad, proveedor_id, proveedor_nombre, costo_estimado, nota)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      nombre.trim(),
      parseFloat(cantidad) || 1,
      proveedor_id ? parseInt(proveedor_id, 10) : null,
      proveedor_nombre || null,
      parseFloat(costo_estimado) || 0,
      nota ? nota.trim() : ''
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Encargo registrado exitosamente.' });
    }
  );
});

// Eliminar encargo manual de compras
app.delete('/api/reportes/resurtido/manual/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM compras_manuales WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Encargo eliminado de la lista.' });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});