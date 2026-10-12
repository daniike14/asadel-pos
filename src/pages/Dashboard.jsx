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

  const [inventarioBajo, setInventarioBajo] = useState([]);
  const [departamentosData, setDepartamentosData] = useState([]);

  // Estados para el Cierre de Caja Asadel
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false);
  const [cierreForm, setCierreForm] = useState({
    cajaInicial: '',
    billetes: '',
    morralla: ''
  });

  const cargarResumenDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/resumen`);
      if (res.ok) {
        const data = await res.json();
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

  // --- MATEMÁTICAS DEL CIERRE ASADEL ---
  const numCajaInicial = parseFloat(cierreForm.cajaInicial) || 0;
  const numBilletes = parseFloat(cierreForm.billetes) || 0;
  const numMorralla = parseFloat(cierreForm.morralla) || 0;

  const totalFisicoCaja = numBilletes + numMorralla;
  // Ventas del Día según fórmula de Asadel: Total Físico - Caja Inicial
  const ventasAsadel = totalFisicoCaja > 0 ? (totalFisicoCaja - numCajaInicial) : 0;
  // Ganancia estimada al 53% de las ventas
  const gananciaEstimada = ventasAsadel * 0.53;
  // La caja de fondo para mañana es la misma morralla de hoy
  const cajaFondoManana = numMorralla;


  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [cierreGuardadoOK, setCierreGuardadoOK] = useState(false);
  const [logoEmpresa, setLogoEmpresa] = useState(logoDefault);
  useEffect(() => {
    const logoActual = localStorage.getItem('asadel_logo_temp');
    if (logoActual) setLogoEmpresa(logoActual);
    
    const escucharCambioEmpresa = () => {
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
      cajero: 'Corte General (Z)',
      ventasEfectivo: ventasAsadel, // Usamos la métrica de ventas físicas de tu papá
      ventasTarjeta: resumen.ventasDia - ventasAsadel, // Diferencia teórica (opcional)
      ventasVales: 0,
      ventasCodi: 0,
      totalEntradas: numCajaInicial,
      totalSalidas: gananciaEstimada, // Guardamos la ganancia aquí como referencia
      saldoEsperado: resumen.dineroCaja,
      saldoDeclarado: totalFisicoCaja,
      diferencia: totalFisicoCaja - resumen.dineroCaja,
      observaciones: `Caja Inicial: $${numCajaInicial} | Billetes: $${numBilletes} | Morralla/Fondo Manana: $${numMorralla} | Ganancia 53%: $${gananciaEstimada.toFixed(2)}`
    };

    try {
      const res = await fetch(`${API_URL}/api/corte-caja`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('✅ ¡Cierre de Día guardado en el historial exitosamente!');
        setCierreGuardadoOK(true); // Cambia el estado para ocultar el botón de guardar
        cargarResumenDashboard(); // Recarga los números para que todo vuelva a cero
      } else {
        alert('Error al guardar el corte de caja general.');
      }
    } catch {
      alert('Error de conexión al guardar el corte.');
    } finally {
      setGuardandoCierre(false);
    }
  };


const abrirModalCierre = () => {
    // Buscamos si hubo una apertura de caja hoy para auto-llenarlo
    const fechaHoyLocal = new Date().toLocaleDateString();
    const fondoGuardado = localStorage.getItem(`caja_abierta_${fechaHoyLocal}`) || '0';

    // Al abrir, limpiamos el formulario de billetes, pero pre-cargamos la caja inicial
    setCierreForm({ cajaInicial: fondoGuardado, billetes: '', morralla: '' });
    setCierreGuardadoOK(false);
    setModalCierreAbierto(true);
  };

  return (
    <div className="dash-container">
      <header className="dash-header">
        <div className="dash-branding">
          <img src={logoEmpresa} alt="Logo ASADEL" style={{ height: '32px' }} />
          <h2>SUCURSAL CENTRO</h2>
        </div>
        <div className="dash-user-info">
          <span>[ Hola, Administrador (Turno 1) ]</span>
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
            <span>Entradas / Fondo</span>
            <h3 style={{ color: '#0284c7' }}>+${resumen.totalEntradas.toFixed(2)}</h3>
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

      {/* =========================================================
          MODAL DE CIERRE DE CAJA ASADEL (CORTE Z)
          ========================================================= */}
      {modalCierreAbierto && (
        <div className="dash-modal-overlay">
          <div className="dash-modal-content">
            <div className="dash-modal-header no-print">
              <h2>CORTE Z: CIERRE DE CAJA (ASADEL)</h2>
              <button className="dash-btn-close" onClick={() => setModalCierreAbierto(false)}>✕</button>
            </div>

            <div className="dash-modal-body">
              {/* IZQUIERDA: Calculadora de Arqueo */}
              <div className="cierre-calculadora no-print">
                <h3>📊 Calculadora de Conteo</h3>

                <div className="cierre-grid-inputs">
                  <div className="cierre-input-group">
                    <label>Caja de Inicio ($):</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Con lo que iniciaste..."
                      value={cierreForm.cajaInicial}
                      onChange={(e) => setCierreForm({ ...cierreForm, cajaInicial: e.target.value })}
                      autoFocus
                    />
                  </div>
                </div>

                <h4 style={{ fontSize: '13px', color: '#0f172a', margin: '15px 0 8px 0' }}>Suma Física en Caja:</h4>
                <div className="cierre-grid-inputs">
                  <div className="cierre-input-group">
                    <label>💵 Billetes ($):</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Suma total billetes"
                      value={cierreForm.billetes}
                      onChange={(e) => setCierreForm({ ...cierreForm, billetes: e.target.value })}
                    />
                  </div>
                  <div className="cierre-input-group">
                    <label>🪙 Morralla ($):</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Suma total monedas"
                      value={cierreForm.morralla}
                      onChange={(e) => setCierreForm({ ...cierreForm, morralla: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '20px', padding: '12px', background: '#fef3c7', borderRadius: '6px', border: '1px solid #fde68a' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>
                    <strong>Nota:</strong> Los datos que ingreses aquí se imprimirán en el ticket de la derecha para tu control en papel.
                  </p>
                </div>
              </div>

              {/* DERECHA: Ticket para imprimir */}
              <div className="ticket-cierre-dia">
                <h3>PAPELERÍA ASADEL</h3>
                <p style={{ textAlign: 'center' }}>*** CIERRE DE CAJA DEL DÍA ***</p>
                <div className="ticket-divider"></div>
                <p><strong>Fecha:</strong> {fechaCorta}</p>
                <p><strong>Hora:</strong> {horaActual}</p>

                <div className="ticket-divider"></div>
                <p style={{ textAlign: 'center', fontWeight: 'bold' }}>CONTEO FÍSICO</p>
                <div className="ticket-row">
                  <span>Caja Inicial:</span>
                  <span>${numCajaInicial.toFixed(2)}</span>
                </div>
                <div className="ticket-row">
                  <span>Billetes:</span>
                  <span>${numBilletes.toFixed(2)}</span>
                </div>
                <div className="ticket-row">
                  <span>Morralla:</span>
                  <span>${numMorralla.toFixed(2)}</span>
                </div>
                <div className="ticket-row bold" style={{ marginTop: '6px' }}>
                  <span>TOTAL EN CAJA:</span>
                  <span>${totalFisicoCaja.toFixed(2)}</span>
                </div>

                <div className="ticket-divider"></div>
                <p style={{ textAlign: 'center', fontWeight: 'bold' }}>RESULTADOS DEL DÍA</p>

                <div className="ticket-row bold" style={{ color: '#0284c7' }}>
                  <span>Ventas del Día:</span>
                  <span>${ventasAsadel.toFixed(2)}</span>
                </div>
                <div className="ticket-row bold" style={{ color: '#dc2626' }}>
                  <span>Caja de Fondo (Mañana):</span>
                  <span>${cajaFondoManana.toFixed(2)}</span>
                </div>

                <div className="ticket-divider"></div>
                <div className="ticket-row bold" style={{ color: '#16a34a', fontSize: '16px' }}>
                  <span>Ganancias (53%):</span>
                  <span>${gananciaEstimada.toFixed(2)}</span>
                </div>

                <div className="ticket-divider"></div>
                <p style={{ textAlign: 'center', fontSize: '11px', marginTop: '10px' }}>
                  (Cálculos basados en el conteo<br />físico ingresado por el administrador)
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
                  style={{ backgroundColor: '#16a34a' }} /* Verde para guardar */
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