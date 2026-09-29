import React, { useState, useEffect, useMemo } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './GestionClientes.css';
import { API_URL } from '../config';

export default function GestionClientes({ volverAlDashboard }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);

  // Estados de Modales
  const [modalAbierto, setModalAbierto] = useState(null); // 'nuevo' | 'editar' | 'historial' | 'configuracion'
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [historialCompras, setHistorialCompras] = useState([]);

  // Configuración de Reglas de Lealtad
  const [configLealtad, setConfigLealtad] = useState({
    valor_punto_pesos: 1.0,
    minimo_puntos_canje: 0,
    porcentaje_max_descuento: 100
  });

  // Formulario de Cliente
  const [formNombre, setFormNombre] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formPuntos, setFormPuntos] = useState('0');

  // Formulario de Configuración
  const [formValorPunto, setFormValorPunto] = useState('1.0');
  const [formMinimoCanje, setFormMinimoCanje] = useState('0');
  const [formMaxDescuento, setFormMaxDescuento] = useState('100');

  const cargarClientes = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/clientes`);
      if (res.ok) {
        setClientes(await res.json());
      }
    } catch (err) {
      console.error('Error al cargar clientes:', err);
    } finally {
      setCargando(false);
    }
  };

  const cargarConfiguracion = async () => {
    try {
      const res = await fetch(`${API_URL}/api/configuracion/lealtad`);
      if (res.ok) {
        const data = await res.json();
        setConfigLealtad(data);
        setFormValorPunto(String(data.valor_punto_pesos));
        setFormMinimoCanje(String(data.minimo_puntos_canje));
        setFormMaxDescuento(String(data.porcentaje_max_descuento));
      }
    } catch (err) {
      console.error('Error al cargar configuración:', err);
    }
  };

  useEffect(() => {
    cargarClientes();
    cargarConfiguracion();
  }, []);

  const abrirNuevoCliente = () => {
    setFormNombre('');
    setFormTelefono('');
    setFormPuntos('0');
    setClienteSeleccionado(null);
    setModalAbierto('nuevo');
  };

  const abrirEditarCliente = (c) => {
    setClienteSeleccionado(c);
    setFormNombre(c.nombre);
    setFormTelefono(c.telefono);
    setFormPuntos(String(c.puntos_acumulados || 0));
    setModalAbierto('editar');
  };

  const abrirHistorialCliente = async (c) => {
    setClienteSeleccionado(c);
    setHistorialCompras([]);
    setModalAbierto('historial');
    try {
      const res = await fetch(`${API_URL}/api/clientes/${c.id}/historial`);
      if (res.ok) {
        setHistorialCompras(await res.json());
      }
    } catch (err) {
      console.error('Error al cargar compras del cliente:', err);
    }
  };

  const abrirConfiguracion = () => {
    setFormValorPunto(String(configLealtad.valor_punto_pesos));
    setFormMinimoCanje(String(configLealtad.minimo_puntos_canje));
    setFormMaxDescuento(String(configLealtad.porcentaje_max_descuento));
    setModalAbierto('configuracion');
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    const valorPunto = parseFloat(formValorPunto);
    const minimoCanje = parseInt(formMinimoCanje, 10);
    const maxDesc = parseInt(formMaxDescuento, 10);

    if (isNaN(valorPunto) || valorPunto <= 0) {
      return alert('⚠️ El valor de cada punto debe ser mayor a 0 (ej. 1.00 o 0.10).');
    }

    try {
      const res = await fetch(`${API_URL}/api/configuracion/lealtad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor_punto_pesos: valorPunto,
          minimo_puntos_canje: isNaN(minimoCanje) ? 0 : minimoCanje,
          porcentaje_max_descuento: isNaN(maxDesc) ? 100 : maxDesc
        })
      });

      if (res.ok) {
        alert('✅ ¡Reglas del monedero guardadas con éxito!');
        setModalAbierto(null);
        cargarConfiguracion();
      } else {
        alert('Error al guardar configuración.');
      }
    } catch {
      alert('Error de conexión al guardar configuración.');
    }
  };

  const guardarCliente = async (e) => {
    e.preventDefault();
    if (!formNombre.trim() || !formTelefono.trim()) {
      return alert('⚠️ Nombre y teléfono son obligatorios.');
    }

    const esEdicion = modalAbierto === 'editar';
    const url = esEdicion ? `${API_URL}/api/clientes/${clienteSeleccionado.id}` : `${API_URL}/api/clientes`;
    const method = esEdicion ? 'PUT' : 'POST';

    const payload = {
      nombre: formNombre.trim(),
      telefono: formTelefono.trim(),
      puntos_acumulados: parseInt(formPuntos, 10) || 0
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(`✅ Cliente ${esEdicion ? 'actualizado' : 'registrado'} exitosamente.`);
        setModalAbierto(null);
        cargarClientes();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al guardar cliente.');
      }
    } catch {
      alert('Error de conexión con el servidor.');
    }
  };

  const eliminarCliente = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que deseas eliminar al cliente "${nombre}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/clientes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Cliente eliminado.');
        cargarClientes();
      }
    } catch {
      alert('Error al intentar eliminar el cliente.');
    }
  };

  // Filtrado reactivo
  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) => c.nombre.toLowerCase().includes(q) || c.telefono.includes(q)
    );
  }, [clientes, busqueda]);

  // Métricas dinámicas calculadas con la tasa de cambio activa
  const totalClientes = clientes.length;
  const puntosTotales = clientes.reduce((acc, c) => acc + (c.puntos_acumulados || 0), 0);
  const dineroEquivalenteTotal = puntosTotales * (configLealtad.valor_punto_pesos || 1);
  const clienteLider = clientes[0]?.nombre || 'Ninguno';

  // Ejemplo en vivo para la ventana de configuración
  const valPuntoNum = parseFloat(formValorPunto) || 0;

  return (
    <div className="gc-container">
      {/* Encabezado */}
      <header className="gc-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src={logoAsadel} alt="Logo ASADEL" style={{ height: '30px' }} />
          <h2 style={{ margin: 0, fontSize: '16px' }}>CLIENTES Y MONEDERO DE LEALTAD</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={abrirConfiguracion}>
            ⚙️ Configurar Monedero
          </button>
          {volverAlDashboard && (
            <button className="btn-secondary" onClick={volverAlDashboard}>
              ⬅ Volver al Dashboard
            </button>
          )}
        </div>
      </header>

      {/* Tarjetas de Métricas Dinámicas */}
      <div className="gc-metrics-grid">
        <div className="gc-metric-box">
          <span>Clientes Registrados</span>
          <strong>{totalClientes}</strong>
        </div>
        <div className="gc-metric-box">
          <span>Puntos en Monederos</span>
          <strong style={{ color: '#16a34a' }}>{puntosTotales} pts</strong>
        </div>
        <div className="gc-metric-box">
          <span>Valor en Dinero Equivalente</span>
          <strong style={{ color: '#0284c7' }}>${dineroEquivalenteTotal.toFixed(2)} MXN</strong>
        </div>
        <div className="gc-metric-box">
          <span>Regla de Canje Actual</span>
          <strong style={{ fontSize: '15px' }}>
            1 pt = ${(configLealtad.valor_punto_pesos || 1).toFixed(2)} MXN
          </strong>
        </div>
      </div>

      {/* Barra de Herramientas */}
      <div className="gc-toolbar">
        <input
          type="text"
          className="gc-search"
          placeholder="🔍 Buscar por nombre o número telefónico..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={cargarClientes}>🔄 Actualizar</button>
          <button className="btn-primary" onClick={abrirNuevoCliente}>+ Registrar Cliente</button>
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="gc-table-wrapper">
        {cargando ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Cargando directorio...</div>
        ) : (
          <table className="gc-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre del Cliente</th>
                <th>Teléfono</th>
                <th>Puntos Acumulados</th>
                <th>Equivalencia $</th>
                <th>Compras Registradas</th>
                <th>Total Gastado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((c) => {
                const equivDinero = (c.puntos_acumulados || 0) * (configLealtad.valor_punto_pesos || 1);

                return (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td><strong>{c.nombre}</strong></td>
                    <td>{c.telefono}</td>
                    <td>
                      <span className="badge-puntos">
                        ⭐ {c.puntos_acumulados || 0} pts
                      </span>
                    </td>
                    <td><strong>${equivDinero.toFixed(2)}</strong></td>
                    <td>{c.total_compras || 0} compras</td>
                    <td style={{ fontWeight: 'bold' }}>${(parseFloat(c.total_gastado) || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="gc-actions" style={{ justifyContent: 'center' }}>
                        <button className="btn-gc-action" onClick={() => abrirHistorialCliente(c)} title="Ver compras">
                          🧾 Compras
                        </button>
                        <button className="btn-gc-action" onClick={() => abrirEditarCliente(c)} title="Editar datos o puntos">
                          ✏️ Editar
                        </button>
                        <button className="btn-gc-action delete" onClick={() => eliminarCliente(c.id, c.nombre)} title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {clientesFiltrados.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No se encontraron clientes registrados con ese criterio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL CONFIGURACIÓN DE REGLAS DE LEALTAD */}
      {modalAbierto === 'configuracion' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h2>⚙️ REGLAS DEL MONEDERO DE LEALTAD</h2>
              <button className="btn-close-modal" onClick={() => setModalAbierto(null)}>✕</button>
            </div>
            <form onSubmit={guardarConfiguracion} className="modal-body">
              <div className="field-group">
                <label>Valor en dinero de 1 Punto ($ MXN):</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={formValorPunto}
                  onChange={(e) => setFormValorPunto(e.target.value)}
                  placeholder="Ej. 1.00 ó 0.10"
                />
                <small style={{ color: '#64748b' }}>
                  Ejemplos: <code>1.00</code> = 1 punto vale $1 MXN | <code>0.10</code> = 10 puntos valen $1 MXN.
                </small>
              </div>

              {/* Vista previa en vivo del valor */}
              <div className="config-preview-box">
                💡 <strong>Ejemplo en mostrador:</strong> Si un cliente tiene <strong>50 puntos</strong> acumulados, equivalen a <strong>${(50 * valPuntoNum).toFixed(2)} MXN</strong> de saldo a favor.
              </div>

              <div className="field-group">
                <label>Mínimo de puntos acumulados para permitir canje:</label>
                <input
                  type="number"
                  min="0"
                  value={formMinimoCanje}
                  onChange={(e) => setFormMinimoCanje(e.target.value)}
                  placeholder="0"
                />
                <small style={{ color: '#64748b' }}>
                  Si pones <code>20</code>, el cliente debe juntar al menos 20 puntos antes de poder usarlos.
                </small>
              </div>

              <div className="field-group">
                <label>Porcentaje máximo a pagar con puntos por ticket (%):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formMaxDescuento}
                  onChange={(e) => setFormMaxDescuento(e.target.value)}
                  placeholder="100"
                />
                <small style={{ color: '#64748b' }}>
                  <code>100%</code> permite liquidar toda la cuenta con puntos. <code>50%</code> permite cubrir hasta la mitad.
                </small>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setModalAbierto(null)}>Cancelar</button>
                <button type="submit" className="btn-confirm-modal">Guardar Reglas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR / EDITAR CLIENTE */}
      {(modalAbierto === 'nuevo' || modalAbierto === 'editar') && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '420px' }}>
            <div className="modal-header">
              <h2>{modalAbierto === 'nuevo' ? 'REGISTRAR CLIENTE' : 'EDITAR CLIENTE Y PUNTOS'}</h2>
              <button className="btn-close-modal" onClick={() => setModalAbierto(null)}>✕</button>
            </div>
            <form onSubmit={guardarCliente} className="modal-body">
              <div className="field-group">
                <label>Nombre Completo:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Roberto Mendoza"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="field-group">
                <label>Teléfono (10 dígitos):</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 5512345678"
                  value={formTelefono}
                  onChange={(e) => setFormTelefono(e.target.value)}
                />
              </div>

              {modalAbierto === 'editar' && (
                <div className="field-group">
                  <label>Saldo de Puntos de Lealtad:</label>
                  <input
                    type="number"
                    min="0"
                    value={formPuntos}
                    onChange={(e) => setFormPuntos(e.target.value)}
                  />
                  <small style={{ color: '#64748b' }}>
                    Puedes ajustar el saldo si deseas otorgar una bonificación especial.
                  </small>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setModalAbierto(null)}>Cancelar</button>
                <button type="submit" className="btn-confirm-modal">
                  {modalAbierto === 'nuevo' ? 'Guardar Cliente' : 'Actualizar Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE COMPRAS DEL CLIENTE */}
      {modalAbierto === 'historial' && clienteSeleccionado && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '680px' }}>
            <div className="modal-header">
              <h2>COMPRAS DE: {clienteSeleccionado.nombre}</h2>
              <button className="btn-close-modal" onClick={() => setModalAbierto(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '10px', fontSize: '13px', color: '#475569' }}>
                Teléfono: <strong>{clienteSeleccionado.telefono}</strong> | Saldo actual: <strong style={{ color: '#16a34a' }}>{clienteSeleccionado.puntos_acumulados} pts</strong>
              </div>
              <table className="gc-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th>Puntos Ganados</th>
                    <th>Puntos Canjeados</th>
                  </tr>
                </thead>
                <tbody>
                  {historialCompras.map((h) => (
                    <tr key={h.id}>
                      <td><strong>{h.folio}</strong></td>
                      <td>{new Date(h.fecha_hora).toLocaleDateString()}</td>
                      <td><span className="badge-puntos" style={{ background: '#e0f2fe', color: '#0284c7' }}>{h.metodo_pago}</span></td>
                      <td><strong>${h.total.toFixed(2)}</strong></td>
                      <td style={{ color: '#16a34a', fontWeight: 'bold' }}>+{h.puntos_ganados || 0}</td>
                      <td style={{ color: '#dc2626', fontWeight: 'bold' }}>-{h.puntos_canjeados || 0}</td>
                    </tr>
                  ))}
                  {historialCompras.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                        Este cliente aún no tiene tickets de venta asociados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel-modal" onClick={() => setModalAbierto(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}