import { useState } from "react";
import PuntoDeVenta from "./pages/PuntoDeVenta";
import GestionProductos from "./pages/GestionProductos";
import Dashboard from "./pages/Dashboard";
import ReportesHistorial from "./pages/ReportesHistorial";
import GestionClientes from './pages/GestionClientes';
import GestionEmpresa from './pages/GestionEmpresa';
import GestionBaseDatos from './pages/GestionBaseDatos'; // 👈 Importamos Base de Datos
import Login from './pages/Login';
import logoAsadel from "./assets/Logo.jpg";
import "./App.css";

interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  rol: 'admin' | 'cajero';
}

function App() {
  const [usuarioActual, setUsuarioActual] = useState<UsuarioSesion | null>(() => {
    const sesionGuardada = localStorage.getItem('asadel_usuario_sesion');
    return sesionGuardada ? JSON.parse(sesionGuardada) : null;
  });

  const [moduloActivo, setModuloActivo] = useState<string>("dashboard");

  const iniciarSesion = (user: UsuarioSesion) => {
    setUsuarioActual(user);
    localStorage.setItem('asadel_usuario_sesion', JSON.stringify(user));
    setModuloActivo(user.rol === 'admin' ? "dashboard" : "caja");
  };

  const cerrarSesion = () => {
    if (window.confirm("¿Seguro que deseas cerrar la sesión actual?")) {
      setUsuarioActual(null);
      localStorage.removeItem('asadel_usuario_sesion');
    }
  };

  if (!usuarioActual) {
    return <Login alIniciarSesion={iniciarSesion} />;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  return (
    <div className="app-container">
      {/* Menú Lateral (Sidebar) */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logoAsadel} alt="ASADEL" className="sidebar-logo" />
        </div>

        <div style={{
          backgroundColor: '#1e293b',
          padding: '10px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sesión activa:</span>
          <strong style={{ color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {usuarioActual.nombre}
          </strong>
          <span style={{
            color: esAdmin ? '#fbbf24' : '#38bdf8',
            fontWeight: 'bold',
            fontSize: '11px',
            textTransform: 'uppercase'
          }}>
            {esAdmin ? '⭐ Administrador' : '💼 Cajero'}
          </span>
        </div>

        <nav className="sidebar-nav">
          {esAdmin && (
            <button
              className={moduloActivo === "dashboard" ? "active" : ""}
              onClick={() => setModuloActivo("dashboard")}
            >
              Dashboard
            </button>
          )}

          <button
            className={moduloActivo === "caja" ? "active" : ""}
            onClick={() => setModuloActivo("caja")}
          >
            1. VENTAS (Caja)
          </button>

          {esAdmin && (
            <button
              className={moduloActivo === "productos" ? "active" : ""}
              onClick={() => setModuloActivo("productos")}
            >
              2. PRODUCTOS
            </button>
          )}

          {esAdmin && (
            <button
              className={moduloActivo === "reportes" ? "active" : ""}
              onClick={() => setModuloActivo("reportes")}
            >
              3. REPORTES / HISTORIAL
            </button>
          )}

          {esAdmin && (
            <button
              className={moduloActivo === "empresa" ? "active" : ""}
              onClick={() => setModuloActivo("empresa")}
            >
              4. EMPRESA
            </button>
          )}

          <button
            className={`nav-btn ${moduloActivo === 'clientes' ? 'active' : ''}`}
            onClick={() => setModuloActivo('clientes')}
          >
            5. CLIENTES Y LEALTAD
          </button>

          {esAdmin && (
            <button
              className={moduloActivo === "basedatos" ? "active" : ""}
              onClick={() => setModuloActivo("basedatos")}
            >
              6. BASE DE DATOS
            </button>
          )}
        </nav>

        <button
          onClick={cerrarSesion}
          style={{
            marginTop: 'auto',
            backgroundColor: '#334155',
            color: '#f8fafc',
            border: 'none',
            padding: '10px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          🚪 Cerrar Sesión
        </button>
      </aside>

      {/* Área Principal de Trabajo */}
      <main className="main-content">
        {moduloActivo === "dashboard" && esAdmin && <Dashboard cambiarModulo={setModuloActivo} />}
        {moduloActivo === "caja" && <PuntoDeVenta />}
        {moduloActivo === "productos" && esAdmin && <GestionProductos />}
        {moduloActivo === "reportes" && esAdmin && (
          <ReportesHistorial volverAlDashboard={() => setModuloActivo("dashboard")} />
        )}
        {moduloActivo === "empresa" && esAdmin && (
          <GestionEmpresa volverAlDashboard={() => setModuloActivo("dashboard")} />
        )}
        {moduloActivo === 'clientes' && (
          <GestionClientes volverAlDashboard={() => setModuloActivo(esAdmin ? 'dashboard' : 'caja')} />
        )}
        {moduloActivo === "basedatos" && esAdmin && (
          <GestionBaseDatos volverAlDashboard={() => setModuloActivo("dashboard")} />
        )}
      </main>
    </div>
  );
}

export default App;