import React, { useState, useEffect } from 'react';
import logoDefault from '../assets/Logo.jpg';
import './Dashboard.css';
import { API_URL } from '../config';

export default function Dashboard({ cambiarModulo }) {
  const [resumen, setResumen] = useState({
    ventasDia: 0,
    ticketsDia: 0,
    devoluciones: 0,
    totalEntradas: 0,
    totalSalidas: 0,
    dineroCaja: 0
  });

  const [fondoCajaFisico, setFondoCajaFisico] = useState(0);
  const [inventarioBajo, setInventarioBajo] = useState([]);
  
  const [usuarioActivo] = useState(() => {
    const sesion = localStorage.getItem('asadel_usuario_sesion');
    return sesion ? JSON.parse(sesion) : { nombre: 'Administrador', rol: 'admin' };
  });
  const [departamentosData, setDepartamentosData] = useState([]);

  // Estados para datos dinámicos de Empresa y Sucursal
  const [datosEmpresa, setDatosEmpresa] = useState({
    nombre: 'PAPELERÍA ASADEL',
    sucursal: 'Sucursal Centro',
    logo: ''
  });

  // Estados para el Cierre de Caja Asadel
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false);
  const [cierreForm, setCierreForm] = useState({
    cajaInicial: 0,
    billetes: '',
    morralla: ''
  });

  const [datosCorteSistema, setDatosCorteSistema] = useState({
    ventasEfectivo: 0,
    ventasTarjeta: 0,
    ventasVales: 0,
    ventasCodi: 0,
    totalVentas: 0,
    ticketsTotal: 0,
    totalEntradas: 0,
    totalSalidas: 0,
    saldoEsperado: 0
  });

  const obtenerFondoActual = () => {
    const fechaISO = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    return parseFloat(localStorage.getItem(`caja_abierta_${fechaISO}`)) || 0;
  };

  const cargarResumenDashboard = async () => {
    try {
      const [resDash, resBalance, resEmpresa] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/resumen`),
        fetch(`${API_URL}/api/corte-caja/balance-actual`),
        fetch(`${API_URL}/api/empresa`)
      ]);

      if (resDash.ok) {
        const data = await resDash.json();
        setResumen({
          ventasDia: data.ventasDia || 0,
          ticketsDia: data.ticketsDia || 0,
          devoluciones: data.devoluciones || 0,
          totalEntradas: data.totalEntradas || 0,
          totalSalidas: data.totalSalidas || 0,
          dineroCaja: data.dineroCaja || 0
        });
        setInventarioBajo(data.inventarioBajo || []);
        setDepartamentosData(data.departamentosResumen || []);
      }

      if (resBalance.ok) {
        const dataBalance = await resBalance.json();
        setDatosCorteSistema(dataBalance);
      }

      if (resEmpresa.ok) {
        const dataEmp = await resEmpresa.json();
        if (dataEmp && dataEmp.nombre) {
          setDatosEmpresa(dataEmp);
          if (dataEmp.logo) {
            setLogoEmpresa(dataEmp.logo);
          }
        }
      }

      setFondoCajaFisico(obtenerFondoActual());
    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err);
    }
  };

  useEffect(() => {
    cargarResumenDashboard();
  }, []);

  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const fechaCorta = new Date().toLocaleDateString('es-MX');
  const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const entradasExtra = Math.max(0, resumen.totalEntradas - fondoCajaFisico);

  // --- MATEMÁTICAS DEL CIERRE ASADEL ---
  const numCajaInicial = parseFloat(cierreForm.cajaInicial) || 0;
  const numBilletes = parseFloat(cierreForm.billetes) || 0;
  const numMorralla = parseFloat(cierreForm.morralla) || 0;

  const totalFisicoCaja = numBilletes + numMorralla;
  const ventasAsadel = totalFisicoCaja > 0 ? (totalFisicoCaja - numCajaInicial) : 0;
  const gananciaEstimada = ventasAsadel * 0.53;
  const cajaFondoManana = numMorralla;

  const diferenciaSistemaVsFisico = totalFisicoCaja > 0 ? (totalFisicoCaja - resumen.dineroCaja) : 0;

  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [cierreGuardadoOK, setCierreGuardadoOK] = useState(false);
  const [logoEmpresa, setLogoEmpresa] = useState(logoDefault);

  useEffect(() => {
    const logoActual = localStorage.getItem('asadel_logo_temp');
    if (logoActual) setLogoEmpresa(logoActual);
    
    const escucharCambioEmpresa = () => {
      cargarResumenDashboard();
      const logoNuevo = localStorage.getItem('asadel_logo_temp');
      if (logoNuevo) setLogoEmpresa(logoNuevo);
    };
    window.addEventListener('empresa-actualizada', escucharCambioEmpresa);
    return () => window.removeEventListener('empresa-actualizada', escucharCambioEmpresa);
  }, []);

  const guardarCierreAsadel = async () => {
    if (totalFisicoCaja <= 0) return alert('No puedes guardar un corte en ceros.');

    setGuardandoCierre(true);

    const payload = {
      caja_inicial: numCajaInicial,
      billetes: numBilletes,
      morralla: numMorralla,
      total_fisico: totalFisicoCaja,
      ventas_dia: ventasAsadel,
      ganancia_estimada: gananciaEstimada
    };

    try {
      const res = await fetch(`${API_URL}/api/cierre-global`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('✅ ¡Cierre Z (Global) guardado exitosamente!');
        
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('caja_abierta')) {
            localStorage.removeItem(key);
          }
        });

        setFondoCajaFisico(0);
        setCierreGuardadoOK(true);
        await cargarResumenDashboard();
      } else {
        alert('Error al guardar el corte de caja general.');
      }
    } catch {
      alert('Error de conexión al guardar el corte.');
    } finally {
      setGuardandoCierre(false);
    }
  };

  const abrirModalCierre = async () => {
    await cargarResumenDashboard();
    const fondoGuardado = obtenerFondoActual();

    setCierreForm({ cajaInicial: fondoGuardado, billetes: '', morralla: '' });
    setCierreGuardadoOK(false);
    setModalCierreAbierto(true);
  };

  return (
    <div className="dash-container">
      <header className="dash-header">
        <div className="dash-branding">
          <img src={logoEmpresa} alt="Logo ASADEL" style={{ height: '32px' }} />
          <h2>{datosEmpresa.sucursal ? datosEmpresa.sucursal.toUpperCase() : 'SUCURSAL PRINCIPAL'}</h2>
        </div>
        <div className="dash-user-info">
          <span>[ Hola, {usuarioActivo.nombre} ({usuarioActivo.rol === 'admin' ? 'Admin' : 'Cajero'}) ]</span>
        </div>
      </header>

      <div className="dash-section">
        <div className="dash-section-title">
          RESUMEN DEL DÍA: {fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)}
        </div>

        <div className="dash-card-grid">
          <div className="dash-stat-card">
            <span>Efectivo en Caja</span>
            <h3 style={{ color: '#16a34a' }}>${resumen.dineroCaja.toFixed(2)}</h3>
          </div>
          <div className="dash-stat-card">
            <span>Ventas del Día</span>
            <h3>${resumen.ventasDia.toFixed(2)}</h3>
          </div>
          <div className="dash-stat-card">
            <span>Ganancia Estimada</span>
            <h3 style={{ color: '#059669' }}>
              ${(resumen.ventasDia * 0.53).toFixed(2)}
            </h3>
          </div>
          <div className="dash-stat-card">
            <span>Fondo Inicial</span>
            <h3 style={{ color: '#0284c7' }}>${fondoCajaFisico.toFixed(2)}</h3>
          </div>
          <div className="dash-stat-card">
            <span>Entradas Extra</span>
            <h3 style={{ color: '#3b82f6' }}>+${entradasExtra.toFixed(2)}</h3>
          </div>
          <div className="dash-stat-card">
            <span>Salidas / Gastos</span>
            <h3 style={{ color: '#dc2626' }}>-${resumen.totalSalidas.toFixed(2)}</h3>
          </div>
          <div className="dash-stat-card">
            <span>Tickets Emitidos</span>
            <h3 style={{ color: '#6366f1' }}>{resumen.ticketsDia}</h3>
          </div>
          <div className="dash-stat-card">
            <span>Devoluciones</span>
            <h3 style={{ color: resumen.devoluciones > 0 ? '#dc2626' : '#94a3b8' }}>
              {resumen.devoluciones}
            </h3>
          </div>
        </div>
      </div>

      <div className="dash-bottom-grid">
        <div className="dash-box">
          <div className="dash-section-title" style={{ borderBottom: 'none', margin: 0, padding: 0 }}>
            ACCESOS RÁPIDOS
          </div>
          <div className="dash-quick-actions-list">
            <button className="dash-btn-quick" onClick={() => cambiarModulo('caja')}>
              🛒 [ IR AL PUNTO DE VENTA (F1) ]
            </button>
            <button className="dash-btn-quick" onClick={() => cambiarModulo('productos')}>
              📦 [ GESTIÓN Y NUEVO PRODUCTO ]
            </button>
            <button className="dash-btn-quick" onClick={() => cambiarModulo('reportes')}>
              📊 [ HISTORIAL Y REPORTES AVANZADOS ]
            </button>

            <button
              className="dash-btn-quick"
              style={{ backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#0f172a' }}
              onClick={abrirModalCierre}
            >
              🖨️ [ CIERRE DE CAJA ASADEL (CORTE Z) ]
            </button>
          </div>
        </div>

        <div className="dash-box">
          <div className="dash-section-title" style={{ borderBottom: 'none', margin: 0, padding: 0, color: '#dc2626' }}>
            ALERTAS IMPORTANTES (Inventario Bajo)
          </div>
          <div className="dash-alert-list" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {inventarioBajo.length > 0 ? (
              inventarioBajo.map((prod) => (
                <div key={prod.id} className="dash-alert-item">
                  <span>[!] {prod.nombre}</span>
                  <strong>Stock: {prod.invActual} pz(s)</strong>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px', padding: '10px 0' }}>
                No hay alertas de inventario bajo por el momento.
              </div>
            )}
          </div>
        </div>

        <div className="dash-box">
          <div className="dash-section-title" style={{ borderBottom: 'none', margin: 0, padding: 0, color: '#0f172a' }}>
            RESUMEN DE DEPARTAMENTOS
          </div>
          <div className="dash-dept-list">
            {departamentosData.length > 0 ? (
              departamentosData.map((d, i) => (
                <div key={i} className="dash-dept-item">
                  <span>{d.nombre}</span>
                  <span className="dash-dept-badge">{d.totalProductos} productos</span>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px', padding: '10px 0' }}>
                No hay departamentos registrados aún.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL CORTE Z CON RESUMEN DE CORTE DE CAJA INTEGRADO */}
      {modalCierreAbierto && (
        <div className="dash-modal-overlay">
          <div className="dash-modal-content" style={{ maxWidth: '820px' }}>
            <div className="dash-modal-header no-print">
              <h2>CORTE Z: CIERRE DE CAJA DEL DÍA</h2>
              <button className="dash-btn-close" onClick={() => setModalCierreAbierto(false)}>✕</button>
            </div>

            <div className="dash-modal-body">
              <div className="cierre-calculadora no-print">
                <h3>📊 Balance del Sistema</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <div>Ventas Efectivo: <strong>${datosCorteSistema.ventasEfectivo.toFixed(2)}</strong></div>
                  <div>Ventas Tarjeta: <strong>${datosCorteSistema.ventasTarjeta.toFixed(2)}</strong></div>
                  <div>Fondo Apertura: <strong style={{ color: '#0284c7' }}>${numCajaInicial.toFixed(2)}</strong></div>
                  <div>Salidas / Gastos: <strong style={{ color: '#dc2626' }}>-${datosCorteSistema.totalSalidas.toFixed(2)}</strong></div>
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '2px' }}>
                    Efectivo Esperado en Cajón: <strong style={{ color: '#16a34a', fontSize: '14px' }}>${resumen.dineroCaja.toFixed(2)}</strong>
                  </div>
                </div>

                <h4 style={{ fontSize: '13px', color: '#0f172a', margin: '14px 0 6px 0' }}>Suma Física en Cajón:</h4>
                <div className="cierre-grid-inputs">
                  <div className="cierre-input-group">
                    <label>💵 Billetes ($):</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Total billetes"
                      value={cierreForm.billetes}
                      onChange={(e) => setCierreForm({ ...cierreForm, billetes: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="cierre-input-group">
                    <label>🪙 Morralla ($):</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Total monedas"
                      value={cierreForm.morralla}
                      onChange={(e) => setCierreForm({ ...cierreForm, morralla: e.target.value })}
                    />
                  </div>
                </div>

                {totalFisicoCaja > 0 && (
                  <div style={{ marginTop: '12px', padding: '10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', backgroundColor: diferenciaSistemaVsFisico === 0 ? '#dcfce7' : diferenciaSistemaVsFisico > 0 ? '#e0f2fe' : '#fee2e2', color: diferenciaSistemaVsFisico === 0 ? '#166534' : diferenciaSistemaVsFisico > 0 ? '#0369a1' : '#991b1b' }}>
                    {diferenciaSistemaVsFisico === 0 
                      ? '✅ La caja está cuadrada con el sistema' 
                      : diferenciaSistemaVsFisico > 0 
                      ? `🔼 Sobrante físico: +$${diferenciaSistemaVsFisico.toFixed(2)}` 
                      : `⚠ Faltante físico: -$${Math.abs(diferenciaSistemaVsFisico).toFixed(2)}`}
                  </div>
                )}
              </div>

              <div className="ticket-cierre-dia">
                <h3>{datosEmpresa.nombre || 'PAPELERÍA ASADEL'}</h3>
                <p style={{ textAlign: 'center' }}>*** CIERRE DE CAJA DEL DÍA (CORTE Z) ***</p>
                <div className="ticket-divider"></div>
                <p><strong>Fecha:</strong> {fechaCorta}</p>
                <p><strong>Hora:</strong> {horaActual}</p>

                <div className="ticket-divider"></div>
                <p style={{ textAlign: 'center', fontWeight: 'bold' }}>VENTAS SEGÚN SISTEMA</p>
                <div className="ticket-row">
                  <span>Ventas en Efectivo:</span>
                  <span>${datosCorteSistema.ventasEfectivo.toFixed(2)}</span>
                </div>
                <div className="ticket-row">
                  <span>Ventas con Tarjeta:</span>
                  <span>${datosCorteSistema.ventasTarjeta.toFixed(2)}</span>
                </div>
                <div className="ticket-row bold">
                  <span>Total Ventas Sistema:</span>
                  <span>${datosCorteSistema.totalVentas.toFixed(2)}</span>
                </div>

                <div className="ticket-divider"></div>
                <p style={{ textAlign: 'center', fontWeight: 'bold' }}>MOVIMIENTOS DE CAJÓN</p>
                <div className="ticket-row">
                  <span>(+) Fondo de Apertura:</span>
                  <span>${numCajaInicial.toFixed(2)}</span>
                </div>
                <div className="ticket-row">
                  <span>(+) Entradas Extra:</span>
                  <span>+${entradasExtra.toFixed(2)}</span>
                </div>
                <div className="ticket-row">
                  <span>(-) Gastos / Salidas:</span>
                  <span>-${datosCorteSistema.totalSalidas.toFixed(2)}</span>
                </div>
                <div className="ticket-row bold">
                  <span>Efectivo Esperado:</span>
                  <span>${resumen.dineroCaja.toFixed(2)}</span>
                </div>

                <div className="ticket-divider"></div>
                <p style={{ textAlign: 'center', fontWeight: 'bold' }}>CONTEO FÍSICO ARQUEO</p>
                <div className="ticket-row">
                  <span>Billetes:</span>
                  <span>${numBilletes.toFixed(2)}</span>
                </div>
                <div className="ticket-row">
                  <span>Morralla (Fondo Mañana):</span>
                  <span>${numMorralla.toFixed(2)}</span>
                </div>
                <div className="ticket-row bold" style={{ marginTop: '4px' }}>
                  <span>TOTAL FÍSICO CONTADO:</span>
                  <span>${totalFisicoCaja.toFixed(2)}</span>
                </div>

                <div className="ticket-divider"></div>
                <p style={{ textAlign: 'center', fontWeight: 'bold' }}>LIQUIDACIÓN ASADEL</p>
                <div className="ticket-row bold" style={{ color: '#0284c7' }}>
                  <span>Ventas Netas del Día:</span>
                  <span>${ventasAsadel.toFixed(2)}</span>
                </div>
                <div className="ticket-row bold" style={{ color: '#dc2626' }}>
                  <span>Caja de Fondo (Mañana):</span>
                  <span>${cajaFondoManana.toFixed(2)}</span>
                </div>
                <div className="ticket-row bold" style={{ color: '#16a34a', fontSize: '15px', marginTop: '4px' }}>
                  <span>Ganancia Neta (53%):</span>
                  <span>${gananciaEstimada.toFixed(2)}</span>
                </div>

                <div className="ticket-divider"></div>
                <p style={{ textAlign: 'center', fontSize: '11px', marginTop: '8px' }}>
                  Comprobante diario de cierre de caja y arqueo general.
                </p>
              </div>
            </div>
            
            <div className="dash-modal-footer no-print">
              <button className="dash-btn-cancel" onClick={() => setModalCierreAbierto(false)}>Cerrar</button>

              {!cierreGuardadoOK ? (
                <button
                  className="dash-btn-print"
                  onClick={guardarCierreAsadel}
                  disabled={totalFisicoCaja === 0 || guardandoCierre}
                  style={{ backgroundColor: '#16a34a' }}
                >
                  {guardandoCierre ? 'Guardando...' : '💾 Guardar en Historial'}
                </button>
              ) : (
                <button
                  className="dash-btn-print"
                  onClick={() => window.print()}
                >
                  🖨️ Imprimir Ticket de Cierre
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}