import React, { useEffect, useState } from 'react';
import logoPorDefecto from '../assets/Logo.jpg';
import './SplashScreen.css';

export default function SplashScreen({ cargando, logo }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!cargando) {
      // Espera 500ms tras el fade-out para desmontar del DOM
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [cargando]);

  if (!visible) return null;

  return (
    <div className={`splash-overlay ${!cargando ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <img 
          src={logo || logoPorDefecto} 
          alt="Asadel Nube" 
          className="splash-logo" 
        />
        <h1 className="splash-title">PUNTO DE VENTA ASADEL</h1>
        <div className="splash-loader-track">
          <div className="splash-loader-bar"></div>
        </div>
        <p className="splash-status">Iniciando sistema y base de datos...</p>
      </div>
    </div>
  );
}