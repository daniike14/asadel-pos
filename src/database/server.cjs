const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());

// Aumentamos el límite del body a 10MB para recibir múltiples imágenes en Base64
app.use(express.json({ limit: '10mb' }));

const db = new sqlite3.Database('./src/database/puntos_de_venta.db', (err) => {
  if (err) console.error('Error al abrir la base de datos:', err.message);
  else console.log('✅ Base de datos SQLite conectada correctamente.');
});

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
    imagenLocacion TEXT, -- NUEVA COLUMNA PARA LA FOTO DE LA LOCACIÓN

    costoPaquete REAL DEFAULT 0,
    piezasPorPaquete INTEGER DEFAULT 1,
    precioVentaPaquete REAL DEFAULT 0,
    notaPaquete TEXT,
    
    costo REAL DEFAULT 0,
    precioVenta REAL DEFAULT 0,
    ganancia REAL DEFAULT 0,
    
    invMinimo INTEGER DEFAULT 0,
    invActual INTEGER DEFAULT 0,
    puntosLealtad INTEGER DEFAULT 0,
    
    esServicio BOOLEAN DEFAULT 0,
    esKit BOOLEAN DEFAULT 0,
    aGranel BOOLEAN DEFAULT 0,
    noInventariado BOOLEAN DEFAULT 0
  )
