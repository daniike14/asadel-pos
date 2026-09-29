import React, { useState, useEffect, useMemo } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './ReportesHistorial.css';
import { API_URL } from '../config';

// Auxiliar para obtener fecha YYYY-MM-DD local
const fechaAString = (fecha) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

export default function ReportesHistorial({ volverAlDashboard }) {
  const [pestañaActiva, setPestañaActiva] = useState('ventas'); // 'ventas', 'movimientos' o 'cortes'
  const [ventas, setVentas] = useState([]);
  const [cortes, setCortes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  
  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState('todos');
  const [tipoMovimientoFiltro, setTipoMovimientoFiltro] = useState('todos');
  const [rangoRapido, setRangoRapido] = useState('hoy');
  const [fechaInicio, setFechaInicio] = useState(fechaAString(new Date()));
  const [fechaFin, setFechaFin] = useState(fechaAString(new Date()));

  // Elemento modal
  const [elementoSeleccionado, setElementoSeleccionado] = useState(null);
  const [tipoModal, setTipoModal] = useState(null); // 'reimprimir_venta' o 'ver_corte'

  const cargarDatos = async () => {
    try {
      const [resVentas, resCortes, resMovs] = await Promise.all([
        fetch(`${API_URL}/api/reportes/ventas`),
        fetch(`${API_URL}/api/reportes/cortes`),
        fetch(`${API_URL}/api/movimientos-caja`)
      ]);

      if (resVentas.ok) setVentas(await resVentas.json());
      if (resCortes.ok) setCortes(await resCortes.json());
      if (resMovs.ok) setMovimientos(await resMovs.json());
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

    const d = new Date(fechaHoraStr);
    const fechaItem = fechaAString(d);

    if (fechaInicio && fechaFin) {
      return fechaItem >= fechaInicio && fechaItem <= fechaFin;
    }
    if (fechaInicio) return fechaItem >= fechaInicio;
    if (fechaFin) return fechaItem <= fechaFin;
    return true;
  };

  // Ventas filtradas
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

  // Movimientos filtrados
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

  // Cortes filtrados
  const cortesFiltrados = useMemo(() => {
    return cortes.filter((c) => {
      const coincideTexto = 
        c.folio?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        c.cajero?.toLowerCase().includes(filtroTexto.toLowerCase());

      const coincideFec = coincideFecha(c.fecha_hora);

      return coincideTexto && coincideFec;
    });
  }, [cortes, filtroTexto, fechaInicio, fechaFin]);

  // Métricas acumuladas
  const metricasVentas = useMemo(() => {
    const totalVentas = ventasFiltradas.reduce((acc, v) => acc + (v.total || 0), 0);
    const totalEfectivo = ventasFiltradas.reduce((acc, v) => acc + (v.monto_efectivo || 0), 0);
    const totalTarjeta = ventasFiltradas.reduce((acc, v) => acc + (v.monto_tarjeta || 0), 0);
    const tickets = ventasFiltradas.length;
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

  return (
    <div className="reportes-container">
      {/* Encabezado */}
      <header className="reportes-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src={logoAsadel} alt="Logo ASADEL" style={{ height: '30px' }} />
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
        </div>

        {volverAlDashboard && (
          <button className="btn-secondary" onClick={volverAlDashboard}>
            ⬅ Volver
          </button>
        )}
      </header>

      {/* Filtros */}
      <div className="reportes-filter-card">
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
                : "Filtrar cortes por folio o cajero..."
            }
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </div>
      </div>

      {/* Tarjetas de Métricas */}
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
            <span>Tickets</span>
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

      {/* Contenido: Tabla de Ventas (CORREGIDA LA CANTIDAD TOTAL DE PIEZAS) */}
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
                // Sumamos la cantidad total real de piezas vendidas en el ticket
                const totalPiezasVenta = (v.items || []).reduce((acc, it) => acc + (it.cantidad || 0), 0);

                return (
                  <tr key={v.id}>
                    <td><strong>{v.folio}</strong></td>
                    <td>{new Date(v.fecha_hora).toLocaleString()}</td>
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

      {/* Contenido: Tabla de Movimientos */}
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
                  <td>{new Date(m.fecha_hora).toLocaleString()}</td>
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

      {/* Contenido: Tabla de Cortes */}
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
                  <td>{new Date(c.fecha_hora).toLocaleString()}</td>
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

      {/* MODAL PARA REIMPRIMIR VENTA (CON PUNTOS Y CLIENTE) */}
      {tipoModal === 'reimprimir_venta' && elementoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal-content modal-cotizacion-content">
            <div className="modal-header">
              <h2>REIMPRESIÓN: {elementoSeleccionado.folio}</h2>
              <button className="btn-close-modal" onClick={() => setTipoModal(null)}>✕</button>
            </div>
            <div className="modal-body ticket-preview">
              <div className="nota-carta-container">
                <div className="nota-carta-header">
                  <div className="nota-carta-empresa">
                    <h2>PAPELERÍA ASADEL</h2>
                    <p>Copia de Nota de Venta</p>
                  </div>
                  <div className="nota-carta-datos-folio">
                    <strong>{elementoSeleccionado.folio}</strong><br />
                    <span>{new Date(elementoSeleccionado.fecha_hora).toLocaleString()}</span><br />
                    <span>Cajero: {elementoSeleccionado.cajero}</span>
                    {elementoSeleccionado.cliente_nombre && (
                      <><br /><span><strong>Cliente:</strong> {elementoSeleccionado.cliente_nombre}</span></>
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
                      const sub = (pUnit * it.cantidad) * (1 - desc / 100);

                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{it.cantidad}</td>
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
                        <td>{(elementoSeleccionado.items || []).reduce((acc, it) => acc + (it.cantidad || 0), 0)} pzs</td>
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
                        <td>TOTAL PAGADO:</td>
                        <td>${elementoSeleccionado.total.toFixed(2)} MXN</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {elementoSeleccionado.puntos_ganados > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12px', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
                    ¡Esta compra acumuló +{elementoSeleccionado.puntos_ganados} puntos de lealtad!
                  </div>
                )}

                <div className="nota-carta-footer">
                  <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>¡Gracias por su compra y preferencia!</p>
                  <p style={{ margin: 0 }}>Copia de comprobante emitido.</p>
                </div>
              </div>
            </div>
            <div className="modal-footer no-print">
              <button className="btn-cancel-modal" onClick={() => setTipoModal(null)}>Cerrar</button>
              <button className="btn-confirm-modal" onClick={() => window.print()}>🖨️ Imprimir Copia</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA VER DETALLE DE CORTE */}
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
                  <h2>PAPELERÍA ASADEL</h2>
                  <p>Comprobante de Corte de Caja</p>
                </div>
                <div className="nota-carta-datos-folio">
                  <strong>{elementoSeleccionado.folio}</strong><br />
                  <span>{new Date(elementoSeleccionado.fecha_hora).toLocaleString()}</span><br />
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