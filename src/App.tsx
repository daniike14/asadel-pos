// @ts-nocheck
import { useState, useEffect } from "react";
import PuntoDeVenta from "./pages/PuntoDeVenta";
import GestionProductos from "./pages/GestionProductos";
import Dashboard from "./pages/Dashboard";
import ReportesHistorial from "./pages/ReportesHistorial";
import GestionClientes from "./pages/GestionClientes";
import GestionEmpresa from "./pages/GestionEmpresa";
import GestionBaseDatos from "./pages/GestionBaseDatos";
import ModalImpresiones from "./impresiones/ModalImpresiones";
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

function VisorImpresionVentana() {
  const urlPdf = `${API_URL}/api/impresiones/ver-pdf-temporal`;

  const forzarCierre = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.destroy();
    } catch {
      window.close();
    }
  };

  const mandarAImprimirDirecto = () => {
    const embedEl = document.getElementById('visor-pdf-nativo');
    if (embedEl) {
      try {
        // En WebView2 de Windows, print() directo sobre el embed abre el diálogo nativo
        embedEl.print();
        return;
      } catch (e) {
        console.warn("Intento de print sobre embed falló, probando foco:", e);
      }
    }

    // Fallback: enfocar y llamar print global
    window.focus();
    window.print();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
      <header style={{ height: '50px', minHeight: '50px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', color: '#fff', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>
          <span>📄</span>
          <span>Vista Previa de Impresión - Papelería Asadel</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={mandarAImprimirDirecto}
            style={{ 
              backgroundColor: '#16a34a', 
              color: '#fff', 
              border: 'none', 
              padding: '8px 18px', 
              borderRadius: '6px', 
              fontWeight: 'bold', 
              cursor: 'pointer', 
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            🖨️ Mandar a Imprimir
          </button>
          <button
            type="button"
            onClick={forzarCierre}
            style={{ 
              backgroundColor: '#dc2626', 
              color: '#fff', 
              border: 'none', 
              padding: '8px 14px', 
              borderRadius: '6px', 
              fontWeight: 'bold', 
              cursor: 'pointer', 
              fontSize: '13px' 
            }}
          >
            ✕ Cerrar Ventana
          </button>
        </div>
      </header>
      
      {/* Usamos <embed> en lugar de <iframe> para que responda a comandos directos y teclado */}
      <embed
        id="visor-pdf-nativo"
        src={urlPdf}
        type="application/pdf"
        style={{ flex: 1, width: '100%', height: 'calc(100vh - 50px)', border: 'none' }}
      />
    </div>
  );
}

function App() {
  // 1. EVALUAR PRIMERO: Si es visor de impresión, NO ejecutar nada del POS ni interceptar la "X"
  if (window.location.search.includes('modo=visor_impresion') || window.location.hash.includes('visor_impresion')) {
    return <VisorImpresionVentana />;
  }

  // A partir de aquí sigue el código normal de tu punto de venta...
  const [iniciandoApp, setIniciandoApp] = useState<boolean>(true);
  const [mostrarModalSalir, setMostrarModalSalir] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIniciandoApp(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Interceptar la "X" de Windows limpiamente a la primera
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

    try {
      fetch(`${API_URL}/api/sistema/apagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      }).catch(() => {});
    } catch (e) {}

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
            ? ['dashboard', 'ventas', 'productos', 'reportes', 'impresiones', 'empresa', 'clientes', 'basedatos'] 
            : ['ventas', 'impresiones'];
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
            ? ['dashboard', 'ventas', 'productos', 'reportes', 'impresiones', 'empresa', 'clientes', 'basedatos'] 
            : ['ventas', 'impresiones'];
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

  // Si la ventana fue abierta como visor de impresión dedicado
  if (window.location.search.includes('modo=visor_impresion') || window.location.hash.includes('visor_impresion')) {
    return <VisorImpresionVentana />;
  }

  return (
    <>
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

              {/* MÓDULO ANTES DE EMPRESA */}
              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('impresiones')) && (
                <button
                  className={moduloActivo === "impresiones" ? "active" : ""}
                  style={{ borderLeft: moduloActivo === "impresiones" ? "4px solid #8b5cf6" : "none" }}
                  onClick={() => seleccionarModulo("impresiones")}
                >
                  4. IMPRESIONES / COLOR
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('empresa')) && (
                <button
                  className={moduloActivo === "empresa" ? "active" : ""}
                  onClick={() => seleccionarModulo("empresa")}
                >
                  5. EMPRESA
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('clientes')) && (
                <button
                  className={`nav-btn ${moduloActivo === 'clientes' ? 'active' : ''}`}
                  onClick={() => seleccionarModulo('clientes')}
                >
                  6. CLIENTES Y LEALTAD
                </button>
              )}

              {(usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('basedatos')) && (
                <button
                  className={moduloActivo === "basedatos" ? "active" : ""}
                  onClick={() => seleccionarModulo("basedatos")}
                >
                  7. BASE DE DATOS
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
            {/* VISTA COMPLETA DE IMPRESIONES */}
            {moduloActivo === "impresiones" && (usuarioActual.rol === 'admin' || (usuarioActual.permisos || []).includes('impresiones')) && (
              <ModalImpresiones irAVentas={() => seleccionarModulo("caja")} />
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

      {/* MODAL LIMPIO DE CONFIRMACIÓN DE SALIDA */}
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