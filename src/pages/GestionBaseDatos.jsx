import React, { useState, useEffect, useRef } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './GestionBaseDatos.css';
import { API_URL } from '../config';

export default function GestionBaseDatos({ volverAlDashboard }) {
  const [estado, setEstado] = useState({
    pesoMB: '0',
    conteo: { totalProductos: 0, totalVentas: 0, totalClientes: 0, totalRenglonesVenta: 0 },
    frecuencia: 'diario',
    ultimoRespaldo: null,
    respaldosLocales: []
  });
  const [frecuenciaSeleccionada, setFrecuenciaSeleccionada] = useState('diario');
  const [procesando, setProcesando] = useState(false);
  const fileInputDbRef = useRef(null);

  const cargarEstadoBD = async () => {
    try {
      const res = await fetch(`${API_URL}/api/backup/estado`);
      if (res.ok) {
        const data = await res.json();
        setEstado(data);
        setFrecuenciaSeleccionada(data.frecuencia || 'diario');
      }
    } catch (err) {
      console.error('Error al cargar estado de BD:', err);
    }
  };

  useEffect(() => {
    cargarEstadoBD();
  }, []);

  const descargarRespaldo = () => {
    window.location.href = `${API_URL}/api/backup/descargar`;
    setTimeout(() => cargarEstadoBD(), 2000);
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/backup/configuracion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frecuencia: frecuenciaSeleccionada })
      });
      if (res.ok) {
        alert('✅ ¡Frecuencia de respaldo guardada con éxito!');
        cargarEstadoBD();
      }
    } catch {
      alert('Error al guardar configuración.');
    }
  };

  const generarCopiaLocal = async () => {
    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/api/backup/generar-manual`, { method: 'POST' });
      if (res.ok) {
        alert('✅ ¡Copia de seguridad guardada en el almacenamiento local del negocio!');
        cargarEstadoBD();
      }
    } catch {
      alert('Error al generar copia local.');
    } finally {
      setProcesando(false);
    }
  };

  const optimizarBaseDatos = async () => {
    if (!window.confirm('¿Deseas compactar y optimizar la base de datos para recuperar espacio y velocidad?')) return;
    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/api/backup/optimizar`, { method: 'POST' });
      if (res.ok) {
        alert('🚀 ¡Base de datos optimizada y compactada exitosamente!');
        cargarEstadoBD();
      }
    } catch {
      alert('Error al optimizar.');
    } finally {
      setProcesando(false);
    }
  };

  const manejarSubidaBD = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('⚠️ ADVERTENCIA: Restaurar un archivo de respaldo sobrescribirá la base de datos actual con los datos del archivo seleccionado. ¿Deseas continuar?')) {
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64Contenido = event.target.result;
        const res = await fetch(`${API_URL}/api/backup/restaurar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archivoBase64: base64Contenido })
        });

        if (res.ok) {
          alert('✅ ¡Base de datos restaurada con éxito! La página se recargará.');
          window.location.reload();
        } else {
          const errData = await res.json();
          alert(errData.error || 'Error al restaurar la base de datos.');
        }
      } catch {
        alert('Error de conexión al enviar el archivo de respaldo.');
      } finally {
        e.target.value = null;
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bd-container">
      {/* Encabezado */}
      <header className="bd-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src={logoAsadel} alt="Logo" style={{ height: '32px' }} />
          <h2 style={{ margin: 0, fontSize: '16px' }}>GESTIÓN Y RESPALDO DE BASE DE DATOS</h2>
        </div>
        {volverAlDashboard && (
          <button className="btn-secondary" onClick={volverAlDashboard}>
            ⬅ Volver al Dashboard
          </button>
        )}
      </header>

      {/* Métricas del Sistema SQLite */}
      <div className="bd-metrics-grid">
        <div className="bd-metric-card">
          <span>Tamaño de la Base de Datos</span>
          <strong style={{ color: '#2563eb' }}>{estado.pesoMB} MB</strong>
        </div>
        <div className="bd-metric-card">
          <span>Productos en Catálogo</span>
          <strong>{estado.conteo.totalProductos}</strong>
        </div>
        <div className="bd-metric-card">
          <span>Tickets de Venta Registrados</span>
          <strong style={{ color: '#16a34a' }}>{estado.conteo.totalVentas}</strong>
        </div>
        <div className="bd-metric-card">
          <span>Clientes en Monedero</span>
          <strong style={{ color: '#8b5cf6' }}>{estado.conteo.totalClientes}</strong>
        </div>
      </div>

      {/* Secciones de Trabajo */}
      <div className="bd-sections-grid">
        {/* Panel Izquierdo: Acciones de Respaldo */}
        <div className="bd-box">
          <h3>Copias de Seguridad (Backup)</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Descarga una copia completa del archivo de datos para guardarla en una memoria USB o restáurala cuando lo necesites.
          </p>

          <div className="bd-actions-row">
            <button className="btn-big-action primary" onClick={descargarRespaldo}>
              <span style={{ fontSize: '22px' }}>⬇️</span>
              <div>
                <div>Descargar Respaldo Ahora (.db)</div>
                <small style={{ fontWeight: 'normal', opacity: 0.9 }}>
                  Guarda el archivo completo listo para guardar en USB
                </small>
              </div>
            </button>

            <button className="btn-big-action" onClick={() => fileInputDbRef.current.click()}>
              <span style={{ fontSize: '22px' }}>⬆️️</span>
              <div>
                <div>Cargar / Restaurar Respaldo (.db)</div>
                <small style={{ fontWeight: 'normal', color: '#64748b' }}>
                  Sube un archivo de base de datos previo para restaurarlo
                </small>
              </div>
            </button>
            <input type="file" ref={fileInputDbRef} style={{ display: 'none' }} accept=".db" onChange={manejarSubidaBD} />

            <button className="btn-big-action" onClick={generarCopiaLocal} disabled={procesando}>
              <span style={{ fontSize: '22px' }}>📂</span>
              <div>
                <div>Crear Copia Local Inmediata</div>
                <small style={{ fontWeight: 'normal', color: '#64748b' }}>
                  Copia el archivo a la carpeta interna de respaldos
                </small>
              </div>
            </button>

            <button className="btn-big-action" onClick={optimizarBaseDatos} disabled={procesando}>
              <span style={{ fontSize: '22px' }}>⚡</span>
              <div>
                <div>Compactar y Optimizar Base de Datos (VACUUM)</div>
                <small style={{ fontWeight: 'normal', color: '#64748b' }}>
                  Limpia espacio en desuso y mejora el rendimiento de búsqueda
                </small>
              </div>
            </button>
          </div>
        </div>

        {/* Panel Derecho: Configuración Automática e Historial */}
        <div className="bd-box">
          <h3>Frecuencia de Respaldo Automático</h3>
          <form onSubmit={guardarConfiguracion} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>
              Programar copias automáticas en el equipo:
            </label>
            <select
              value={frecuenciaSeleccionada}
              onChange={(e) => setFrecuenciaSeleccionada(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
            >
              <option value="diario">Diario (Al final del día laboral)</option>
              <option value="12h">Cada 12 horas</option>
              <option value="semanal">Semanal (Cada 7 días)</option>
              <option value="desactivado">Desactivado (Solo respaldos manuales)</option>
            </select>
            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
              💾 Guardar Frecuencia
            </button>
          </form>

          <h3 style={{ marginTop: '10px' }}>Respaldos Locales Recientes</h3>
          <table className="bd-table-history">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Peso</th>
                <th>Fecha de Creación</th>
              </tr>
            </thead>
            <tbody>
              {estado.respaldosLocales.map((r, idx) => (
                <tr key={idx}>
                  <td><code>{r.archivo}</code></td>
                  <td>{r.pesoKB} KB</td>
                  <td>{new Date(r.fecha).toLocaleString()}</td>
                </tr>
              ))}
              {estado.respaldosLocales.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                    No se han generado copias locales automáticas aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}