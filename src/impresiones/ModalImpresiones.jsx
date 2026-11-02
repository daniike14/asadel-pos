// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { procesarArchivoImpresion, ensamblarDocumentosMultiples, bufferToBase64 } from '../utils/analizadorColor';
import * as pdfjsLib from 'pdfjs-dist';
import { analizarCanvasColor } from '../utils/analizadorColor';
import { API_URL } from '../config';
import './ModalImpresiones.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function ModalImpresiones({ irAVentas }) {
  const lockProcesamientoRef = useRef(false);
  const fileInputRef = useRef(null);

  const [cargando, setCargando] = useState(false);
  const [mensajeCarga, setMensajeCarga] = useState('');
  const [archivoNombre, setArchivoNombre] = useState('');
  const [paginas, setPaginas] = useState([]);
  const [arrastrandoEnTauri, setArrastrandoEnTauri] = useState(false);
  const [paginaAmpliada, setPaginaAmpliada] = useState(null);

  // Reglas tarifarias de CyberPlanet
  const [reglasTarifas, setReglasTarifas] = useState({ negro: [], color: [] });
  const reglasTarifasRef = useRef({ negro: [], color: [] });
  const [mostrarModalTarifas, setMostrarModalTarifas] = useState(false);

  // Insumo físico vinculado (Hojas de papel en inventario)
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [insumoPapelId, setInsumoPapelId] = useState(''); // Global predeterminado
  const [insumoCantidadPorHoja, setInsumoCantidadPorHoja] = useState('1');
  const [insumoActualTrabajo, setInsumoActualTrabajo] = useState(''); // Papel para la orden activa

  // Estados del modal selector de papel
  const [mostrarModalSelectorPapel, setMostrarModalSelectorPapel] = useState(false);
  const [filtroBuscadorPapel, setFiltroBuscadorPapel] = useState('');
  const inputBusquedaPapelRef = useRef(null);

  const [busquedaInsumo, setBusquedaInsumo] = useState('');
  const [mostrarDropdownInsumo, setMostrarDropdownInsumo] = useState(false);
  const buscadorInsumoRef = useRef(null);

  const [reglaSeleccionadaNegro, setReglaSeleccionadaNegro] = useState(null);
  const [reglaSeleccionadaColor, setReglaSeleccionadaColor] = useState(null);
  const [editorRegla, setEditorRegla] = useState(null);

  const toggleSeleccionPagina = (index) => {
    setPaginas(prev => prev.map((p, i) => i === index ? { ...p, seleccionada: !p.seleccionada } : p));
  };

  const seleccionarTodas = (estado) => {
    setPaginas(prev => prev.map(p => ({ ...p, seleccionada: estado })));
  };

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
        if (data.insumo_producto_id) {
          const idStr = String(data.insumo_producto_id);
          setInsumoPapelId(idStr);
          setInsumoActualTrabajo(idStr);
        }
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

  useEffect(() => {
    if (mostrarModalSelectorPapel && inputBusquedaPapelRef.current) {
      setTimeout(() => {
        inputBusquedaPapelRef.current?.focus();
      }, 60);
    }
  }, [mostrarModalSelectorPapel]);

  useEffect(() => {
    const handleClickAfuera = (e) => {
      if (buscadorInsumoRef.current && !buscadorInsumoRef.current.contains(e.target)) {
        setMostrarDropdownInsumo(false);
      }
    };
    document.addEventListener('mousedown', handleClickAfuera);
    return () => document.removeEventListener('mousedown', handleClickAfuera);
  }, []);

  useEffect(() => {
    const manejarTeclasVisor = (e) => {
      if (!paginaAmpliada) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setPaginaAmpliada(null);
      } else if (e.key === 'ArrowRight' && paginaAmpliada.idx < paginas.length - 1) {
        e.preventDefault();
        const siguiente = paginas[paginaAmpliada.idx + 1];
        setPaginaAmpliada({ ...siguiente, idx: paginaAmpliada.idx + 1 });
      } else if (e.key === 'ArrowLeft' && paginaAmpliada.idx > 0) {
        e.preventDefault();
        const anterior = paginas[paginaAmpliada.idx - 1];
        setPaginaAmpliada({ ...anterior, idx: paginaAmpliada.idx - 1 });
      }
    };

    window.addEventListener('keydown', manejarTeclasVisor);
    return () => window.removeEventListener('keydown', manejarTeclasVisor);
  }, [paginaAmpliada, paginas]);

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

  const convertirImagenAPdfBuffer = async (dataUrl) => {
    const { PDFDocument: PDFLibDoc } = await import('pdf-lib');
    const doc = await PDFLibDoc.create();
    const page = doc.addPage([612, 792]);

    const base64Puro = dataUrl.split(',')[1];
    const binary = atob(base64Puro);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    let imgEmbed;
    if (dataUrl.includes('image/png')) {
      imgEmbed = await doc.embedPng(bytes);
    } else {
      imgEmbed = await doc.embedJpg(bytes);
    }

    const { width, height } = imgEmbed.scaleToFit(572, 752);
    page.drawImage(imgEmbed, {
      x: (612 - width) / 2,
      y: (792 - height) / 2,
      width,
      height
    });

    return await doc.save();
  };

  const analizarImagenIndividual = async (nombre, dataUrlOrBase64, mimeType = 'image/png') => {
    const dataUrl = dataUrlOrBase64.startsWith('data:') 
      ? dataUrlOrBase64 
      : `data:${mimeType};base64,${dataUrlOrBase64}`;

    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 900 / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const clasificacion = analizarCanvasColor(canvas, reglasTarifasRef.current);

    if (clasificacion.esBlanca) {
      return { paginas: [], nombre };
    }

    const miniatura = canvas.toDataURL('image/jpeg', 0.8);
    const pdfBufferImagen = await convertirImagenAPdfBuffer(dataUrl);

    return {
      paginas: [{
        numeroPaginaOriginal: 1,
        archivoOrigen: nombre,
        bufferOriginal: pdfBufferImagen,
        tipo: clasificacion.tipo,
        nombreTarifa: clasificacion.nombreTarifa,
        precio: clasificacion.precio,
        porcentaje: clasificacion.porcentajeEvaluar,
        miniatura,
        seleccionada: true
      }],
      nombre
    };
  };

  const analizarPdfBufferIndividual = async (arrayBuffer, nombre, tarifasActivas = null) => {
    const tarifas = tarifasActivas || reglasTarifasRef.current;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    const paginasValidas = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewportOriginal = page.getViewport({ scale: 1 });
      const scale = Math.min(1, 450 / viewportOriginal.width);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      const clasificacion = analizarCanvasColor(canvas, tarifas);

      if (clasificacion.esBlanca || clasificacion.porcentajeEvaluar === 0) {
        continue;
      }

      const miniatura = canvas.toDataURL('image/jpeg', 0.8);

      paginasValidas.push({
        numeroPaginaOriginal: pageNum,
        archivoOrigen: nombre,
        bufferOriginal: arrayBuffer,
        tipo: clasificacion.tipo,
        nombreTarifa: clasificacion.nombreTarifa,
        precio: clasificacion.precio,
        porcentaje: clasificacion.porcentajeEvaluar,
        miniatura,
        seleccionada: true
      });
    }

    return { paginas: paginasValidas, nombre };
  };

  const acumularPaginasAlEstado = (nuevasPaginas, nombreArchivo) => {
    if (!nuevasPaginas || nuevasPaginas.length === 0) return;

    setPaginas(prevExistentes => {
      const baseIndice = prevExistentes.length;
      const indexadas = nuevasPaginas.map((p, idx) => ({
        ...p,
        numeroPagina: baseIndice + idx + 1
      }));
      return [...prevExistentes, ...indexadas];
    });

    setArchivoNombre(prev => prev ? `${prev} + ${nombreArchivo}` : nombreArchivo);
  };

  const procesarRutaDiscoTauri = async (rutaArchivo) => {
    let tarifas = reglasTarifasRef.current;
    if (!tarifas.negro.length && !tarifas.color.length) {
      tarifas = await cargarTarifas();
    }

    const res = await fetch(`${API_URL}/api/impresiones/procesar-archivo-disco`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rutaArchivo })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Error leyendo: ${rutaArchivo}`);
    }

    const data = await res.json();

    if (data.esPdf) {
      const binaryString = atob(data.pdfBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const resultado = await analizarPdfBufferIndividual(bytes.buffer, data.nombreArchivo, tarifas);
      acumularPaginasAlEstado(resultado.paginas, resultado.nombre);
    } else {
      const resultado = await analizarImagenIndividual(data.nombreArchivo, data.base64Data, data.mimeType);
      acumularPaginasAlEstado(resultado.paginas, resultado.nombre);
    }
  };

  const procesarMultiplesRutasTauri = async (listaRutas) => {
    setCargando(true);
    for (let i = 0; i < listaRutas.length; i++) {
      const ruta = listaRutas[i];
      setMensajeCarga(`Procesando archivo ${i + 1} de ${listaRutas.length}...`);
      try {
        await procesarRutaDiscoTauri(ruta);
      } catch (errArchivo) {
        console.error(`Error procesando archivo ${ruta}:`, errArchivo);
      }
    }
    setCargando(false);
    setMensajeCarga('');
  };

  const procesarSeleccionManual = async (file) => {
    if (!file) return;

    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        const resultado = await analizarImagenIndividual(file.name, dataUrl, file.type);
        acumularPaginasAlEstado(resultado.paginas, resultado.nombre);
        return;
      }

      const { paginas: resPaginas, pdfArrayBuffer } = await procesarArchivoImpresion(file, reglasTarifasRef.current);
      if (!resPaginas || resPaginas.length === 0) return;

      const paginasValidas = resPaginas.map((p, idx) => ({
        ...p,
        numeroPaginaOriginal: p.numeroPaginaOriginal || (idx + 1),
        archivoOrigen: file.name,
        bufferOriginal: pdfArrayBuffer,
        seleccionada: true
      }));

      acumularPaginasAlEstado(paginasValidas, file.name);

    } catch (err) {
      console.error(err);
      alert(`Error al leer el archivo "${file.name}".`);
    }
  };

  const procesarMultiplesArchivosManual = async (listaArchivos) => {
    setCargando(true);
    for (let i = 0; i < listaArchivos.length; i++) {
      setMensajeCarga(`Procesando archivo ${i + 1} de ${listaArchivos.length}...`);
      try {
        await procesarSeleccionManual(listaArchivos[i]);
      } catch (err) {
        console.error(err);
      }
    }
    setCargando(false);
    setMensajeCarga('');
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

// Procesar archivos recibidos desde la impresora virtual con retroalimentación visual
  const procesarItemsBuzon = async (items) => {
    if (!items || items.length === 0) return;

    try {
      setCargando(true);
      setMensajeCarga('Recibiendo documento de la impresora virtual...');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setMensajeCarga(`Analizando páginas del documento (${i + 1} de ${items.length})...`);

        const binaryString = atob(item.pdfBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        const resultado = await analizarPdfBufferIndividual(
          bytes.buffer,
          item.nombreArchivo,
          reglasTarifasRef.current
        );

        acumularPaginasAlEstado(resultado.paginas, resultado.nombre);
      }
    } catch (errParse) {
      console.error('Error analizando documento virtual:', errParse);
      alert('Hubo un inconveniente al procesar el documento recibido.');
    } finally {
      setCargando(false);
      setMensajeCarga('');
      // Disparar evento para quitar la etiqueta azul de App.tsx de inmediato
      window.dispatchEvent(new Event('asadel-impresiones-completadas'));
    }
  };

  useEffect(() => {
    const handleEventoBuzon = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        procesarItemsBuzon(e.detail);
      }
    };

    window.addEventListener('asadel-nuevas-impresiones-virtuales', handleEventoBuzon);
    return () => window.removeEventListener('asadel-nuevas-impresiones-virtuales', handleEventoBuzon);
  }, []);  

  useEffect(() => {
    let unlisten = null;
    lockProcesamientoRef.current = false;

    const setupTauri = async () => {
      try {
        if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();

          unlisten = await appWindow.onDragDropEvent(async (event) => {
            const payload = event.payload;
            if (!payload) return;

            if (payload.type === 'enter' || payload.type === 'over') {
              setArrastrandoEnTauri(true);
            } else if (payload.type === 'drop') {
              setArrastrandoEnTauri(false);
              const paths = payload.paths;

              if (paths && paths.length > 0) {
                if (lockProcesamientoRef.current) return;
                lockProcesamientoRef.current = true;

                try {
                  await procesarMultiplesRutasTauri(paths);
                } finally {
                  setTimeout(() => {
                    lockProcesamientoRef.current = false;
                  }, 600);
                }
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
      lockProcesamientoRef.current = false;
      if (unlisten) unlisten();
    };
  }, []);

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

  const forzarTodasColor = () => {
    const primeraReglaColor = reglasTarifas.color[0] || { nombre: 'Texto Color1', precio: 2.0 };
    setPaginas(prev => prev.map(p => ({
      ...p,
      tipo: 'color',
      nombreTarifa: primeraReglaColor.nombre,
      precio: primeraReglaColor.precio
    })));
  };

  const paginasActivas = paginas.filter(p => p.seleccionada);
  const importeTotal = paginasActivas.reduce((acc, p) => acc + (p.precio || 0), 0);

  const resumenPorTarifa = paginasActivas.reduce((acc, p) => {
    const clave = `${p.nombreTarifa} ($${p.precio.toFixed(2)})`;
    if (!acc[clave]) {
      acc[clave] = { nombre: p.nombreTarifa, precio: p.precio, cantidad: 0 };
    }
    acc[clave].cantidad++;
    return acc;
  }, {});

  const limpiarTodo = () => {
    setPaginas([]);
    setArchivoNombre('');
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const mandarACaja = async (debeImprimir = false) => {
    const paginasAProcesar = paginas.filter(p => p.seleccionada);

    if (paginasAProcesar.length === 0) {
      alert('Selecciona al menos una página para procesar la orden.');
      return;
    }

    if (debeImprimir) {
      try {
        setCargando(true);
        setMensajeCarga('Ensamblando documento de impresión...');

        const itemsParaEnsamblar = paginasAProcesar.map(p => ({
          bufferOriginal: p.bufferOriginal,
          numeroPaginaOriginal: p.numeroPaginaOriginal || 1
        }));

        const pdfUnificadoBytes = await ensamblarDocumentosMultiples(itemsParaEnsamblar);
        const base64Unificado = bufferToBase64(pdfUnificadoBytes);

        await fetch(`${API_URL}/api/impresiones/preparar-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data: base64Unificado,
            nombreArchivo: `Impresion_${paginasAProcesar.length}_hojas.pdf`,
            mimeType: 'application/pdf'
          })
        });

        const esTauri = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
        const marcaTiempo = Date.now();
        const urlFinal = `${API_URL}/api/impresiones/ver-pdf-temporal?v=${marcaTiempo}`;

        if (esTauri) {
          try {
            const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            const windowLabel = `visor-print-${marcaTiempo}`;

            const ventanaVisor = new WebviewWindow(windowLabel, {
              url: urlFinal,
              title: `Impresión (${paginasAProcesar.length} pág) - Asadel`,
              width: 1000,
              height: 780,
              center: true,
              resizable: true,
              alwaysOnTop: true,
              focus: true
            });

            await new Promise((resolve) => {
              ventanaVisor.once('tauri://created', () => resolve(true));
              ventanaVisor.once('tauri://error', (err) => {
                console.warn('Error en ventana Tauri, usando fallback:', err);
                fetch(`${API_URL}/api/impresiones/lanzar-visor-edge`, { method: 'POST' });
                resolve(false);
              });
              setTimeout(resolve, 600);
            });

          } catch (tauriErr) {
            console.warn('Error WebviewWindow, fallback Edge:', tauriErr);
            fetch(`${API_URL}/api/impresiones/lanzar-visor-edge`, { method: 'POST' });
          }
        } else {
          const ventanaPrint = window.open(urlFinal, '_blank');
          if (ventanaPrint) ventanaPrint.focus();
        }
      } catch (err) {
        console.error('Error al preparar impresión:', err);
      } finally {
        setCargando(false);
        setMensajeCarga('');
      }
    }

    const carritoExistente = JSON.parse(localStorage.getItem('asadel_carrito_temporal') || '[]');
    const nuevosItems = [];
    const marcaTiempo = Date.now();

    const idInsumoFinal = insumoActualTrabajo === 'ninguno' 
      ? null 
      : (insumoActualTrabajo ? parseInt(insumoActualTrabajo, 10) : (insumoPapelId ? parseInt(insumoPapelId, 10) : null));
    
    const cantInsumoPorHoja = parseFloat(insumoCantidadPorHoja) || 1;

    const productoInsumoObj = catalogoProductos.find(p => String(p.id) === String(idInsumoFinal));
    const etiquetaInsumo = productoInsumoObj ? ` | Papel: ${productoInsumoObj.nombre}` : (insumoActualTrabajo === 'ninguno' ? ' | Papel del cliente' : '');

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
        comentario: `Archivos: ${archivoNombre || 'Documentos'}${etiquetaInsumo}`,
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

    limpiarTodo();
    lockProcesamientoRef.current = false;

    setTimeout(() => {
      if (irAVentas) irAVentas();
    }, 150);
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

