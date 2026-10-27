// @ts-nocheck
import { useState, useEffect } from "react";
import PuntoDeVenta from "./pages/PuntoDeVenta";
import GestionProductos from "./pages/GestionProductos";
import Dashboard from "./pages/Dashboard";
import ReportesHistorial from "./pages/ReportesHistorial";
import GestionClientes from "./pages/GestionClientes";
import GestionEmpresa from "./pages/GestionEmpresa";
import GestionBaseDatos from "./pages/GestionBaseDatos";
import Login from "./pages/Login";
import SplashScreen from "./pages/SplashScreen";
import logoAsadel from "./assets/Logo.jpg";
import { API_URL } from "./config";

import "./App.css";

interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  rol: 'admin' | 'cajero';
  permisos?: string[];
}

function App() {
  // Estado para la pantalla de carga inicial (Splash Screen)
  const [iniciandoApp, setIniciandoApp] = useState<boolean>(true);
  // Estado para el modal de salida sin bloquear el hilo de Tauri
  const [mostrarModalSalir, setMostrarModalSalir] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIniciandoApp(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Interceptar el clic en la "X" de Windows limpiamente a la primera
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const interceptarCierre = async () => {
      try {
        if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();

          unlistenFn = await appWindow.onCloseRequested((event) => {
            event.preventDefault();
            setMostrarModalSalir(true);
          });
        }
      } catch (e) {
        console.log("Modo web detectado, no se aplica bloqueo de ventana.");
      }
    };

    interceptarCierre();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const confirmarSalidaApp = async () => {
    sessionStorage.removeItem('asadel_usuario_sesion');

    // 1. Notificar a Node.js que apague el servidor y libere el puerto
    try {
      fetch(`${API_URL}/api/sistema/apagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      }).catch(() => {});
    } catch (e) {}

    // 2. Destruir la ventana de Tauri de inmediato al primer clic
    try {
      if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        await appWindow.destroy();
      } else {
        window.close();
      }
    } catch {
      window.close();
    }
  };

  const [usuarioActual, setUsuarioActual] = useState<UsuarioSesion | null>(() => {
    const sesionGuardada = sessionStorage.getItem('asadel_usuario_sesion');
    if (!sesionGuardada) return null;
    
    const usuario = JSON.parse(sesionGuardada);
    const permisosStr = localStorage.getItem(`permisos_user_${usuario.usuario}`);
    if (permisosStr) {
        usuario.permisos = JSON.parse(permisosStr);
    } else {
        usuario.permisos = usuario.rol === 'admin' 
            ? ['dashboard', 'ventas', 'productos', 'reportes', 'empresa', 'clientes', 'basedatos'] 
            : ['ventas'];
    }
    return usuario;
  });

  const [logoEmpresa, setLogoEmpresa] = useState(() => {
    const logoGuardado = localStorage.getItem('asadel_logo_temp');
    return logoGuardado || logoAsadel;
  });

  useEffect(() => {
    const cargarLogoInicial = async () => {
      try {
        const res = await fetch(`${API_URL}/api/empresa`);
        if (res.ok) {
          const data = await res.json();
          if (data.logo) {
            setLogoEmpresa(data.logo);
            localStorage.setItem('asadel_logo_temp', data.logo);
          } else {
            setLogoEmpresa(logoAsadel);
            localStorage.removeItem('asadel_logo_temp');
          }
        }
      } catch (e) {
        console.error('Error al cargar el logo inicial:', e);
      }
    };
    cargarLogoInicial();

    const escucharCambioEmpresa = () => {
      const logoNuevo = localStorage.getItem('asadel_logo_temp');
      if (logoNuevo) {
        setLogoEmpresa(logoNuevo);
      } else {
        setLogoEmpresa(logoAsadel);
      }
    };
    
    window.addEventListener('empresa-actualizada', escucharCambioEmpresa);
    return () => window.removeEventListener('empresa-actualizada', escucharCambioEmpresa);
  }, []);

  const [moduloActivo, setModuloActivo] = useState<string>("dashboard");
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);

  const iniciarSesion = (user: UsuarioSesion) => {
    const permisosStr = localStorage.getItem(`permisos_user_${user.usuario}`);
    if (permisosStr) {
        user.permisos = JSON.parse(permisosStr);
    } else {
        user.permisos = user.rol === 'admin' 
            ? ['dashboard', 'ventas', 'productos', 'reportes', 'empresa', 'clientes', 'basedatos'] 
            : ['ventas'];
    }
    
    setUsuarioActual(user);
    sessionStorage.setItem('asadel_usuario_sesion', JSON.stringify(user));
    
    const permisosSeguros = user.permisos || [];
    setModuloActivo(permisosSeguros.includes('dashboard') ? 'dashboard' : 'caja');
  };

  const cerrarSesion = () => {
    if (window.confirm("¿Seguro que deseas cerrar la sesión actual?")) {
      setUsuarioActual(null);
      sessionStorage.removeItem('asadel_usuario_sesion');
      setMenuMovilAbierto(false);
    }
  };

  const seleccionarModulo = (mod: string) => {
    setModuloActivo(mod);
    setMenuMovilAbierto(false); 
  };

  return (
    <>
      {/* PANTALLA DE CARGA PROFESIONAL */}
      <SplashScreen cargando={iniciandoApp} logo={logoEmpresa} />

      {!usuarioActual ? (
        <Login alIniciarSesion={iniciarSesion} />
      ) : (
        <div className="app-container">
          <header className="mobile-topbar">
            <button
              className="mobile-menu-btn"
              onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <span className="mobile-topbar-title">PAPELERÍA ASADEL</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {usuarioActual.rol === 'admin' ? 'Admin' : 'Cajero'}
            </span>
          </header>

          {menuMovilAbierto && (
            <div
              className="sidebar-overlay"
              onClick={() => setMenuMovilAbierto(false)}
            />
          )}

          <aside className={`sidebar ${menuMovilAbierto ? "open" : ""}`}>
            <div className="sidebar-header">
              <img src={logoEmpresa} alt="ASADEL" className="sidebar-logo" />
            </div>

            <div
              style={{
                backgroundColor: '#1e293b',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sesión activa:</span>
              <strong style={{ color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {usuarioActual.nombre}
              </strong>
              <span
                style={{
                  color: usuarioActual.rol === 'admin' ? '#fbbf24' : '#38bdf8',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  textTransform: 'uppercase'
                }}
              >
                {usuarioActual.rol === 'admin' ? '★ Administrador' : '👤 Cajero'}
              </span>
            </div>

            <nav className="sidebar-nav">
              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('dashboard')) && (
                <button
                  className={moduloActivo === "dashboard" ? "active" : ""}
                  onClick={() => seleccionarModulo("dashboard")}
                >
                  DASHBOARD
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('ventas')) && (
                <button
                  className={moduloActivo === "caja" ? "active" : ""}
                  onClick={() => seleccionarModulo("caja")}
                >
                  1. VENTAS (Caja)
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('productos')) && (
                <button
                  className={moduloActivo === "productos" ? "active" : ""}
                  onClick={() => seleccionarModulo("productos")}
                >
                  2. PRODUCTOS
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('reportes')) && (
                <button
                  className={moduloActivo === "reportes" ? "active" : ""}
                  onClick={() => seleccionarModulo("reportes")}
                >
                  3. REPORTES / HISTORIAL
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('empresa')) && (
                <button
                  className={moduloActivo === "empresa" ? "active" : ""}
                  onClick={() => seleccionarModulo("empresa")}
                >
                  4. EMPRESA
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('clientes')) && (
                <button
                  className={`nav-btn ${moduloActivo === 'clientes' ? 'active' : ''}`}
                  onClick={() => seleccionarModulo('clientes')}
                >
                  5. CLIENTES Y LEALTAD
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('basedatos')) && (
                <button
                  className={moduloActivo === "basedatos" ? "active" : ""}
                  onClick={() => seleccionarModulo("basedatos")}
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
              Cerrar Sesión
            </button>
          </aside>

          <main className="main-content">
            {moduloActivo === "dashboard" && (usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('dashboard')) && (
              <Dashboard cambiarModulo={seleccionarModulo} />
            )}
            {moduloActivo === "caja" && (usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('ventas')) && (
              <PuntoDeVenta />
            )}
            {moduloActivo === "productos" && (usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('productos')) && (
              <GestionProductos />
            )}
            {moduloActivo === "reportes" && (usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('reportes')) && (
              <ReportesHistorial volverAlDashboard={() => seleccionarModulo("dashboard")} />
            )}
            {moduloActivo === "empresa" && (usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('empresa')) && (
              <GestionEmpresa volverAlDashboard={() => seleccionarModulo("dashboard")} />
            )}
            {moduloActivo === 'clientes' && (usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('clientes')) && (
              <GestionClientes volverAlDashboard={() => seleccionarModulo(usuarioActual.rol === 'admin' ? 'dashboard' : 'caja')} />
            )}
            {moduloActivo === "basedatos" && (usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('basedatos')) && (
              <GestionBaseDatos volverAlDashboard={() => seleccionarModulo("dashboard")} />
            )}
          </main>
        </div>
      )}

      {/* MODAL LIMPIO DE CONFIRMACIÓN DE SALIDA (SIN CONGELAR TAURI) */}
      {mostrarModalSalir && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999
          }}
        >
          <div 
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              width: '380px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '36px', lineHeight: 1 }}>🚪</div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>
              ¿Deseas salir del Punto de Venta?
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Se cerrará la sesión activa y el sistema se apagará de forma segura.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setMostrarModalSalir(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarSalidaApp}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                Sí, Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;