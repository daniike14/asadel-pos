import React, { useState } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './Login.css';
import { API_URL } from '../config';

export default function Login({ alIniciarSesion }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

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
          <img src={logoAsadel} alt="Logo ASADEL" className="login-logo" />
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

        <div className="login-footer-hint">
          Cuentas demo: <code>admin / admin123</code> ó <code>turno1 / caja123</code>
        </div>
      </div>
    </div>
  );
}