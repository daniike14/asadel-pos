// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { procesarArchivoImpresion } from '../utils/analizadorColor';
import * as pdfjsLib from 'pdfjs-dist';
import { analizarCanvasColor } from '../utils/analizadorColor';
import { API_URL } from '../config';
import './ModalImpresiones.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
let lockProcesamientoTauri = false;

export default function ModalImpresiones({ irAVentas }) {
  const [cargando, setCargando] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [archivoObjeto, setArchivoObjeto] = useState(null);
  const [paginas, setPaginas] = useState([]);
  const [arrastrandoEnTauri, setArrastrandoEnTauri] = useState(false);

  // Reglas tarifarias de CyberPlanet
  const [reglasTarifas, setReglasTarifas] = useState({ negro: [], color: [] });
  const reglasTarifasRef = useRef({ negro: [], color: [] });
  const [mostrarModalTarifas, setMostrarModalTarifas] = useState(false);

  // Insumo físico vinculado (Hojas de papel en inventario)
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [insumoPapelId, setInsumoPapelId] = useState('');
  const [insumoCantidadPorHoja, setInsumoCantidadPorHoja] = useState('1');
  const [busquedaInsumo, setBusquedaInsumo] = useState('');
  const [mostrarDropdownInsumo, setMostrarDropdownInsumo] = useState(false);
  const buscadorInsumoRef = useRef(null);

  // Cerrar el autocompletado si se hace clic fuera del recuadro
  useEffect(() => {
    const handleClickAfuera = (e) => {
      if (buscadorInsumoRef.current && !buscadorInsumoRef.current.contains(e.target)) {
        setMostrarDropdownInsumo(false);
      }
    };
    document.addEventListener('mousedown', handleClickAfuera);
    return () => document.removeEventListener('mousedown', handleClickAfuera);
  }, []);

  const [reglaSeleccionadaNegro, setReglaSeleccionadaNegro] = useState(null);
  const [reglaSeleccionadaColor, setReglaSeleccionadaColor] = useState(null);
  const [editorRegla, setEditorRegla] = useState(null);

  const cargarTarifas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/configuracion/tarifas-impresion`);
      if (res.ok) {
        const data = await res.json();
        setReglasTarifas(data);
        reglasTarifasRef.current = data;
        return data;
      }
    } catch (e) {
      console.warn('Error al cargar tarifas:', e);
    }
    return { negro: [], color: [] };
  };

  const cargarConfiguracionInsumo = async () => {
    try {
      const [resConfig, resProds] = await Promise.all([
        fetch(`${API_URL}/api/configuracion/impresiones`),
        fetch(`${API_URL}/api/productos`)
      ]);
      if (resConfig.ok) {
        const data = await resConfig.json();
        if (data.insumo_producto_id) setInsumoPapelId(String(data.insumo_producto_id));
        if (data.insumo_cantidad !== undefined) setInsumoCantidadPorHoja(String(data.insumo_cantidad));
      }
      if (resProds.ok) {
        const prods = await resProds.json();
        setCatalogoProductos(prods.filter(p => !p.esServicio && !p.esKit));
      }
    } catch (e) {
      console.warn('Error cargando insumos:', e);
    }
  };

  useEffect(() => {
    cargarTarifas();
    cargarConfiguracionInsumo();
  }, []);

  const guardarConfiguracionInsumo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/configuracion/impresiones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insumo_producto_id: insumoPapelId ? parseInt(insumoPapelId, 10) : null,
          insumo_cantidad: parseFloat(insumoCantidadPorHoja) || 1
        })
      });
      if (res.ok) {
        alert('Configuración del insumo de papel guardada exitosamente.');
      }
    } catch {
      alert('Error de conexión al guardar el insumo.');
    }
  };

  const procesarPaginasDesdePdfBuffer = async (arrayBuffer, nombre, tarifasActivas = null) => {
    const tarifas = tarifasActivas || reglasTarifasRef.current;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const listaPaginas = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewportOriginal = page.getViewport({ scale: 1 });
      const scale = 750 / viewportOriginal.width;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      const clasificacion = analizarCanvasColor(canvas, tarifas);
      const miniatura = canvas.toDataURL('image/jpeg', 0.8);

      listaPaginas.push({
        numeroPagina: pageNum,
        tipo: clasificacion.tipo,
        nombreTarifa: clasificacion.nombreTarifa,
        precio: clasificacion.precio,
        porcentaje: clasificacion.porcentajeEvaluar,
        miniatura
      });
    }

    setPaginas(listaPaginas);
    setArchivoNombre(nombre);
    const blobPdf = new Blob([arrayBuffer], { type: 'application/pdf' });
    setArchivoObjeto(blobPdf);
  };

  const procesarSeleccionManual = async (file) => {
    if (!file) return;
    setCargando(true);
    setArchivoNombre(file.name);
    try {
      const { paginas: resPaginas, archivoPdfParaImprimir } = await procesarArchivoImpresion(file, reglasTarifas);
      setPaginas(resPaginas);
      setArchivoObjeto(archivoPdfParaImprimir || file);
    } catch (err) {
      console.error(err);
      alert('Error al leer el archivo. Asegúrate de que LibreOffice esté disponible.');
    } finally {
      setCargando(false);
    }
  };

  const procesarRutaDiscoTauri = async (rutaArchivo) => {
    setCargando(true);
    try {
      let tarifas = reglasTarifasRef.current;
      if (!tarifas.negro.length && !tarifas.color.length) {
        tarifas = await cargarTarifas();
      }

      const res = await fetch(`${API_URL}/api/impresiones/procesar-archivo-disco`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rutaArchivo })
      });

      if (!res.ok) throw new Error('Error al procesar el archivo en el servidor');

      const data = await res.json();

      if (data.esPdf) {
        const binaryString = atob(data.pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await procesarPaginasDesdePdfBuffer(bytes.buffer, data.nombreArchivo, tarifas);
      } else {
        const byteCharacters = atob(data.base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType });
        const fileObj = new File([blob], data.nombreArchivo, { type: data.mimeType });
        await procesarSeleccionManual(fileObj);
      }
    } catch (err) {
      console.error(err);
      alert('Error al procesar el archivo arrastrado. Revisa que el servidor esté activo.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let unlisten = null;

    const setupTauri = async () => {
      try {
        if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();

          unlisten = await appWindow.onDragDropEvent((event) => {
            if (event.payload.type === 'over') {
              setArrastrandoEnTauri(true);
            } else if (event.payload.type === 'drop') {
              setArrastrandoEnTauri(false);
              const paths = event.payload.paths;

              if (paths && paths.length > 0) {
                if (lockProcesamientoTauri) return;
                lockProcesamientoTauri = true;

                procesarRutaDiscoTauri(paths[0]).finally(() => {
                  setTimeout(() => {
                    lockProcesamientoTauri = false;
                  }, 1200);
                });
              }
            } else {
              setArrastrandoEnTauri(false);
            }
          });
        }
      } catch (e) {
        console.log('Modo navegador web activo.');
      }
    };

    setupTauri();

    return () => {
      if (unlisten) unlisten();
    };
  }, [reglasTarifas]);

  const cambiarTarifaManualPagina = (index, tarifaNombre, tipo) => {
    const lista = tipo === 'color' ? reglasTarifas.color : reglasTarifas.negro;
    const reglaEncontrada = lista.find(r => r.nombre === tarifaNombre);
    if (!reglaEncontrada) return;

    setPaginas(prev => prev.map((p, i) => i === index ? {
      ...p,
      tipo,
      nombreTarifa: reglaEncontrada.nombre,
      precio: reglaEncontrada.precio
    } : p));
  };

  const forzarTodasBN = () => {
    const primeraReglaNegro = reglasTarifas.negro[0] || { nombre: 'Texto', precio: 2.0 };
    setPaginas(prev => prev.map(p => ({
      ...p,
      tipo: 'negro',
      nombreTarifa: primeraReglaNegro.nombre,
      precio: primeraReglaNegro.precio
    })));
  };

  const importeTotal = paginas.reduce((acc, p) => acc + (p.precio || 0), 0);

  const resumenPorTarifa = paginas.reduce((acc, p) => {
    const clave = `${p.nombreTarifa} ($${p.precio.toFixed(2)})`;
    if (!acc[clave]) {
      acc[clave] = { nombre: p.nombreTarifa, precio: p.precio, cantidad: 0 };
    }
    acc[clave].cantidad++;
    return acc;
  }, {});

  const mandarACaja = async (debeImprimir = false) => {
    if (paginas.length === 0) return;

    if (debeImprimir) {
      try {
        const esTauri = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

        if (esTauri) {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const windowLabel = `visor-print-${Date.now()}`;

          const ventanaVisor = new WebviewWindow(windowLabel, {
            url: `${API_URL}/api/impresiones/ver-pdf-temporal`,
            title: `Impresión - ${archivoNombre || 'Documento Asadel'}`,
            width: 1000,
            height: 780,
            center: true,
            resizable: true,
            alwaysOnTop: true,
            focus: true
          });

          ventanaVisor.once('tauri://error', (err) => {
            console.error('Error al instanciar ventana Tauri:', err);
            fetch(`${API_URL}/api/impresiones/lanzar-visor-edge`, { method: 'POST' });
          });
        } else {
          const urlPdfServidor = `${API_URL}/api/impresiones/ver-pdf-temporal`;
          const ventanaPrint = window.open(urlPdfServidor, '_blank');
          if (ventanaPrint) ventanaPrint.focus();
        }
      } catch (err) {
        console.error('Error al lanzar la ventana de impresión:', err);
      }
    }

    const carritoExistente = JSON.parse(localStorage.getItem('asadel_carrito_temporal') || '[]');
    const nuevosItems = [];
    const marcaTiempo = Date.now();

    const idInsumoFinal = insumoPapelId ? parseInt(insumoPapelId, 10) : null;
    const cantInsumoPorHoja = parseFloat(insumoCantidadPorHoja) || 1;

    Object.values(resumenPorTarifa).forEach((item, idx) => {
      nuevosItems.push({
        id: 0,
        id_busqueda: `IMP_${marcaTiempo}_${idx}`,
        id_unico: `IMP_${marcaTiempo}_${idx}_${Math.random()}`,
        nombre: `Impresión ${item.nombre} (${item.cantidad} pz)`,
        codigo: 'IMP-SERV',
        precioUnitario: item.precio,
        cantidad: item.cantidad,
        descuento: 0,
        comentario: `Archivo: ${archivoNombre || 'Documento'}`,
        ubicacion: 'Impresora',
        stock: 0,
        invMinimo: 0,
        piezasPorPaquete: 1,
        noInventariado: false,
        esServicio: true,
        aGranel: false,
        esKit: false,
        esVentaPaquete: false,
        insumo_producto_id: idInsumoFinal,
        insumo_cantidad: cantInsumoPorHoja,
        insumo_stock: 0
      });
    });

    const carritoActualizado = [...carritoExistente, ...nuevosItems];
    localStorage.setItem('asadel_carrito_temporal', JSON.stringify(carritoActualizado));
    window.dispatchEvent(new Event('asadel-actualizar-carrito'));

    setPaginas([]);
    setArchivoNombre('');
    setArchivoObjeto(null);

    if (irAVentas) irAVentas();
  };

  const guardarReglaEditor = async (e) => {
    e.preventDefault();
    const { modo, tipo, regla } = editorRegla;
    try {
      if (modo === 'nueva') {
        await fetch(`${API_URL}/api/configuracion/tarifas-impresion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...regla, tipo })
        });
      } else {
        await fetch(`${API_URL}/api/configuracion/tarifas-impresion/${regla.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(regla)
        });
      }
      setEditorRegla(null);
      await cargarTarifas();
    } catch {
      alert('Error al guardar la regla.');
    }
  };

  const eliminarRegla = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta regla tarifaria?')) return;
    try {
      await fetch(`${API_URL}/api/configuracion/tarifas-impresion/${id}`, { method: 'DELETE' });
      await cargarTarifas();
      setReglaSeleccionadaNegro(null);
      setReglaSeleccionadaColor(null);
    } catch {
      alert('Error al eliminar regla.');
    }
  };

  return (
    <div className="impresiones-page-container">
      <header className="impresiones-header">
        <div>
          <h2>🖨️ MÓDULO DE IMPRESIONES Y COBERTURA DE COLOR</h2>
          <p>Detección automática por tramos de porcentaje de cobertura (B/N y Color).</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#e2e8f0', color: '#1e293b' }}
            onClick={() => setMostrarModalTarifas(true)}
          >
            ⚙️ Reglas Tarifarias e Insumos
          </button>
          {paginas.length > 0 && (
            <button className="btn-secondary" onClick={() => { setPaginas([]); setArchivoNombre(''); }}>
              ✕ Limpiar
            </button>
          )}
        </div>
      </header>

      <div
        className={`impresiones-dropzone ${arrastrandoEnTauri ? 'tauri-dragging' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        <input
          type="file"
          id="input-archivo-impresion"
          accept=".pdf,.docx,image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              procesarSeleccionManual(e.target.files[0]);
            }
          }}
        />
        <label htmlFor="input-archivo-impresion" className="dropzone-label">
          <span style={{ fontSize: '42px' }}>📄</span>
          <strong>Arrastra aquí el documento PDF, Word (.docx) o imagen de WhatsApp</strong>
          <small>O haz clic para seleccionar archivo desde la computadora</small>
        </label>
      </div>

      {cargando && (
        <div className="loading-banner">
          ⏳ Procesando páginas y analizando cobertura cromática...
        </div>
      )}

      {paginas.length > 0 && !cargando && (
        <div className="impresiones-body">
          <div className="impresiones-toolbar">
            <div className="toolbar-info">
              <strong>Archivo:</strong> {archivoNombre} — <span>{paginas.length} página(s)</span>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="btn-badge-action" onClick={forzarTodasBN}>
                Forzar Todas a B/N
              </button>
            </div>
          </div>

          <div className="impresiones-grid">
            {paginas.map((pag, idx) => (
              <div key={idx} className={`hoja-card ${pag.tipo}`}>
                <div className="hoja-preview">
                  <img src={pag.miniatura} alt={`Página ${pag.numeroPagina}`} />
                  <span className="hoja-badge">Pág. {pag.numeroPagina}</span>
                </div>

                <div className="hoja-controles">
                  <select
                    value={`${pag.tipo}|${pag.nombreTarifa}`}
                    onChange={(e) => {
                      const [t, n] = e.target.value.split('|');
                      cambiarTarifaManualPagina(idx, n, t);
                    }}
                    className="select-hoja"
                  >
                    <optgroup label="Reglas Negro">
                      {reglasTarifas.negro.map(r => (
                        <option key={r.id} value={`negro|${r.nombre}`}>
                          {r.nombre} (${r.precio.toFixed(2)})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Reglas Color">
                      {reglasTarifas.color.map(r => (
                        <option key={r.id} value={`color|${r.nombre}`}>
                          {r.nombre} (${r.precio.toFixed(2)})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <span className="hoja-cobertura">
                    Cob: <strong>{pag.porcentaje}%</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="impresiones-footer-banner">
            <div className="resumen-estadisticas">
              {Object.entries(resumenPorTarifa).map(([k, item]) => (
                <div key={k} className="stat-item">
                  <span>{item.nombre} (${item.precio.toFixed(2)}):</span>
                  <strong>{item.cantidad} pzs (${(item.cantidad * item.precio).toFixed(2)})</strong>
                </div>
              ))}
              <div className="stat-item total">
                <span>TOTAL A COBRAR:</span>
                <h2>${importeTotal.toFixed(2)} MXN</h2>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn-enviar-caja" 
                style={{ backgroundColor: '#0284c7' }}
                onClick={() => mandarACaja(false)}
              >
                🛒 Solo Mandar a Caja
              </button>
              <button 
                className="btn-enviar-caja" 
                style={{ backgroundColor: '#16a34a' }}
                onClick={() => mandarACaja(true)}
              >
                🖨️ Mandar a Caja e Imprimir ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN CON REGLAS E INSUMOS */}
      {mostrarModalTarifas && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ width: '880px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Reglas tarifarias y Vinculación de Insumo</h2>
              <button className="btn-close-modal" onClick={() => setMostrarModalTarifas(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="panel-cyberplanet">
                  <h4 style={{ margin: '0 0 8px 0', textAlign: 'center' }}>Reglas de tipo Negro</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="tabla-cyber-container">
                      <table className="tabla-cyber">
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Hasta (%)</th>
                            <th>Precio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reglasTarifas.negro.map(r => (
                            <tr
                              key={r.id}
                              className={reglaSeleccionadaNegro?.id === r.id ? 'fila-activa' : ''}
                              onClick={() => setReglaSeleccionadaNegro(r)}
                            >
                              <td>{r.nombre}</td>
                              <td>{Number(r.hasta_porcentaje).toFixed(2)}</td>
                              <td>${Number(r.precio).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="cyber-actions">
                      <button
                        className="btn-cyber"
                        onClick={() => setEditorRegla({ modo: 'nueva', tipo: 'negro', regla: { nombre: '', hasta_porcentaje: '', precio: '' } })}
                      >
                        Nueva
                      </button>
                      <button
                        className="btn-cyber"
                        disabled={!reglaSeleccionadaNegro}
                        onClick={() => setEditorRegla({ modo: 'modificar', tipo: 'negro', regla: { ...reglaSeleccionadaNegro } })}
                      >
                        Modificar
                      </button>
                      <button
                        className="btn-cyber"
                        disabled={!reglaSeleccionadaNegro}
                        onClick={() => eliminarRegla(reglaSeleccionadaNegro.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="panel-cyberplanet">
                  <h4 style={{ margin: '0 0 8px 0', textAlign: 'center' }}>Reglas de tipo Color</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="tabla-cyber-container">
                      <table className="tabla-cyber">
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Hasta (%)</th>
                            <th>Precio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reglasTarifas.color.map(r => (
                            <tr
                              key={r.id}
                              className={reglaSeleccionadaColor?.id === r.id ? 'fila-activa' : ''}
                              onClick={() => setReglaSeleccionadaColor(r)}
                            >
                              <td>{r.nombre}</td>
                              <td>{Number(r.hasta_porcentaje).toFixed(2)}</td>
                              <td>${Number(r.precio).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="cyber-actions">
                      <button
                        className="btn-cyber"
                        onClick={() => setEditorRegla({ modo: 'nueva', tipo: 'color', regla: { nombre: '', hasta_porcentaje: '', precio: '' } })}
                      >
                        Nueva
                      </button>
                      <button
                        className="btn-cyber"
                        disabled={!reglaSeleccionadaColor}
                        onClick={() => setEditorRegla({ modo: 'modificar', tipo: 'color', regla: { ...reglaSeleccionadaColor } })}
                      >
                        Modificar
                      </button>
                      <button
                        className="btn-cyber"
                        disabled={!reglaSeleccionadaColor}
                        onClick={() => eliminarRegla(reglaSeleccionadaColor.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* VINCULACIÓN CON INSUMO DE HOJAS FÍSICAS */}
              {/* VINCULACIÓN CON INSUMO DE HOJAS FÍSICAS CON BUSCADOR INTERACTIVO */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>📦 Insumo de Papel a Descontar</h4>
                <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#64748b' }}>
                  Busca y selecciona el producto físico (ej. Hoja bond blanca, caja o paquete) que se restará del inventario en cada impresión cobrada.
                </p>

                <form onSubmit={guardarConfiguracionInsumo} style={{ display: 'grid', gridTemplateColumns: '2fr 130px auto', gap: '14px', alignItems: 'flex-start' }}>
                  
                  {/* Columna Buscador / Tarjeta del Insumo Seleccionado */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} ref={buscadorInsumoRef}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                      Producto de Inventario (Hojas):
                    </label>

                    {insumoPapelId ? (
                      // TARJETA DEL PRODUCTO VINCULADO
                      (() => {
                        const insumoSeleccionado = catalogoProductos.find(p => String(p.id) === String(insumoPapelId));
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#eff6ff',
                            border: '1.5px solid #93c5fd',
                            borderRadius: '6px',
                            padding: '8px 12px'
                          }}>
                            <div>
                              <strong style={{ color: '#1e40af', fontSize: '13px', display: 'block' }}>
                                📄 {insumoSeleccionado?.nombre || 'Insumo Vinculado'}
                              </strong>
                              <span style={{ fontSize: '11px', color: '#3b82f6' }}>
                                Cód: {insumoSeleccionado?.codigoBarras || 'S/N'} | Stock actual: <strong>{insumoSeleccionado?.invActual || 0} pzs</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setInsumoPapelId('');
                                setBusquedaInsumo('');
                              }}
                              style={{
                                backgroundColor: '#fee2e2',
                                border: '1px solid #fca5a5',
                                color: '#b91c1c',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                              title="Cambiar insumo"
                            >
                              ✕ Quitar
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      // INPUT DE BÚSQUEDA PREDICTIVA
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="🔍 Escribe para buscar (ej. hoja blanca, bond, opalina)..."
                          value={busquedaInsumo}
                          onChange={(e) => {
                            setBusquedaInsumo(e.target.value);
                            setMostrarDropdownInsumo(true);
                          }}
                          onFocus={() => {
                            if (busquedaInsumo.trim().length > 0) setMostrarDropdownInsumo(true);
                          }}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />

                        {mostrarDropdownInsumo && busquedaInsumo.trim().length > 0 && (
                          <ul style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                            maxHeight: '210px',
                            overflowY: 'auto',
                            zIndex: 10050,
                            listStyle: 'none',
                            margin: 0,
                            padding: '4px 0'
                          }}>
                            {catalogoProductos
                              .filter(p =>
                                p.nombre.toLowerCase().includes(busquedaInsumo.toLowerCase()) ||
                                (p.codigoBarras && p.codigoBarras.toLowerCase().includes(busquedaInsumo.toLowerCase()))
                              )
                              .slice(0, 10)
                              .map((prod) => (
                                <li
                                  key={prod.id}
                                  onClick={() => {
                                    setInsumoPapelId(String(prod.id));
                                    setBusquedaInsumo('');
                                    setMostrarDropdownInsumo(false);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid #f1f5f9',
                                    fontSize: '13px'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                >
                                  <div>
                                    <strong style={{ color: '#0f172a' }}>{prod.nombre}</strong>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      Cód: {prod.codigoBarras || 'S/N'}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
                                    Stock: {prod.invActual || 0} pzs
                                  </span>
                                </li>
                              ))}
                            {catalogoProductos.filter(p =>
                              p.nombre.toLowerCase().includes(busquedaInsumo.toLowerCase()) ||
                              (p.codigoBarras && p.codigoBarras.toLowerCase().includes(busquedaInsumo.toLowerCase()))
                            ).length === 0 && (
                              <li style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                                No se encontraron productos coincidentes
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Columna Hojas por cara */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                      Hojas por cara:
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={insumoCantidadPorHoja}
                      onChange={(e) => setInsumoCantidadPorHoja(e.target.value)}
                      style={{
                        padding: '9px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Botón Guardar */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{
                        padding: '9px 18px',
                        fontSize: '13px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px'
                      }}
                    >
                      💾 Guardar Insumo
                    </button>
                  </div>

                </form>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-confirm-modal" onClick={() => setMostrarModalTarifas(false)}>
                Listo / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {editorRegla && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-content" style={{ width: '380px' }}>
            <div className="modal-header">
              <h3>{editorRegla.modo === 'nueva' ? 'Nueva Regla' : 'Modificar Regla'} ({editorRegla.tipo.toUpperCase()})</h3>
              <button className="btn-close-modal" onClick={() => setEditorRegla(null)}>✕</button>
            </div>
            <form onSubmit={guardarReglaEditor} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="field-group">
                <label>Nombre de la regla:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Texto Color3"
                  value={editorRegla.regla.nombre}
                  onChange={(e) => setEditorRegla({ ...editorRegla, regla: { ...editorRegla.regla, nombre: e.target.value } })}
                />
              </div>
              <div className="field-group">
                <label>Hasta Cobertura (%):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  placeholder="Ej. 18.00"
                  value={editorRegla.regla.hasta_porcentaje}
                  onChange={(e) => setEditorRegla({ ...editorRegla, regla: { ...editorRegla.regla, hasta_porcentaje: e.target.value } })}
                />
              </div>
              <div className="field-group">
                <label>Precio por hoja (MXN):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  placeholder="Ej. 3.00"
                  value={editorRegla.regla.precio}
                  onChange={(e) => setEditorRegla({ ...editorRegla, regla: { ...editorRegla.regla, precio: e.target.value } })}
                />
              </div>

              <div className="modal-footer" style={{ marginTop: '10px' }}>
                <button type="button" className="btn-cancel-modal" onClick={() => setEditorRegla(null)}>Cancelar</button>
                <button type="submit" className="btn-confirm-modal">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}