// Helper para saber qué papel está en uso
  const obtenerInfoPapelActivo = () => {
    if (insumoActualTrabajo === 'ninguno') {
      return { nombre: 'Papel del cliente (Sin descontar)', esEspecial: true, esPredet: false };
    }

    // Si coincide con el predeterminado del negocio
    if (String(insumoActualTrabajo) === String(insumoPapelId)) {
      const prodPred = catalogoProductos.find(p => String(p.id) === String(insumoPapelId));
      return { 
        nombre: prodPred?.nombre || 'Papel Predeterminado', 
        esEspecial: false, 
        esPredet: true 
      };
    }

    // Si tu papá eligió uno especial (ej. Opalina, Fotográfico)
    const prodEspecial = catalogoProductos.find(p => String(p.id) === String(insumoActualTrabajo));
    if (prodEspecial) {
      return { 
        nombre: prodEspecial.nombre, 
        esEspecial: true, 
        esPredet: false 
      };
    }

    return { nombre: 'Seleccionar Papel', esEspecial: false, esPredet: false };
  };
  

  // Lista filtrada para el modal de búsqueda de papel
  const listaPapelesFiltrados = catalogoProductos.filter(p => {
    const q = filtroBuscadorPapel.trim().toLowerCase();
    if (!q) return true;
    return p.nombre.toLowerCase().includes(q) || (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q));
  });

  return (
    <div className="impresiones-page-container">
      <input
        type="file"
        ref={fileInputRef}
        id="input-archivo-impresion"
        accept=".pdf,.docx,image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            procesarMultiplesArchivosManual(Array.from(e.target.files));
          }
        }}
      />

      <header className="impresiones-header">
        <div>
          <h2>🖨️ MÓDULO DE IMPRESIONES Y COBERTURA DE COLOR</h2>
          <p>Detección automática por tramos de porcentaje de cobertura (B/N y Color).</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {paginas.length > 0 && (
            <button
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 'bold' }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              ➕ Agregar otro archivo
            </button>
          )}
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#e2e8f0', color: '#1e293b' }}
            onClick={() => setMostrarModalTarifas(true)}
          >
            ⚙️ Reglas Tarifarias e Insumos
          </button>
          {paginas.length > 0 && (
            <button className="btn-secondary" onClick={limpiarTodo}>
              ✕ Limpiar
            </button>
          )}
        </div>
      </header>

      {/* ZONA DE ARRASTRE INICIAL */}
      {paginas.length === 0 && (
        <div
          className={`impresiones-dropzone ${arrastrandoEnTauri ? 'tauri-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              procesarMultiplesArchivosManual(Array.from(e.dataTransfer.files));
            }
          }}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <div className="dropzone-label">
            <span style={{ fontSize: '42px' }}>📄</span>
            <strong>Arrastra aquí uno o varios documentos PDF, Word (.docx) o imágenes (PNG, JPG, WhatsApp)</strong>
            <small>O haz clic para seleccionar varios archivos a la vez desde la computadora</small>
          </div>
        </div>
      )}

      {cargando && (
        <div className="loading-banner">
          ⏳ {mensajeCarga || 'Procesando páginas y analizando cobertura cromática...'}
        </div>
      )}

      {paginas.length > 0 && !cargando && (
        <div className="impresiones-body">
          <div className="impresiones-toolbar">
            <div className="toolbar-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '38vw' }}>
                <strong>Archivos:</strong> {archivoNombre}
              </span>
              <span>— <strong>{paginasActivas.length}</strong> de {paginas.length} página(s) seleccionadas</span>
            </div>
            <div className="toolbar-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* BOTÓN INDICADOR ELEGANTE PARA SELECCIONAR PAPEL */}
              {/* BOTÓN INDICADOR DE PAPEL CON ACCESO RÁPIDO */}
              {(() => {
                const infoPapel = obtenerInfoPapelActivo();
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn-badge-action"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: infoPapel.esEspecial ? '#eff6ff' : '#ffffff',
                        color: infoPapel.esEspecial ? '#1d4ed8' : '#334155',
                        border: infoPapel.esEspecial ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '12px'
                      }}
                      onClick={() => {
                        setFiltroBuscadorPapel('');
                        setMostrarModalSelectorPapel(true);
                      }}
                      title="Haz clic para cambiar el tipo de papel de esta orden"
                    >
                      <span>📄 {infoPapel.nombre}</span>
                      {infoPapel.esPredet && (
                        <span style={{ 
                          fontSize: '10px', 
                          backgroundColor: '#e0f2fe', 
                          color: '#0369a1', 
                          padding: '1px 5px', 
                          borderRadius: '3px', 
                          fontWeight: 'bold' 
                        }}>
                          Predet.
                        </span>
                      )}
                      <span style={{ fontSize: '9px', opacity: 0.6 }}>▼</span>
                    </button>

                    {/* BOTÓN RÁPIDO PARA RESTAURAR AL PREDETERMINADO SI CAMBIÓ EL PAPEL */}
                    {infoPapel.esEspecial && (
                      <button
                        type="button"
                        onClick={() => setInsumoActualTrabajo(String(insumoPapelId))}
                        style={{
                          backgroundColor: '#fee2e2',
                          border: '1px solid #fca5a5',
                          color: '#b91c1c',
                          borderRadius: '4px',
                          padding: '4px 6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                        title="Restaurar al papel predeterminado del negocio"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })()}

              <button 
                type="button" 
                className="btn-badge-action" 
                style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                ➕ Agregar archivo
              </button>
              <button 
                type="button" 
                className="btn-badge-action" 
                style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
                onClick={() => seleccionarTodas(false)}
              >
                Deseleccionar Todas
              </button>
              <button 
                type="button" 
                className="btn-badge-action" 
                style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
                onClick={() => seleccionarTodas(true)}
              >
                Seleccionar Todas
              </button>
              <button type="button" className="btn-badge-action" onClick={forzarTodasBN}>
                Forzar Todas a B/N
              </button>
              <button 
                type="button" 
                className="btn-badge-action" 
                style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                onClick={forzarTodasColor}
              >
                Forzar Todas a Color
              </button>
            </div>
          </div>

          <div className="impresiones-grid">
            {paginas.map((pag, idx) => (
              <div 
                key={idx} 
                className={`hoja-card ${pag.tipo} ${!pag.seleccionada ? 'hoja-deseleccionada' : ''}`}
              >
                <div 
                  className="hoja-preview"
                  onClick={() => setPaginaAmpliada({ ...pag, idx })}
                  title={`Haz clic para ver en grande (${pag.archivoOrigen || 'Documento'})`}
                >
                  {pag.miniatura ? (
                    <img src={pag.miniatura} alt={`Página ${pag.numeroPagina}`} />
                  ) : (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Cargando...</div>
                  )}

                  <label 
                    className="checkbox-hoja-container"
                    onClick={(e) => e.stopPropagation()}
                    title={pag.seleccionada ? "Desmarcar para no cobrar" : "Marcar para cobrar"}
                  >
                    <input 
                      type="checkbox" 
                      checked={Boolean(pag.seleccionada)} 
                      onChange={() => toggleSeleccionPagina(idx)} 
                    />
                  </label>

                  <span className="hoja-badge">Pág. {pag.numeroPagina}</span>
                  
                  <button
                    type="button"
                    className="btn-ver-hoja-hover"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaginaAmpliada({ ...pag, idx });
                    }}
                    title="Ampliar vista previa"
                  >
                    🔍
                  </button>
                </div>

                <div className="hoja-controles">
                  <select
                    value={`${pag.tipo}|${pag.nombreTarifa}`}
                    disabled={!pag.seleccionada}
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
                type="button"
                className="btn-enviar-caja" 
                style={{ backgroundColor: '#0284c7' }}
                onClick={() => mandarACaja(false)}
              >
                🛒 Solo Mandar a Caja
              </button>
              <button 
                type="button"
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

      {/* MODAL MODERNO: SELECTOR DE PAPEL CON BUSCADOR */}
      {mostrarModalSelectorPapel && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 10020 }}
          onClick={() => setMostrarModalSelectorPapel(false)}
        >
          <div 
            className="modal-content" 
            style={{ width: '560px', maxWidth: '95vw', borderRadius: '10px', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ backgroundColor: '#0f172a', padding: '14px 18px' }}>
              <h2 style={{ fontSize: '15px', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📄</span> Seleccionar Papel para esta Impresión
              </h2>
              <button 
                type="button" 
                className="btn-close-modal" 
                onClick={() => setMostrarModalSelectorPapel(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Buscador de papel */}
              <input
                ref={inputBusquedaPapelRef}
                type="text"
                placeholder="🔍 Escribe para buscar papel (ej. opalina, fotográfico, bond, oficio)..."
                value={filtroBuscadorPapel}
                onChange={(e) => setFiltroBuscadorPapel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />

              {/* OPCIONES FIJAS RÁPIDAS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* 1. Restaurar al papel predeterminado del negocio */}
                <div
                  onClick={() => {
                    setInsumoActualTrabajo(String(insumoPapelId));
                    setMostrarModalSelectorPapel(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: String(insumoActualTrabajo) === String(insumoPapelId) ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    backgroundColor: String(insumoActualTrabajo) === String(insumoPapelId) ? '#eff6ff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Vuelve a usar el papel configurado por defecto en el negocio"
                >
                  <div>
                    <strong style={{ fontSize: '12px', color: '#0369a1', display: 'block' }}>
                      ⭐ Usar Predeterminado
                    </strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      {catalogoProductos.find(p => String(p.id) === String(insumoPapelId))?.nombre || 'Configurado en reglas'}
                    </span>
                  </div>
                  {String(insumoActualTrabajo) === String(insumoPapelId) && (
                    <span style={{ color: '#0284c7', fontWeight: 'bold', fontSize: '13px' }}>✓</span>
                  )}
                </div>

                {/* 2. No descontar papel (Papel del cliente) */}
                <div
                  onClick={() => {
                    setInsumoActualTrabajo('ninguno');
                    setMostrarModalSelectorPapel(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: insumoActualTrabajo === 'ninguno' ? '2px solid #16a34a' : '1.5px dashed #cbd5e1',
                    backgroundColor: insumoActualTrabajo === 'ninguno' ? '#f0fdf4' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="El cliente trajo sus propias hojas"
                >
                  <div>
                    <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>
                      🚫 Papel del cliente
                    </strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>No se descuenta stock</span>
                  </div>
                  {insumoActualTrabajo === 'ninguno' && (
                    <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px' }}>✓</span>
                  )}
                </div>
              </div>

              {/* Separador visual */}
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                O elige un papel especial del inventario:
              </div>

              {/* Lista de papeles con scroll */}
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {listaPapelesFiltrados.map((prod) => {
                  const esSeleccionado = String(prod.id) === String(insumoActualTrabajo) && insumoActualTrabajo !== 'ninguno';
                  const esPredeterminado = String(prod.id) === String(insumoPapelId);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        setInsumoActualTrabajo(String(prod.id));
                        setMostrarModalSelectorPapel(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: esSeleccionado ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        backgroundColor: esSeleccionado ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!esSeleccionado) e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!esSeleccionado) e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{prod.nombre}</strong>
                          {esPredeterminado && (
                            <span style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              ★ Predeterminado
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Cód: {prod.codigoBarras || 'S/N'} {prod.locacion ? `| Loc: ${prod.locacion}` : ''}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: prod.invActual > 0 ? '#16a34a' : '#dc2626' }}>
                          {prod.invActual || 0} hojas disp.
                        </span>
                        {esSeleccionado && (
                          <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 'bold' }}>✓ Seleccionado</div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {listaPapelesFiltrados.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                    No se encontraron productos coincidentes en el catálogo.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setMostrarModalSelectorPapel(false)}
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Cerrar
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
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>📦 Insumo Predeterminado del Negocio</h4>
                <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#64748b' }}>
                  Este papel se cargará automáticamente por defecto en todas las impresiones.
                </p>

                <form onSubmit={guardarConfiguracionInsumo} style={{ display: 'grid', gridTemplateColumns: '2fr 130px auto', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} ref={buscadorInsumoRef}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                      Producto de Inventario (Hojas):
                    </label>

                    {insumoPapelId ? (
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
                                    setInsumoActualTrabajo(String(prod.id));
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

      {/* MODAL DE VISTA PREVIA AMPLIADA DE PÁGINA */}
      {paginaAmpliada && (
        <div 
          className="modal-visor-hoja-overlay"
          onClick={() => setPaginaAmpliada(null)}
        >
          <div 
            className="modal-visor-hoja-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="visor-hoja-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="hoja-badge" style={{ position: 'static', fontSize: '12px' }}>
                  Pág. {paginaAmpliada.numeroPagina} de {paginas.length}
                </span>
                <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 'bold' }}>
                  Tarifa: <strong style={{ color: paginaAmpliada.tipo === 'color' ? '#f59e0b' : '#38bdf8' }}>{paginaAmpliada.nombreTarifa}</strong> (${paginaAmpliada.precio.toFixed(2)})
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Cobertura: <strong>{paginaAmpliada.porcentaje}%</strong>
                </span>
                {paginaAmpliada.archivoOrigen && (
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                    ({paginaAmpliada.archivoOrigen})
                  </span>
                )}
              </div>

              <button 
                type="button" 
                className="btn-cerrar-visor-hoja"
                onClick={() => setPaginaAmpliada(null)}
                title="Cerrar (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="visor-hoja-body">
              {paginaAmpliada.idx > 0 && (
                <button
                  type="button"
                  className="btn-nav-visor prev"
                  onClick={() => setPaginaAmpliada({ ...paginas[paginaAmpliada.idx - 1], idx: paginaAmpliada.idx - 1 })}
                  title="Página anterior (←)"
                >
                  ◀
                </button>
              )}

              <div className="visor-hoja-sheet">
                <img
                  src={paginaAmpliada.miniatura}
                  alt={`Página ${paginaAmpliada.numeroPagina}`}
                  className={paginaAmpliada.tipo === 'negro' ? 'hoja-img-bn' : ''}
                />
              </div>

              {paginaAmpliada.idx < paginas.length - 1 && (
                <button
                  type="button"
                  className="btn-nav-visor next"
                  onClick={() => setPaginaAmpliada({ ...paginas[paginaAmpliada.idx + 1], idx: paginaAmpliada.idx + 1 })}
                  title="Página siguiente (→)"
                >
                  ▶
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}