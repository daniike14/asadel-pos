import React, { useState, useEffect } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './Dashboard.css';

export default function Dashboard({ cambiarModulo }) {
  const [resumen, setResumen] = useState({
    ventasDia: 0,
    ticketsDia: 0,
    devoluciones: 0
  });
  const [inventarioBajo, setInventarioBajo] = useState([]);

  const cargarResumenDashboard = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/dashboard/resumen');
      if (res.ok) {
        const data = await res.json();
        setResumen({
          ventasDia: data.ventasDia,
          ticketsDia: data.ticketsDia,
          devoluciones: data.devoluciones
        });
        setInventarioBajo(data.inventarioBajo || []);
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

  return (
    <div className="dash-container">
      {/* Encabezado */}
      <header className="dash-header">
        <div className="dash-branding">
          <img src={logoAsadel} alt="Logo ASADEL" style={{ height: '32px' }} />
          <h2>SUCURSAL CENTRO</h2>
        </div>
        <div className="dash-user-info">
          <span>[ Hola, Administrador (Turno 1) ]</span>
        </div>
      </header>

      {/* Resumen del Día */}
      <div className="dash-section">
        <div className="dash-section-title">
          RESUMEN DEL DÍA: {fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)}
        </div>
        <div className="dash-card-grid">
          <div className="dash-stat-card">
            <span>Ventas del Día</span>
            <h3>${resumen.ventasDia.toFixed(2)}</h3>
          </div>
          <div className="dash-stat-card">
            <span>Tickets Emitidos</span>
            <h3 style={{ color: '#2563eb' }}>{resumen.ticketsDia}</h3>
          </div>
          <div className="dash-stat-card">
            <span>Devoluciones</span>
            <h3 style={{ color: '#dc2626' }}>{resumen.devoluciones}</h3>
          </div>
        </div>
      </div>

      {/* Accesos Rápidos y Alertas */}
      <div className="dash-bottom-grid">
        <div className="dash-box">
          <div className="dash-section-title" style={{ borderBottom: 'none', margin: 0, padding: 0 }}>
            ACCESOS RÁPIDOS
          </div>
          <div className="dash-quick-actions-list">
            <button className="dash-btn-quick" onClick={() => cambiarModulo('caja')}>
              🚀 [ IR AL PUNTO DE VENTA (F1) ]
            </button>
            <button className="dash-btn-quick" onClick={() => cambiarModulo('productos')}>
              📦 [ GESTIÓN Y NUEVO PRODUCTO ]
            </button>
            <button className="dash-btn-quick" onClick={() => alert('Generando corte de caja del turno...')}>
              💵 [ CORTE DE CAJA ]
            </button>
          </div>
        </div>

        <div className="dash-box">
          <div className="dash-section-title" style={{ borderBottom: 'none', margin: 0, padding: 0, color: '#dc2626' }}>
            ⚠️ ALERTAS IMPORTANTES (Inventario Bajo)
          </div>
          <div className="dash-alert-list">
            {inventarioBajo.length > 0 ? (
              inventarioBajo.map((prod) => (
                <div key={prod.id} className="dash-alert-item">
                  <span>[!] {prod.nombre}</span>
                  <strong>Stock: {prod.invActual} pz(s)</strong>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px', padding: '10px 0' }}>
                ✅ No hay alertas de inventario bajo por el momento.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}