import React, { useState, useEffect } from 'react';
import logoDefault from '../assets/Logo.jpg';
import './Login.css';
import { API_URL } from '../config';

export default function Login({ alIniciarSesion }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // Estado para el logo dinámico
  const [logoEmpresa, setLogoEmpresa] = useState(() => {
    const logoGuardado = localStorage.getItem('asadel_logo_temp');
    return logoGuardado || logoDefault;
  });

  useEffect(() => {
    // Pedimos el logo a la base de datos al cargar la pantalla de login por si se borró la memoria local
    const cargarLogoInicial = async () => {
      try {
        const res = await fetch(`${API_URL}/api/empresa`);
        if (res.ok) {
          const data = await res.json();
          if (data.logo) {
            setLogoEmpresa(data.logo);
            localStorage.setItem('asadel_logo_temp', data.logo);
          }
        }
      } catch (e) {
        console.error('Error al cargar el logo en el login:', e);
      }
    };
    cargarLogoInicial();
  }, []);

  const manejarSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password })
      });

      const data = await res.json();

      if (res.ok) {
        alIniciarSesion(data);
      } else {
        setError(data.error || 'No se pudo iniciar sesión.');
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-brand">
          <img src={logoEmpresa} alt="Logo ASADEL" className="login-logo" />
          <h2>CONTROL DE ACCESO</h2>
          <p>Punto de Venta y Administración</p>
        </div>

        {error && <div className="login-error-msg">⚠️ {error}</div>}

        <form onSubmit={manejarSubmit} className="login-form">
          <div className="login-field">
            <label>Usuario:</label>
            <input
              type="text"
              required
              placeholder="Ej. admin o turno1"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
            />
          </div>

          <div className="login-field">
            <label>Contraseña:</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-login" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}