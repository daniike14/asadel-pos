import React, { useState, useEffect, useMemo } from 'react';
import logoPorDefecto from '../assets/Logo.jpg';
import './ReportesHistorial.css';
import { API_URL } from '../config';

const fechaAString = (fecha) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

const formatearFechaLocal = (fechaHoraStr) => {
  if (!fechaHoraStr) return '';
  const strNormalizado = fechaHoraStr.includes('T') || fechaHoraStr.endsWith('Z')
    ? fechaHoraStr
    : `${fechaHoraStr.replace(' ', 'T')}Z`;

  const d = new Date(strNormalizado);
  return isNaN(d.getTime()) ? '' : fechaAString(d);
};

const formatearFechaHoraLegible = (fechaHoraStr) => {
  if (!fechaHoraStr) return '';
  const strNormalizado = fechaHoraStr.includes('T') || fechaHoraStr.endsWith('Z')
    ? fechaHoraStr
    : `${fechaHoraStr.replace(' ', 'T')}Z`;

  const d = new Date(strNormalizado);
  return isNaN(d.getTime()) ? fechaHoraStr : d.toLocaleString();
};

export default function ReportesHistorial({ volverAlDashboard }) {
  const [pestañaActiva, setPestañaActiva] = useState('ventas'); // 'ventas' | 'movimientos' | 'cortes' | 'resurtido'
  const [ventas, setVentas] = useState([]);
  const [cortes, setCortes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [listaResurtido, setListaResurtido] = useState([]);

  // Formulario de Encargo / Novedad Manual
  const [mostrarModalEncargo, setMostrarModalEncargo] = useState(false);
  const [datosEncargo, setDatosEncargo] = useState({
    nombre: '',
    cantidad: 1,
    proveedor_id: '',
    costo_estimado: '',
    nota: ''
  });

  // Datos dinámicos de la Empresa
  const [datosEmpresa, setDatosEmpresa] = useState({
    nombre: 'PAPELERÍA ASADEL',
    sucursal: '',
    direccion: '',
    telefono: '',
    mensaje_ticket: '¡Gracias por su compra y preferencia!',
    logo: ''
  });

  const [cantidadesResurtido, setCantidadesResurtido] = useState({});

  const manejarCambioCantidadResurtido = (keyId, nuevaCant) => {
    const val = parseFloat(nuevaCant);
    setCantidadesResurtido((prev) => ({
      ...prev,
      [keyId]: isNaN(val) || val < 0 ? 0 : val
    }));
  };

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState('todos');
  const [tipoMovimientoFiltro, setTipoMovimientoFiltro] = useState('todos');
  const [proveedorResurtidoFiltro, setProveedorResurtidoFiltro] = useState('todos');
  const [rangoRapido, setRangoRapido] = useState('hoy');
  const [fechaInicio, setFechaInicio] = useState(fechaAString(new Date()));
  const [fechaFin, setFechaFin] = useState(fechaAString(new Date()));

  // Elemento modal
  const [elementoSeleccionado, setElementoSeleccionado] = useState(null);
  const [tipoModal, setTipoModal] = useState(null);

  const cargarDatos = async () => {
    try {
      const [resVentas, resCortes, resMovs, resEmpresa, resProvs, resResurtido] = await Promise.all([
        fetch(`${API_URL}/api/reportes/ventas`),
        fetch(`${API_URL}/api/reportes/cortes`),
        fetch(`${API_URL}/api/movimientos-caja`),
        fetch(`${API_URL}/api/empresa`),
        fetch(`${API_URL}/api/proveedores`),
        fetch(`${API_URL}/api/reportes/resurtido`)
      ]);

      if (resVentas.ok) setVentas(await resVentas.json());
      if (resCortes.ok) setCortes(await resCortes.json());
      if (resMovs.ok) setMovimientos(await resMovs.json());
      if (resProvs.ok) setProveedores(await resProvs.json());
      if (resResurtido.ok) setListaResurtido(await resResurtido.json());
      if (resEmpresa.ok) {
        const dataEmp = await resEmpresa.json();
        if (dataEmp && dataEmp.nombre) setDatosEmpresa(dataEmp);
      }
    } catch (err) {
      console.error('Error al cargar reportes:', err);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const aplicarRangoRapido = (tipo) => {
    setRangoRapido(tipo);
    const hoy = new Date();

    if (tipo === 'hoy') {
      const hoyStr = fechaAString(hoy);
      setFechaInicio(hoyStr);
      setFechaFin(hoyStr);
    } else if (tipo === 'semana') {
      const primerDia = new Date(hoy);
      primerDia.setDate(hoy.getDate() - hoy.getDay());
      setFechaInicio(fechaAString(primerDia));
      setFechaFin(fechaAString(hoy));
    } else if (tipo === 'mes') {
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      setFechaInicio(fechaAString(primerDiaMes));
      setFechaFin(fechaAString(hoy));
    } else if (tipo === 'todo') {
      setFechaInicio('');
      setFechaFin('');
    }
  };

  const coincideFecha = (fechaHoraStr) => {
    if (!fechaInicio && !fechaFin) return true;
    if (!fechaHoraStr) return false;

    const fechaItem = formatearFechaLocal(fechaHoraStr);
    if (!fechaItem) return false;

    if (fechaInicio && fechaFin) {
      return fechaItem >= fechaInicio && fechaItem <= fechaFin;
    }
    if (fechaInicio) return fechaItem >= fechaInicio;
    if (fechaFin) return fechaItem <= fechaFin;
    return true;
  };

  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      const coincideTexto = 
        v.folio?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        v.cajero?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        v.cliente_nombre?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        v.cliente_telefono?.includes(filtroTexto);

      const coincideMetodo = 
        metodoPagoFiltro === 'todos' || v.metodo_pago === metodoPagoFiltro;

      const coincideFec = coincideFecha(v.fecha_hora);

      return coincideTexto && coincideMetodo && coincideFec;
    });
  }, [ventas, filtroTexto, metodoPagoFiltro, fechaInicio, fechaFin]);

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      const coincideTexto = 
        m.motivo?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        m.cajero?.toLowerCase().includes(filtroTexto.toLowerCase());

      const coincideTipo = 
        tipoMovimientoFiltro === 'todos' || m.tipo === tipoMovimientoFiltro;

      const coincideFec = coincideFecha(m.fecha_hora);

      return coincideTexto && coincideTipo && coincideFec;
    });
  }, [movimientos, filtroTexto, tipoMovimientoFiltro, fechaInicio, fechaFin]);

  const cortesFiltrados = useMemo(() => {
    return cortes.filter((c) => {
      const coincideTexto = 
        c.folio?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        c.cajero?.toLowerCase().includes(filtroTexto.toLowerCase());

      const coincideFec = coincideFecha(c.fecha_hora);

      return coincideTexto && coincideFec;
    });
  }, [cortes, filtroTexto, fechaInicio, fechaFin]);

  // Filtrado de la lista de resurtido
  const resurtidoFiltrado = useMemo(() => {
    return listaResurtido.filter((p) => {
      const coincideTexto =
        p.nombre?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        p.codigoBarras?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        p.locacion?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        p.proveedor_nombre?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        p.nota_manual?.toLowerCase().includes(filtroTexto.toLowerCase());

      let coincideProv = true;
      if (proveedorResurtidoFiltro !== 'todos') {
        if (proveedorResurtidoFiltro === 'sin_proveedor') {
          coincideProv = p.proveedor_nombre === 'Sin Proveedor Asignado';
        } else {
          coincideProv = String(p.proveedor_id || '') === String(proveedorResurtidoFiltro) ||
                         p.proveedor_nombre?.toLowerCase() === proveedores.find(pr => String(pr.id) === String(proveedorResurtidoFiltro))?.nombre?.toLowerCase();
        }
      }

      return coincideTexto && coincideProv;
    });
  }, [listaResurtido, filtroTexto, proveedorResurtidoFiltro, proveedores]);

  const metricasVentas = useMemo(() => {
    const activas = ventasFiltradas.filter((v) => v.estado !== 'cancelada');
    const totalVentas = activas.reduce((acc, v) => acc + (v.total || 0), 0);
    const totalEfectivo = activas.reduce((acc, v) => acc + (v.monto_efectivo || 0), 0);
    const totalTarjeta = activas.reduce((acc, v) => acc + (v.monto_tarjeta || 0), 0);
    const tickets = activas.length;
    const ticketPromedio = tickets > 0 ? totalVentas / tickets : 0;

    return { totalVentas, totalEfectivo, totalTarjeta, tickets, ticketPromedio };
  }, [ventasFiltradas]);

  const metricasMovimientos = useMemo(() => {
    const totalEntradas = movimientosFiltrados
      .filter((m) => m.tipo === 'entrada')
      .reduce((acc, m) => acc + (m.monto || 0), 0);

    const totalSalidas = movimientosFiltrados
      .filter((m) => m.tipo === 'salida')
      .reduce((acc, m) => acc + (m.monto || 0), 0);

    const neto = totalEntradas - totalSalidas;

    return { totalEntradas, totalSalidas, neto, cantidad: movimientosFiltrados.length };
  }, [movimientosFiltrados]);

  const metricasCortes = useMemo(() => {
    const esperados = cortesFiltrados.reduce((acc, c) => acc + (c.saldo_esperado || 0), 0);
    const declarados = cortesFiltrados.reduce((acc, c) => acc + (c.saldo_declarado || 0), 0);
    const diferenciaTotal = cortesFiltrados.reduce((acc, c) => acc + (c.diferencia || 0), 0);

    return { esperados, declarados, diferenciaTotal, totalCortes: cortesFiltrados.length };
  }, [cortesFiltrados]);

  // Métricas del pedido de resurtido
  const metricasResurtido = useMemo(() => {
    const totalProductos = resurtidoFiltrado.length;
    let totalPiezasFaltantes = 0;
    let inversionEstimada = 0;

    resurtidoFiltrado.forEach((p) => {
      const keyId = p.esManual ? `MAN_${p.id}` : `PROD_${p.id}`;
      const stock = parseFloat(p.invActual) || 0;
      const min = parseFloat(p.invMinimo) || 5;
      const sugeridoPorDefecto = p.esManual ? min : Math.max(1, min * 2 - stock);

      const cantidadFinal = cantidadesResurtido[keyId] !== undefined 
        ? cantidadesResurtido[keyId] 
        : sugeridoPorDefecto;

      totalPiezasFaltantes += cantidadFinal;
      inversionEstimada += cantidadFinal * (parseFloat(p.costo) || 0);
    });

    return { totalProductos, totalPiezasFaltantes, inversionEstimada };
  }, [resurtidoFiltrado, cantidadesResurtido]);

  const cancelarVentaSeleccionada = async (idVenta) => {
    if (!window.confirm('⚠️ ¿Estás seguro de cancelar esta venta? Se devolverán los productos físicos al inventario y se ajustará el monedero del cliente.')) return;

    try {
      const res = await fetch(`${API_URL}/api/ventas/${idVenta}/cancelar`, { method: 'POST' });
      if (res.ok) {
        alert('✅ Venta cancelada correctamente y productos regresados al stock.');
        setTipoModal(null);
        cargarDatos();
      } else {
        const dataErr = await res.json();
        alert(dataErr.error || 'Error al cancelar la venta.');
      }
    } catch {
      alert('Error de conexión al procesar la cancelación.');
    }
  };

  const guardarEncargoManual = async (e) => {
    e.preventDefault();
    if (!datosEncargo.nombre.trim()) return alert('⚠️ Ingresa el nombre del producto.');

    const provObj = proveedores.find((p) => String(p.id) === String(datosEncargo.proveedor_id));

    const payload = {
      nombre: datosEncargo.nombre.trim(),
      cantidad: parseFloat(datosEncargo.cantidad) || 1,
      proveedor_id: datosEncargo.proveedor_id ? parseInt(datosEncargo.proveedor_id, 10) : null,
      proveedor_nombre: provObj ? provObj.nombre : null,
      costo_estimado: parseFloat(datosEncargo.costo_estimado) || 0,
      nota: datosEncargo.nota.trim()
    };

    try {
      const res = await fetch(`${API_URL}/api/reportes/resurtido/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('✅ ¡Encargo / Novedad añadida a la lista de compras!');
        setDatosEncargo({ nombre: '', cantidad: 1, proveedor_id: '', costo_estimado: '', nota: '' });
        setMostrarModalEncargo(false);
        const resR = await fetch(`${API_URL}/api/reportes/resurtido`);
        if (resR.ok) setListaResurtido(await resR.json());
      } else {
        alert('Error al guardar el encargo.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  const eliminarEncargoManual = async (idManual, nombre) => {
    if (!window.confirm(`¿Deseas quitar "${nombre}" de la lista de compras?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/reportes/resurtido/manual/${idManual}`, { method: 'DELETE' });
      if (res.ok) {
        const resR = await fetch(`${API_URL}/api/reportes/resurtido`);
        if (resR.ok) setListaResurtido(await resR.json());
      }
    } catch {
      alert('Error al eliminar el encargo.');
    }
  };

  return (
    <div className="reportes-container">
      <header className="reportes-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src={datosEmpresa.logo || logoPorDefecto} alt="Logo" style={{ height: '30px' }} />
          <h2 style={{ margin: 0, fontSize: '16px' }}>HISTORIAL Y REPORTES DE CAJA</h2>
        </div>

        <div className="reportes-tabs">
          <button 
            className={`tab-btn ${pestañaActiva === 'ventas' ? 'active' : ''}`}
            onClick={() => setPestañaActiva('ventas')}
          >
            🧾 Ventas ({ventasFiltradas.length})
          </button>
          <button 
            className={`tab-btn ${pestañaActiva === 'movimientos' ? 'active' : ''}`}
            onClick={() => setPestañaActiva('movimientos')}
          >
            💸 Entradas y Salidas ({movimientosFiltrados.length})
          </button>
          <button 
            className={`tab-btn ${pestañaActiva === 'cortes' ? 'active' : ''}`}
            onClick={() => setPestañaActiva('cortes')}
          >
            📊 Cortes de Turno ({cortesFiltrados.length})
          </button>
          <button 
            className={`tab-btn ${pestañaActiva === 'resurtido' ? 'active' : ''}`}
            onClick={() => setPestañaActiva('resurtido')}
          >
            🛒 Resurtido / Compras ({resurtidoFiltrado.length})
          </button>
        </div>

        {volverAlDashboard && (
          <button className="btn-secondary" onClick={volverAlDashboard}>
            ⬅ Volver
          </button>
        )}
      </header>

      {/* FILTROS */}
      <div className="reportes-filter-card">
        {pestañaActiva !== 'resurtido' ? (
          <div className="filter-row">
            <div className="filter-group-inputs">
              <div className="filter-field">
                <label>Desde:</label>
                <input 
                  type="date" 
                  value={fechaInicio} 
                  onChange={(e) => { setFechaInicio(e.target.value); setRangoRapido('personalizado'); }} 
                />
              </div>
              <div className="filter-field">
                <label>Hasta:</label>
                <input 
                  type="date" 
                  value={fechaFin} 
                  onChange={(e) => { setFechaFin(e.target.value); setRangoRapido('personalizado'); }} 
                />
              </div>

              {pestañaActiva === 'ventas' && (
                <div className="filter-field">
                  <label>Pago:</label>
                  <select 
                    value={metodoPagoFiltro} 
                    onChange={(e) => setMetodoPagoFiltro(e.target.value)}
                  >
                    <option value="todos">Todos los métodos</option>
                    <option value="efectivo">Solo Efectivo</option>
                    <option value="tarjeta">Solo Tarjeta</option>
                    <option value="mixto">Pago Mixto</option>
                  </select>
                </div>
              )}

              {pestañaActiva === 'movimientos' && (
                <div className="filter-field">
                  <label>Tipo:</label>
                  <select 
                    value={tipoMovimientoFiltro} 
                    onChange={(e) => setTipoMovimientoFiltro(e.target.value)}
                  >
                    <option value="todos">Todos los movimientos</option>
                    <option value="entrada">Solo Entradas (Fondo)</option>
                    <option value="salida">Solo Salidas (Gastos)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="filter-presets">
              <button className={`btn-preset ${rangoRapido === 'hoy' ? 'active' : ''}`} onClick={() => aplicarRangoRapido('hoy')}>Hoy</button>
              <button className={`btn-preset ${rangoRapido === 'semana' ? 'active' : ''}`} onClick={() => aplicarRangoRapido('semana')}>Semana</button>
              <button className={`btn-preset ${rangoRapido === 'mes' ? 'active' : ''}`} onClick={() => aplicarRangoRapido('mes')}>Mes</button>
              <button className={`btn-preset ${rangoRapido === 'todo' ? 'active' : ''}`} onClick={() => aplicarRangoRapido('todo')}>Todo</button>
            </div>
          </div>
        ) : (
          /* FILTRO ESPECÍFICO PARA RESURTIDO Y BOTÓN DE ENCARGO */
          <div className="filter-row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div className="filter-group-inputs" style={{ flex: 1, maxWidth: '320px' }}>
              <div className="filter-field" style={{ width: '100%' }}>
                <label>Proveedor / Lugar de Compra:</label>
                <select 
                  value={proveedorResurtidoFiltro} 
                  onChange={(e) => setProveedorResurtidoFiltro(e.target.value)}
                >
                  <option value="todos">-- Todos los Proveedores --</option>
                  {proveedores.map((pr) => (
                    <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                  ))}
                  <option value="sin_proveedor">Sin Proveedor Asignado</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }} className="no-print">
              <button 
                type="button"
                className="btn-confirm-modal"
                style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setMostrarModalEncargo(true)}
              >
                + Anotar Encargo / Novedad
              </button>
              <button 
                type="button" 
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  height: '36px'
                }}
                onClick={() => window.print()}
              >
                🖨️ Imprimir Lista de Compras
              </button>
            </div>
          </div>
        )}

        <div className="filter-row" style={{ marginTop: '4px' }}>
          <input
            type="text"
            className="reportes-search"
            style={{ width: '100%', maxWidth: '100%' }}
            placeholder={
              pestañaActiva === 'ventas'
                ? "Filtrar por folio, cajero, cliente o teléfono..."
                : pestañaActiva === 'movimientos'
                ? "Filtrar por concepto/motivo o cajero..."
                : pestañaActiva === 'cortes'
                ? "Filtrar cortes por folio o cajero..."
                : "Filtrar artículos por nombre, código, anaquel o nota..."
            }
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </div>
      </div>

      {/* MÉTRICAS */}
      {pestañaActiva === 'ventas' && (
        <div className="reportes-metrics-grid">
          <div className="metric-box">
            <span>Total Vendido</span>
            <strong style={{ color: '#16a34a' }}>${metricasVentas.totalVentas.toFixed(2)}</strong>
          </div>
          <div className="metric-box">
            <span>En Efectivo</span>
            <strong>${metricasVentas.totalEfectivo.toFixed(2)}</strong>
          </div>
          <div className="metric-box">
            <span>En Tarjeta</span>
            <strong style={{ color: '#0284c7' }}>${metricasVentas.totalTarjeta.toFixed(2)}</strong>
          </div>
          <div className="metric-box">
            <span>Tickets Activos</span>
            <strong>{metricasVentas.tickets}</strong>
          </div>
          <div className="metric-box">
            <span>Ticket Promedio</span>
            <strong>${metricasVentas.ticketPromedio.toFixed(2)}</strong>
          </div>
        </div>
      )}

      {pestañaActiva === 'movimientos' && (
        <div className="reportes-metrics-grid">
          <div className="metric-box">
            <span>Registros</span>
            <strong>{metricasMovimientos.cantidad}</strong>
          </div>
          <div className="metric-box">
            <span>Total Entradas (Fondo)</span>
            <strong style={{ color: '#0284c7' }}>+${metricasMovimientos.totalEntradas.toFixed(2)}</strong>
          </div>
          <div className="metric-box">
            <span>Total Salidas (Gastos)</span>
            <strong style={{ color: '#dc2626' }}>-${metricasMovimientos.totalSalidas.toFixed(2)}</strong>
          </div>
          <div className="metric-box">
            <span>Flujo Neto en Caja</span>
            <strong style={{ color: metricasMovimientos.neto >= 0 ? '#16a34a' : '#dc2626' }}>
              {metricasMovimientos.neto >= 0 ? '+' : ''}${metricasMovimientos.neto.toFixed(2)}
            </strong>
          </div>
        </div>
      )}

      {pestañaActiva === 'cortes' && (
        <div className="reportes-metrics-grid">
          <div className="metric-box">
            <span>Cortes Realizados</span>
            <strong>{metricasCortes.totalCortes}</strong>
          </div>
          <div className="metric-box">
            <span>Total Esperado</span>
            <strong>${metricasCortes.esperados.toFixed(2)}</strong>
          </div>
          <div className="metric-box">
            <span>Total Contado</span>
            <strong style={{ color: '#16a34a' }}>${metricasCortes.declarados.toFixed(2)}</strong>
          </div>
          <div className="metric-box">
            <span>Balance Faltante/Sobrante</span>
            <strong style={{ 
              color: metricasCortes.diferenciaTotal === 0 ? '#16a34a' : metricasCortes.diferenciaTotal > 0 ? '#0284c7' : '#dc2626' 
            }}>
              {metricasCortes.diferenciaTotal >= 0 ? '+' : ''}${metricasCortes.diferenciaTotal.toFixed(2)}
            </strong>
          </div>
        </div>
      )}

      {pestañaActiva === 'resurtido' && (
        <div className="reportes-metrics-grid">
          <div className="metric-box">
            <span>Artículos a Comprar</span>
            <strong style={{ color: '#dc2626' }}>{metricasResurtido.totalProductos}</strong>
          </div>
          <div className="metric-box">
            <span>Piezas Totales a Surtir</span>
            <strong style={{ color: '#0284c7' }}>{metricasResurtido.totalPiezasFaltantes} pzs</strong>
          </div>
          <div className="metric-box">
            <span>Inversión Estimada Requerida</span>
            <strong style={{ color: '#16a34a' }}>${metricasResurtido.inversionEstimada.toFixed(2)}</strong>
          </div>
        </div>
      )}

      {/* TABLA DE VENTAS */}
      {pestañaActiva === 'ventas' && (
        <div className="reportes-table-wrapper">
          <table className="reportes-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha y Hora</th>
                <th>Cajero</th>
                <th>Cliente / Lealtad</th>
                <th>Método de Pago</th>
                <th>Artículos</th>
                <th>Total</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventasFiltradas.map((v) => {
                const totalPiezasVenta = (v.items || []).reduce((acc, it) => acc + (parseFloat(it.cantidad) || 0), 0);
                const esCancelada = v.estado === 'cancelada';

                return (
                  <tr key={v.id} style={{ opacity: esCancelada ? 0.6 : 1, backgroundColor: esCancelada ? '#fee2e2' : 'transparent' }}>
                    <td>
                      <strong>{v.folio}</strong>
                      {esCancelada && (
                        <span style={{ display: 'block', color: '#dc2626', fontWeight: 'bold', fontSize: '11px' }}>
                          [CANCELADA]
                        </span>
                      )}
                    </td>
                    <td>{formatearFechaHoraLegible(v.fecha_hora)}</td>
                    <td>{v.cajero}</td>
                    <td>
                      {v.cliente_nombre ? (
                        <div>
                          <strong>{v.cliente_nombre}</strong>
                          <div style={{ fontSize: '11px', color: '#16a34a' }}>
                            +{v.puntos_ganados || 0} pts {v.puntos_canjeados > 0 && `(-${v.puntos_canjeados} canjeados)`}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>General</span>
                      )}
                    </td>
                    <td>
                      <span className={`tag-pago ${v.metodo_pago}`}>
                        {v.metodo_pago}
                      </span>
                    </td>
                    <td>
                      <strong>{totalPiezasVenta} pza(s)</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        ({v.items?.length || 0} tipo(s))
                      </div>
                    </td>
                    <td><strong>${v.total.toFixed(2)}</strong></td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn-accion-tabla"
                        onClick={() => {
                          setElementoSeleccionado(v);
                          setTipoModal('reimprimir_venta');
                        }}
                      >
                        🖨️ Ver / Reimprimir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {ventasFiltradas.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No se encontraron ventas para este criterio.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLA DE MOVIMIENTOS */}
      {pestañaActiva === 'movimientos' && (
        <div className="reportes-table-wrapper">
          <table className="reportes-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>Fecha y Hora</th>
                <th>Tipo</th>
                <th>Concepto / Motivo</th>
                <th>Cajero</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.map((m) => (
                <tr key={m.id}>
                  <td>#{m.id}</td>
                  <td>{formatearFechaHoraLegible(m.fecha_hora)}</td>
                  <td>
                    <span className={`tag-movimiento ${m.tipo}`}>
                      {m.tipo === 'entrada' ? '⬇ Entrada' : '⬆ Salida'}
                    </span>
                  </td>
                  <td><strong>{m.motivo}</strong></td>
                  <td>{m.cajero}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    <span style={{ color: m.tipo === 'entrada' ? '#0284c7' : '#dc2626' }}>
                      {m.tipo === 'entrada' ? '+' : '-'}${m.monto.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
              {movimientosFiltrados.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No se encontraron entradas ni salidas de dinero registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLA DE CORTES */}
      {pestañaActiva === 'cortes' && (
        <div className="reportes-table-wrapper">
          <table className="reportes-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha y Hora</th>
                <th>Cajero</th>
                <th>Ventas Efec.</th>
                <th>Saldo Esperado</th>
                <th>Saldo Declarado</th>
                <th>Diferencia</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cortesFiltrados.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.folio}</strong></td>
                  <td>{formatearFechaHoraLegible(c.fecha_hora)}</td>
                  <td>{c.cajero}</td>
                  <td>${c.total_ventas_efectivo.toFixed(2)}</td>
                  <td>${c.saldo_esperado.toFixed(2)}</td>
                  <td><strong>${c.saldo_declarado.toFixed(2)}</strong></td>
                  <td>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: c.diferencia === 0 ? '#16a34a' : c.diferencia > 0 ? '#0284c7' : '#dc2626' 
                    }}>
                      {c.diferencia === 0 ? 'Exacto ($0.00)' : `${c.diferencia > 0 ? '+' : ''}$${c.diferencia.toFixed(2)}`}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="btn-accion-tabla"
                      onClick={() => {
                        setElementoSeleccionado(c);
                        setTipoModal('ver_corte');
                      }}
                    >
                      📄 Ver Arqueo
                    </button>
                  </td>
                </tr>
              ))}
              {cortesFiltrados.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No se encontraron cortes de caja en este rango de fechas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLA / HOJA DE RESURTIDO (COMBINADA) */}
      {pestañaActiva === 'resurtido' && (
        <div className="reportes-table-wrapper resurtido-print-area">
          <div className="nota-carta-header" style={{ marginBottom: '15px' }}>
            <div className="nota-carta-empresa">
              <h2>{datosEmpresa.nombre || 'PAPELERÍA ASADEL'}</h2>
              <p>Lista de Compras, Novedades y Resurtido de Inventario</p>
            </div>
            <div className="nota-carta-datos-folio">
              <strong>FECHA DE EMISIÓN</strong><br />
              <span>{new Date().toLocaleDateString()}</span><br />
              <span>{resurtidoFiltrado.length} artículo(s) en lista</span>
            </div>
          </div>

          <table className="reportes-table">
            <thead>
              <tr>
                <th className="check-col">Listo</th>
                <th>Código</th>
                <th>Producto / Novedad</th>
                <th>Proveedor Habitual</th>
                <th>Ubicación / Nota</th>
                <th style={{ textAlign: 'center' }}>Stock Actual</th>
                <th style={{ textAlign: 'center' }}>Mínimo</th>
                <th style={{ textAlign: 'center', color: '#0284c7' }}>Comprar Sugerido</th>
                <th style={{ textAlign: 'right' }}>Costo Estimado</th>
                <th className="no-print" style={{ textAlign: 'center', width: '60px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {resurtidoFiltrado.map((prod) => {
                const keyId = prod.esManual ? `MAN_${prod.id}` : `PROD_${prod.id}`;
                const stock = parseFloat(prod.invActual) || 0;
                const min = parseFloat(prod.invMinimo) || 5;
                const sugeridoPorDefecto = prod.esManual ? min : Math.max(1, min * 2 - stock);
                const cantidadFinal = cantidadesResurtido[keyId] !== undefined ? cantidadesResurtido[keyId] : sugeridoPorDefecto;
                const subCosto = cantidadFinal * (parseFloat(prod.costo) || 0);

                return (
                  <tr key={keyId} style={{ backgroundColor: prod.esManual ? '#eff6ff' : 'transparent' }}>
                    <td className="check-col">
                      <span className="check-box-print"></span>
                    </td>
                    <td>
                      {prod.esManual ? (
                        <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '11px' }}>[ENCARGO]</span>
                      ) : (
                        <code>{prod.codigoBarras || 'S/N'}</code>
                      )}
                    </td>
                    <td>
                      <strong>{prod.nombre}</strong>
                      {prod.esManual && prod.nota_manual && (
                        <span style={{ display: 'block', fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                          Nota: {prod.nota_manual}
                        </span>
                      )}
                    </td>
                    <td>{prod.proveedor_nombre}</td>
                    <td>{prod.locacion || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: prod.esManual ? '#2563eb' : stock <= 0 ? '#dc2626' : '#d97706' }}>
                      {prod.esManual ? 'Nuevo (0)' : stock <= 0 ? 'AGOTADO (0)' : `${stock} pzs`}
                    </td>
                    <td style={{ textAlign: 'center' }}>{prod.esManual ? '—' : `${min} pzs`}</td>
                    
                    {/* Celda editable de cantidad a surtir */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="input-cant-resurtido"
                        value={cantidadesResurtido[keyId] !== undefined ? cantidadesResurtido[keyId] : sugeridoPorDefecto}
                        onChange={(e) => manejarCambioCantidadResurtido(keyId, e.target.value)}
                      />
                      <span className="print-cant-resurtido">+{cantidadFinal} pzs</span>
                    </td>

                    {/* Costo estimado recalculado en vivo */}
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {subCosto > 0 ? `$${subCosto.toFixed(2)}` : '—'}
                    </td>

                    <td className="no-print" style={{ textAlign: 'center' }}>
                      {prod.esManual ? (
                        <button 
                          type="button"
                          className="btn-action delete" 
                          onClick={() => eliminarEncargoManual(prod.id, prod.nombre)} 
                          title="Eliminar encargo ya comprado o cancelado"
                        >
                          🗑️
                        </button>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {resurtidoFiltrado.length === 0 && (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '35px', color: '#16a34a', fontWeight: 'bold' }}>
                    ✅ ¡Excelente! No hay productos en nivel crítico de inventario ni encargos pendientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL ANOTAR ENCARGO / NOVEDAD */}
      {mostrarModalEncargo && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <div className="modal-header">
              <h2>+ ANOTAR ENCARGO / PRODUCTO A BUSCAR</h2>
              <button className="btn-close-modal" onClick={() => setMostrarModalEncargo(false)}>✕</button>
            </div>
            <form onSubmit={guardarEncargoManual} className="modal-body">
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Anota artículos que hayan pedido los clientes o material nuevo que te interese comprar en tu próxima visita a proveedores.
              </p>

              <div className="field-group" style={{ marginTop: '10px' }}>
                <label>Nombre del Producto / Novedad:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cartulina dorada metálica, plumas de gel..."
                  value={datosEncargo.nombre}
                  onChange={(e) => setDatosEncargo({ ...datosEncargo, nombre: e.target.value })}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="field-group">
                  <label>Cantidad a Surtir:</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={datosEncargo.cantidad}
                    onChange={(e) => setDatosEncargo({ ...datosEncargo, cantidad: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>Costo Estimado ($):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Opcional"
                    value={datosEncargo.costo_estimado}
                    onChange={(e) => setDatosEncargo({ ...datosEncargo, costo_estimado: e.target.value })}
                  />
                </div>
              </div>

              <div className="field-group">
                <label>Proveedor sugerido / Dónde comprarlo:</label>
                <select 
                  value={datosEncargo.proveedor_id} 
                  onChange={(e) => setDatosEncargo({ ...datosEncargo, proveedor_id: e.target.value })}
                >
                  <option value="">-- General / Sin asignar --</option>
                  {proveedores.map((pr) => (
                    <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label>Nota / Quién lo pidió:</label>
                <input
                  type="text"
                  placeholder="Ej. Encargo de la Prof. Carmen de la primaria..."
                  value={datosEncargo.nota}
                  onChange={(e) => setDatosEncargo({ ...datosEncargo, nota: e.target.value })}
                />
              </div>

              <div className="modal-footer" style={{ marginTop: '10px' }}>
                <button type="button" className="btn-cancel-modal" onClick={() => setMostrarModalEncargo(false)}>Cancelar</button>
                <button type="submit" className="btn-confirm-modal">+ Guardar en Lista</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETALLE, REIMPRESIÓN Y CANCELACIÓN DE VENTA */}
      {tipoModal === 'reimprimir_venta' && elementoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal-content modal-cotizacion-content">
            <div className="modal-header">
              <h2>DETALLE / REIMPRESIÓN: {elementoSeleccionado.folio}</h2>
              <button className="btn-close-modal" onClick={() => setTipoModal(null)}>✕</button>
            </div>
            <div className="modal-body ticket-preview">
              <div className="nota-carta-container">
                <div className="nota-carta-header">
                  <div className="nota-carta-empresa">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {datosEmpresa.logo && (
                        <img src={datosEmpresa.logo} alt="Logo" style={{ maxHeight: '38px', maxWidth: '90px', objectFit: 'contain' }} />
                      )}
                      <div>
                        <h2>{datosEmpresa.nombre || 'PAPELERÍA ASADEL'}</h2>
                        {datosEmpresa.sucursal && <p style={{ fontWeight: 'bold' }}>{datosEmpresa.sucursal}</p>}
                      </div>
                    </div>
                    {datosEmpresa.direccion && <p>{datosEmpresa.direccion}</p>}
                    {datosEmpresa.telefono && <p>Tel / WhatsApp: <strong>{datosEmpresa.telefono}</strong></p>}
                  </div>
                  <div className="nota-carta-datos-folio">
                    <strong>COMPROBANTE DE VENTA</strong><br />
                    <span><strong>Folio:</strong> {elementoSeleccionado.folio}</span><br />
                    <span><strong>Fecha:</strong> {formatearFechaHoraLegible(elementoSeleccionado.fecha_hora)}</span><br />
                    <span><strong>Atendido por:</strong> {elementoSeleccionado.cajero}</span>
                    {elementoSeleccionado.cliente_nombre && (
                      <><br /><span><strong>Cliente:</strong> {elementoSeleccionado.cliente_nombre}</span></>
                    )}
                    {elementoSeleccionado.estado === 'cancelada' && (
                      <><br /><strong style={{ color: '#dc2626' }}>ESTADO: CANCELADA</strong></>
                    )}
                  </div>
                </div>

                <table className="nota-carta-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '45px' }}>Cant</th>
                      <th>Descripción</th>
                      <th style={{ textAlign: 'right', width: '85px' }}>P. Unit</th>
                      <th style={{ textAlign: 'right', width: '60px' }}>Desc.</th>
                      <th style={{ textAlign: 'right', width: '90px' }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(elementoSeleccionado.items || []).map((it, idx) => {
                      const pUnit = it.precio_aplicado ?? it.precioUnitario ?? 0;
                      const desc = it.descuento_porcentaje ?? it.descuento ?? 0;
                      const cantIt = parseFloat(it.cantidad) || 0;
                      const sub = (pUnit * cantIt) * (1 - desc / 100);

                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{cantIt}</td>
                          <td>
                            <strong>{it.nombre || 'Artículo'}</strong>
                            {it.comentario && (
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                                Nota: {it.comentario}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>${pUnit.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{desc ? `${desc}%` : '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${sub.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="nota-carta-totales">
                  <table className="nota-carta-totales-tabla">
                    <tbody>
                      <tr>
                        <td>Total Artículos:</td>
                        <td>{(elementoSeleccionado.items || []).reduce((acc, it) => acc + (parseFloat(it.cantidad) || 0), 0)}</td>
                      </tr>
                      {elementoSeleccionado.puntos_canjeados > 0 && (
                        <tr>
                          <td>Descuento Puntos:</td>
                          <td style={{ color: '#16a34a' }}>-${parseFloat(elementoSeleccionado.puntos_canjeados).toFixed(2)}</td>
                        </tr>
                      )}
                      {elementoSeleccionado.monto_efectivo > 0 && (
                        <tr>
                          <td>Efectivo:</td>
                          <td>${elementoSeleccionado.monto_efectivo.toFixed(2)}</td>
                        </tr>
                      )}
                      {elementoSeleccionado.monto_tarjeta > 0 && (
                        <tr>
                          <td>Tarjeta:</td>
                          <td>${elementoSeleccionado.monto_tarjeta.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="nota-carta-total-destacado">
                        <td>TOTAL:</td>
                        <td>${elementoSeleccionado.total.toFixed(2)} MXN</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="nota-carta-footer">
                  <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>
                    {datosEmpresa.mensaje_ticket || '¡Gracias por su compra y preferencia!'}
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer no-print">
              <button className="btn-cancel-modal" onClick={() => setTipoModal(null)}>Cerrar</button>
              {elementoSeleccionado.estado !== 'cancelada' && (
                <button 
                  type="button"
                  style={{
                    marginRight: 'auto',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  onClick={() => cancelarVentaSeleccionada(elementoSeleccionado.id)}
                >
                  ❌ Cancelar / Devolver Venta
                </button>
              )}
              <button className="btn-confirm-modal" onClick={() => window.print()}>🖨️ Imprimir Copia</button>
            </div>
          </div>
        </div>
      )}

      {/* ARQUEO DE CAJA */}
      {tipoModal === 'ver_corte' && elementoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal-content modal-corte-content">
            <div className="modal-header">
              <h2>ARQUEO REGISTRADO: {elementoSeleccionado.folio}</h2>
              <button className="btn-close-modal" onClick={() => setTipoModal(null)}>✕</button>
            </div>
            <div className="modal-body corte-print-container">
              <div className="nota-carta-header">
                <div className="nota-carta-empresa">
                  <h2>{datosEmpresa.nombre || 'PAPELERÍA ASADEL'}</h2>
                  <p>Comprobante de Corte de Caja</p>
                </div>
                <div className="nota-carta-datos-folio">
                  <strong>{elementoSeleccionado.folio}</strong><br />
                  <span>{formatearFechaHoraLegible(elementoSeleccionado.fecha_hora)}</span><br />
                  <span>Cajero: {elementoSeleccionado.cajero}</span>
                </div>
              </div>

              <div className="corte-resumen-grid">
                <div className="corte-stat">
                  <span>Ventas Efectivo:</span>
                  <strong>${elementoSeleccionado.total_ventas_efectivo.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Ventas Tarjeta:</span>
                  <strong>${elementoSeleccionado.total_ventas_tarjeta.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Entradas Extra:</span>
                  <strong style={{ color: '#0284c7' }}>+${elementoSeleccionado.total_entradas.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Salidas/Gastos:</span>
                  <strong style={{ color: '#dc2626' }}>-${elementoSeleccionado.total_salidas.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Saldo Esperado:</span>
                  <strong>${elementoSeleccionado.saldo_esperado.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Dinero Contado:</span>
                  <strong style={{ fontSize: '17px', color: '#16a34a' }}>${elementoSeleccionado.saldo_declarado.toFixed(2)}</strong>
                </div>
              </div>

              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                <strong>Observaciones:</strong> {elementoSeleccionado.observaciones || 'Sin notas adicionales.'}
              </div>
            </div>
            <div className="modal-footer no-print">
              <button className="btn-cancel-modal" onClick={() => setTipoModal(null)}>Cerrar</button>
              <button className="btn-confirm-modal" onClick={() => window.print()}>🖨️ Imprimir Copia de Corte</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}