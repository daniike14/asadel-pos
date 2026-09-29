import React, { useState, useEffect } from 'react';
import logoDefault from '../assets/Logo.jpg';
import './GestionEmpresa.css';
import { API_URL } from '../config';

export default function GestionEmpresa({ volverAlDashboard }) {
  const [pestana, setPestana] = useState('empresa'); // 'empresa' | 'usuarios'

  // Datos de la Empresa
  const [datosEmpresa, setDatosEmpresa] = useState({
    nombre: '',
    sucursal: '',
    direccion: '',
    telefono: '',
    mensaje_ticket: '',
    logo: ''
  });

  // Lista de Usuarios
  const [usuarios, setUsuarios] = useState([]);
  const [modalUsuario, setModalUsuario] = useState(null); // 'nuevo' | 'editar'
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  // Formulario Usuario
  const [formUser, setFormUser] = useState({
    usuario: '',
    nombre: '',
    password: '',
    rol: 'cajero',
    activo: true
  });

  const cargarDatos = async () => {
    try {
      const [resEmpresa, resUsuarios] = await Promise.all([
        fetch(`${API_URL}/api/empresa`),
        fetch(`${API_URL}/api/usuarios`)
      ]);

      if (resEmpresa.ok) setDatosEmpresa(await resEmpresa.json());
      if (resUsuarios.ok) setUsuarios(await resUsuarios.json());
    } catch (err) {
      console.error('Error al cargar datos:', err);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDatosEmpresa((prev) => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const guardarDatosEmpresa = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/empresa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosEmpresa)
      });

      if (res.ok) {
        alert('✅ ¡Datos de la empresa guardados correctamente!');
      } else {
        alert('Error al guardar datos de la empresa.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  const abrirModalNuevo = () => {
    setFormUser({ usuario: '', nombre: '', password: '', rol: 'cajero', activo: true });
    setUsuarioEditando(null);
    setModalUsuario('nuevo');
  };

  const abrirModalEditar = (u) => {
    setUsuarioEditando(u);
    setFormUser({
      usuario: u.usuario,
      nombre: u.nombre,
      password: '', // En blanco si no se cambia
      rol: u.rol,
      activo: Boolean(u.activo)
    });
    setModalUsuario('editar');
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    const esEdicion = modalUsuario === 'editar';
    const url = esEdicion ? `${API_URL}/api/usuarios/${usuarioEditando.id}` : `${API_URL}/api/usuarios`;
    const method = esEdicion ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formUser)
      });

      if (res.ok) {
        alert(`✅ Usuario ${esEdicion ? 'actualizado' : 'creado'} exitosamente.`);
        setModalUsuario(null);
        cargarDatos();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al procesar usuario.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  const eliminarUsuario = async (u) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la cuenta de "${u.nombre}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/usuarios/${u.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Usuario eliminado.');
        cargarDatos();
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo eliminar el usuario.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  return (
    <div className="emp-container">
      {/* Encabezado */}
      <header className="emp-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src={datosEmpresa.logo || logoDefault} alt="Logo" style={{ height: '32px' }} />
          <h2 style={{ margin: 0, fontSize: '16px' }}>CONFIGURACIÓN DEL NEGOCIO Y ACCESOS</h2>
        </div>

        <div className="emp-tabs">
          <button
            className={`emp-tab-btn ${pestana === 'empresa' ? 'active' : ''}`}
            onClick={() => setPestana('empresa')}
          >
            🏢 Datos de la Papelería
          </button>
          <button
            className={`emp-tab-btn ${pestana === 'usuarios' ? 'active' : ''}`}
            onClick={() => setPestana('usuarios')}
          >
            👥 Usuarios y Cajeros ({usuarios.length})
          </button>
        </div>

        {volverAlDashboard && (
          <button className="btn-secondary" onClick={volverAlDashboard}>
            ⬅ Volver al Dashboard
          </button>
        )}
      </header>

      {/* PESTAÑA 1: DATOS DE LA EMPRESA */}
      {pestana === 'empresa' && (
        <form className="emp-card" onSubmit={guardarDatosEmpresa}>
          <h3>Información General y de Tickets</h3>
          <div className="emp-grid-two">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="emp-logo-box">
                {datosEmpresa.logo ? (
                  <img src={datosEmpresa.logo} alt="Logo empresa" />
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Sin Logotipo Oficial</span>
                )}
              </div>
              <label className="btn-secondary" style={{ textAlign: 'center', cursor: 'pointer' }}>
                📷 Cargar Logotipo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
              </label>
            </div>

            <div className="emp-form-fields">
              <div className="input-group-inline">
                <label>Nombre Comercial / Razón Social:</label>
                <input
                  type="text"
                  required
                  value={datosEmpresa.nombre || ''}
                  onChange={(e) => setDatosEmpresa({ ...datosEmpresa, nombre: e.target.value })}
                />
              </div>

              <div className="input-group-inline">
                <label>Sucursal:</label>
                <input
                  type="text"
                  value={datosEmpresa.sucursal || ''}
                  onChange={(e) => setDatosEmpresa({ ...datosEmpresa, sucursal: e.target.value })}
                />
              </div>

              <div className="input-group-inline full">
                <label>Dirección del Local / Sucursal:</label>
                <input
                  type="text"
                  placeholder="Ej. Av. Hidalgo #45, Col. Centro"
                  value={datosEmpresa.direccion || ''}
                  onChange={(e) => setDatosEmpresa({ ...datosEmpresa, direccion: e.target.value })}
                />
              </div>

              <div className="input-group-inline">
                <label>Teléfono / WhatsApp de Atención:</label>
                <input
                  type="text"
                  placeholder="Ej. 55 1234 5678"
                  value={datosEmpresa.telefono || ''}
                  onChange={(e) => setDatosEmpresa({ ...datosEmpresa, telefono: e.target.value })}
                />
              </div>

              <div className="input-group-inline full">
                <label>Mensaje al Pie del Ticket / Nota:</label>
                <input
                  type="text"
                  placeholder="Ej. ¡Gracias por su preferencia! Cualquier cambio con este ticket."
                  value={datosEmpresa.mensaje_ticket || ''}
                  onChange={(e) => setDatosEmpresa({ ...datosEmpresa, mensaje_ticket: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px' }}>
              💾 Guardar Datos de la Empresa
            </button>
          </div>
        </form>
      )}

      {/* PESTAÑA 2: USUARIOS Y ACCESOS */}
      {pestana === 'usuarios' && (
        <div className="emp-card" style={{ maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Cuentas de Acceso al Sistema</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Administra los usuarios para cajeros y personal de mostrador.
              </p>
            </div>
            <button className="btn-primary" onClick={abrirModalNuevo}>+ Nuevo Usuario</button>
          </div>

          <table className="emp-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Nombre Completo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Fecha de Alta</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td><strong>{u.usuario}</strong></td>
                  <td>{u.nombre}</td>
                  <td>
                    <span className={`badge-rol ${u.rol}`}>
                      {u.rol === 'admin' ? '⭐ Administrador' : '💼 Cajero'}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: u.activo ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                      {u.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td>{new Date(u.fecha_creacion).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button className="btn-gc-action" onClick={() => abrirModalEditar(u)}>
                        ✏️ Editar / Clave
                      </button>
                      {u.id !== 1 && (
                        <button className="btn-gc-action delete" onClick={() => eliminarUsuario(u)}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL REGISTRAR / EDITAR USUARIO */}
      {modalUsuario && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '420px' }}>
            <div className="modal-header">
              <h2>{modalUsuario === 'nuevo' ? 'CREAR NUEVO USUARIO' : `EDITAR: ${usuarioEditando.usuario}`}</h2>
              <button className="btn-close-modal" onClick={() => setModalUsuario(null)}>✕</button>
            </div>
            <form onSubmit={guardarUsuario} className="modal-body">
              {modalUsuario === 'nuevo' && (
                <div className="field-group">
                  <label>Nombre de Usuario (Para iniciar sesión):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. donpepe, turno_tarde"
                    value={formUser.usuario}
                    onChange={(e) => setFormUser({ ...formUser, usuario: e.target.value })}
                    autoFocus
                  />
                </div>
              )}

              <div className="field-group">
                <label>Nombre Completo / Empleado:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. José Martínez"
                  value={formUser.nombre}
                  onChange={(e) => setFormUser({ ...formUser, nombre: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label>{modalUsuario === 'editar' ? 'Nueva Contraseña (dejar en blanco para no cambiar):' : 'Contraseña:'}</label>
                <input
                  type="password"
                  required={modalUsuario === 'nuevo'}
                  placeholder="••••••••"
                  value={formUser.password}
                  onChange={(e) => setFormUser({ ...formUser, password: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label>Rol en el Sistema:</label>
                <select
                  value={formUser.rol}
                  onChange={(e) => setFormUser({ ...formUser, rol: e.target.value })}
                  disabled={usuarioEditando?.id === 1}
                >
                  <option value="cajero">Cajero / Mostrador</option>
                  <option value="admin">Administrador (Acceso Total)</option>
                </select>
              </div>

              {modalUsuario === 'editar' && usuarioEditando?.id !== 1 && (
                <label className="checkbox-label" style={{ marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={formUser.activo}
                    onChange={(e) => setFormUser({ ...formUser, activo: e.target.checked })}
                  />
                  Cuenta activa (permite iniciar sesión)
                </label>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setModalUsuario(null)}>Cancelar</button>
                <button type="submit" className="btn-confirm-modal">
                  {modalUsuario === 'nuevo' ? 'Crear Usuario' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}