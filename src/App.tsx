import { useState } from "react";
import PuntoDeVenta from "./pages/PuntoDeVenta";
import GestionProductos from "./pages/GestionProductos";
import Dashboard from "./pages/Dashboard"; // 👈 1. Importamos el componente Dashboard
import logoAsadel from "./assets/Logo.jpg";
import "./App.css";

function App() {
  // Estado para controlar la pestaña/módulo activo (iniciamos en dashboard)
  const [moduloActivo, setModuloActivo] = useState<string>("dashboard");

  return (
    <div className="app-container">
      {/* Menú Lateral (Sidebar) */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logoAsadel} alt="ASADEL" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          <button
            className={moduloActivo === "dashboard" ? "active" : ""}
            onClick={() => setModuloActivo("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={moduloActivo === "caja" ? "active" : ""}
            onClick={() => setModuloActivo("caja")}
          >
            1. VENTAS (Caja)
          </button>
          <button
            className={moduloActivo === "productos" ? "active" : ""}
            onClick={() => setModuloActivo("productos")}
          >
            2. PRODUCTOS
          </button>
          <button
            className={moduloActivo === "empresa" ? "active" : ""}
            onClick={() => setModuloActivo("empresa")}
          >
            3. EMPRESA
          </button>
          <button
            className={moduloActivo === "usuarios" ? "active" : ""}
            onClick={() => setModuloActivo("usuarios")}
          >
            4. USUARIOS
          </button>
          <button
            className={moduloActivo === "basedatos" ? "active" : ""}
            onClick={() => setModuloActivo("basedatos")}
          >
            5. BASE DE DATOS
          </button>
        </nav>
      </aside>

      {/* Área Principal de Trabajo */}
      <main className="main-content">
        {/* 👈 2. Renderizamos el Dashboard y le pasamos la función para cambiar de módulo */}
        {moduloActivo === "dashboard" && <Dashboard cambiarModulo={setModuloActivo} />}
        {moduloActivo === "caja" && <PuntoDeVenta />}
        {moduloActivo === "productos" && <GestionProductos />}
        {moduloActivo === "empresa" && <div>Vista de Empresa (En construcción)</div>}
        {moduloActivo === "usuarios" && <div>Vista de Usuarios (En construcción)</div>}
        {moduloActivo === "basedatos" && <div>Vista de Base de Datos (En construcción)</div>}
      </main>
    </div>
  );
}

export default App;