`);

  // NUEVA TABLA DE PROMOCIONES
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
      cajero TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS detalle_ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_aplicado REAL NOT NULL,
      descuento_porcentaje REAL DEFAULT 0,
      comentario TEXT,
      FOREIGN KEY(venta_id) REFERENCES ventas(id),
      FOREIGN KEY(producto_id) REFERENCES productos(id)
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
      cantidad INTEGER,
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

  db.get('SELECT COUNT(*) as count FROM productos', (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare(`
        INSERT INTO productos (codigoBarras, nombre, precioVenta, locacion, invActual, piezasPorPaquete)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run('75010001', 'Cuaderno Profesional Raya (100 Hojas)', 25.00, 'Anaquel A-F5', 340, 34);
      stmt.run('75010002', 'Cuaderno Profesional Cuadro Chico (100 Hojas)', 25.00, 'Anaquel A-F6', 45, 34);
      stmt.run('75010003', 'Cuaderno Forma Italiana Doblado', 18.00, 'Anaquel A-F2', 12, 20);
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
      stmt.run('Scribe México', '5551234567', 'Ventas Directas');
      stmt.run('Bic México', '5559876543', 'Atención Distribuidores');
      stmt.run('Maped', '5555551122', 'Soporte Comercial');
      stmt.finalize();
    }
  });
});

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
    esServicio, esKit, aGranel, noInventariado
  } = req.body;

  const sql = `
    INSERT INTO productos (
      codigoBarras, nombre, locacion, claveUnidad, atributoColor,
      departamento_id, categoria_id, proveedor_id, imagen, imagenLocacion,
      costoPaquete, piezasPorPaquete, precioVentaPaquete, notaPaquete,
      costo, precioVenta, ganancia,
      invMinimo, invActual, puntosLealtad,
      esServicio, esKit, aGranel, noInventariado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    codigoBarras || '', nombre, locacion || '', claveUnidad || 'H87', atributoColor || '',
    departamento_id || departamento || null,
    categoria_id || categoria || null,
    proveedor_id || proveedor || null,
    imagen || null, imagenLocacion || null,
    costoPaquete || 0, piezasPorPaquete || 1, precioVentaPaquete || 0, notaPaquete || '',
    costo || 0, precioVenta || 0, ganancia || 0,
    invMinimo || 0, invActual || 0, puntosLealtad || 0,
    esServicio ? 1 : 0, esKit ? 1 : 0, aGranel ? 1 : 0, noInventariado ? 1 : 0
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error(err);
      return res.status(400).json({ error: err.message || 'Error al insertar producto.' });
    }
    res.json({ id: this.lastID, mensaje: 'Producto guardado correctamente' });
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
    esServicio, esKit, aGranel, noInventariado
  } = req.body;

  const sql = `
    UPDATE productos SET
      codigoBarras = ?, nombre = ?, locacion = ?, claveUnidad = ?, atributoColor = ?,
      departamento_id = ?, categoria_id = ?, proveedor_id = ?, imagen = ?, imagenLocacion = ?,
      costoPaquete = ?, piezasPorPaquete = ?, precioVentaPaquete = ?, notaPaquete = ?,
      costo = ?, precioVenta = ?, ganancia = ?,
      invMinimo = ?, invActual = ?, puntosLealtad = ?,
      esServicio = ?, esKit = ?, aGranel = ?, noInventariado = ?
    WHERE id = ?
  `;

  const params = [
    codigoBarras || '', nombre, locacion || '', claveUnidad || 'H87', atributoColor || '',
    departamento_id || departamento || null,
    categoria_id || categoria || null,
    proveedor_id || proveedor || null,
    imagen || null, imagenLocacion || null,
    costoPaquete || 0, piezasPorPaquete || 1, precioVentaPaquete || 0, notaPaquete || '',
    costo || 0, precioVenta || 0, ganancia || 0,
    invMinimo || 0, invActual || 0, puntosLealtad || 0,
    esServicio ? 1 : 0, esKit ? 1 : 0, aGranel ? 1 : 0, noInventariado ? 1 : 0,
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
  const sql = 'DELETE FROM productos WHERE id = ?';

  db.run(sql, [id], function (err) {
    if (err) {
      console.error('Error al borrar producto:', err.message);
      return res.status(500).json({ error: 'Error al intentar eliminar el producto.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'No se encontró el producto con el ID especificado.' });
    }

    res.json({ mensaje: 'Producto eliminado correctamente', id: Number(id) });
  });
});

// --- ENDPOINTS DE PROMOCIONES ---
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

app.post('/api/ventas', (req, res) => {
  const { folio, total, metodo_pago, monto_efectivo, monto_tarjeta, cajero, items } = req.body;

  db.run(
    `INSERT INTO ventas (folio, total, metodo_pago, monto_efectivo, monto_tarjeta, cajero) VALUES (?, ?, ?, ?, ?, ?)`,
    [folio, total, metodo_pago, monto_efectivo, monto_tarjeta, cajero],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const ventaId = this.lastID;

      const stmtDetalle = db.prepare(
        `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_aplicado, descuento_porcentaje, comentario) VALUES (?, ?, ?, ?, ?, ?)`
      );
      const stmtStock = db.prepare(`UPDATE productos SET invActual = invActual - ? WHERE id = ?`);

      items.forEach((item) => {
        stmtDetalle.run(ventaId, item.id, item.cantidad, item.precioUnitario, item.descuento || 0, item.comentario || '');
        stmtStock.run(item.cantidad, item.id);
      });

      stmtDetalle.finalize();
      stmtStock.finalize();

      res.json({ mensaje: 'Venta registrada con éxito', ventaId });
    }
  );
});

app.post('/api/kits', (req, res) => {
  const { codigo, nombre, precio, items } = req.body;

  db.run(`INSERT INTO kits (codigo, nombre, precio) VALUES (?, ?, ?)`, [codigo, nombre, precio], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const kitId = this.lastID;

    const stmt = db.prepare(`INSERT INTO kit_detalles (kit_id, producto_id, cantidad) VALUES (?, ?, ?)`);
    items.forEach((item) => {
      stmt.run(kitId, item.producto_id, item.cantidad);
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

// --- ENDPOINT DE RESUMEN PARA EL DASHBOARD ---
app.get('/api/dashboard/resumen', (req, res) => {
  db.get(`SELECT SUM(total) as totalVentas, COUNT(*) as totalTickets FROM ventas`, [], (err, rowVentas) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(`SELECT * FROM productos WHERE invActual <= invMinimo OR invActual <= 5 LIMIT 5`, [], (err2, rowsProd) => {
      if (err2) return res.status(500).json({ error: err2.message });

      res.json({
        ventasDia: rowVentas.totalVentas || 0,
        ticketsDia: rowVentas.totalTickets || 0,
        devoluciones: 0,
        inventarioBajo: rowsProd
      });
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
      esServicio, esKit, aGranel, noInventariado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(codigoBarras) DO UPDATE SET
      nombre = excluded.nombre,
      costo = excluded.costo,
      precioVenta = excluded.precioVenta,
      invActual = invActual + excluded.invActual,
      locacion = CASE WHEN excluded.locacion != '' THEN excluded.locacion ELSE productos.locacion END
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
        p.invActual || 0,
        p.puntosLealtad || 0,
        p.esServicio ? 1 : 0,
        p.esKit ? 1 : 0,
        p.aGranel ? 1 : 0,
        p.noInventariado ? 1 : 0
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});