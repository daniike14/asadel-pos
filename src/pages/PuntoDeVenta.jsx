import React, { useState, useEffect, useCallback, useRef } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './PuntoDeVenta.css';

const formatoEmpaque = (totalPiezas, piezasPorCaja) => {
  if (!piezasPorCaja || piezasPorCaja <= 1) {
    return `${totalPiezas} pzs`;
  }
  const cajas = Math.floor(totalPiezas / piezasPorCaja);
  const sueltas = totalPiezas % piezasPorCaja;

  if (cajas === 0) return `${sueltas} pzs sueltas`;
  if (sueltas === 0) return `${cajas} caja(s) (${totalPiezas} pzs tot.)`;
  return `${cajas} caja(s) + ${sueltas} pzs (${totalPiezas} pzs tot.)`;
};

export default function PuntoDeVenta() {
  const [catalogo, setCatalogo] = useState([]);
  const [promocionesActivas, setPromocionesActivas] = useState([
    { id: 'PROMO_NINGUNA', nombre: 'Sin promoción', tipo: 'ninguno', valor: 0 }
  ]);
  
  const [carrito, setCarrito] = useState(() => {
    const carritoGuardado = localStorage.getItem('asadel_carrito_temporal');
    return carritoGuardado ? JSON.parse(carritoGuardado) : [];
  });
  
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [imagenVisorFlotante, setImagenVisorFlotante] = useState(null);

  const [itemEditando, setItemEditando] = useState(null);
  const [mostrarModalEditarItem, setMostrarModalEditarItem] = useState(false);

  useEffect(() => {
    localStorage.setItem('asadel_carrito_temporal', JSON.stringify(carrito));
  }, [carrito]);

  const cargarDatosBD = async () => {
    try {
      const [resProd, resPromo] = await Promise.all([
        fetch('${API_URL}/api/productos'),
        fetch('${API_URL}/api/promociones')
      ]);

      if (resProd.ok) {
        const dataProd = await resProd.json();
        const normalizados = dataProd.map((p) => ({
          ...p,
          codigo: p.codigoBarras || '',
          precioUnitario: parseFloat(p.precioVenta) || 0,
          ubicacion: p.locacion || 'N/A',
          stock: p.invActual || 0,
          piezasPorCaja: p.piezasPorPaquete || 1,
          imagenLocacion: p.imagenLocacion || ''
        }));
        setCatalogo(normalizados);
      }

      if (resPromo.ok) {
        const dataPromo = await resPromo.json();
        const listaMapeada = [
          { id: 'PROMO_NINGUNA', nombre: 'Sin promoción', tipo: 'ninguno', valor: 0 },
          ...dataPromo.map(p => ({
            id: `PROMO_DB_${p.id}`,
            nombre: p.nombre,
            tipo: p.tipo,
            valor: p.valor
          }))
        ];
        setPromocionesActivas(listaMapeada);
      }
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
    }
  };

  useEffect(() => {
    cargarDatosBD();
  }, []);

  const [busqueda, setBusqueda] = useState('');
  const [ventasEnEspera, setVentasEnEspera] = useState([]);
  const [mostrarModalBusqueda, setMostrarModalBusqueda] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  
  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [montoTarjeta, setMontoTarjeta] = useState('');

  const [modalActivo, setModalActivo] = useState(null);
  const [movimientoMonto, setMovimientoMonto] = useState('');
  const [movimientoMotivo, setMovimientoMotivo] = useState('');
  const [busquedaChecador, setBusquedaChecador] = useState('');
  const [productoChecador, setProductoChecador] = useState(null);

  const inputBusquedaRef = useRef(null);

  const totalPagar = carrito.reduce((acc, item) => {
    const subtotal = item.precioUnitario * item.cantidad;
    const conDescuento = subtotal * (1 - (item.descuento || 0) / 100);
    return acc + conDescuento;
  }, 0);

  const efectivoNum = parseFloat(montoEfectivo) || 0;
  const tarjetaNum = parseFloat(montoTarjeta) || 0;
  const totalRecibido = efectivoNum + tarjetaNum;
  const cambio = totalRecibido >= totalPagar ? totalRecibido - totalPagar : 0;
  const restante = totalPagar > totalRecibido ? totalPagar - totalRecibido : 0;

  const cerrarChecador = () => {
    setBusquedaChecador('');
    setProductoChecador(null);
    setModalActivo(null);
  };

  const cambiarCantidadTabla = (idUnico, nuevaCantidad) => {
    const cantNum = parseInt(nuevaCantidad, 10);
    if (isNaN(cantNum) || cantNum <= 0) return;

    const itemCarrito = carrito.find((i) => (i.id_unico || i.id) === idUnico);
    if (!itemCarrito) return;

    const productoCatalogo = catalogo.find((p) => p.id === itemCarrito.id);
    const stockDisponible = productoCatalogo ? productoCatalogo.stock : 999;

    if (cantNum > stockDisponible) {
      alert(`⚠️ Stock insuficiente. Solo hay ${stockDisponible} piezas disponibles.`);
      return;
    }

    setCarrito((prev) =>
      prev.map((item) => ((item.id_unico || item.id) === idUnico ? { ...item, cantidad: cantNum } : item))
    );
  };

  const manejarCambioResultado = (id, campo, valor) => {
    setResultadosBusqueda((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (campo === 'promocionSeleccionada') {
          const promo = promocionesActivas.find((p) => p.id === valor);
          const esManual = promo?.tipo === 'manual';
          const porcentaje = promo?.tipo === 'porcentaje' ? promo.valor : 0;

          return {
            ...item,
            promocionId: valor,
            promocionNombre: promo?.nombre !== 'Sin promoción' ? promo?.nombre : '',
            esDescuentoManual: esManual,
            descuento: esManual ? item.descuento : porcentaje
          };
        }

        return { ...item, [campo]: valor };
      })
    );
  };

  const agregarAlCarrito = (producto, mantenerModalAbierto = false) => {
    const precioFinal = parseFloat(producto.precioUnitario) || 0;
    const descuentoFinal = parseFloat(producto.descuento) || 0;
    const comentarioFinal = (producto.comentario || '').trim();
    const cantAgregar = parseInt(producto.cantidadAgregar || 1, 10);

    const productoCatalogo = catalogo.find((p) => p.id === producto.id);
    const stockDisponible = productoCatalogo ? productoCatalogo.stock : 999;

    const cantidadEnCarrito = carrito
      .filter((item) => item.id === producto.id)
      .reduce((acc, item) => acc + item.cantidad, 0);

    if (cantidadEnCarrito + cantAgregar > stockDisponible) {
      alert(`⚠️ Stock insuficiente. Disponible: ${stockDisponible} pzs.`);
      return;
    }

    setCarrito((prevCarrito) => {
      const indiceExistente = prevCarrito.findIndex(
        (item) =>
          item.id === producto.id &&
          item.precioUnitario === precioFinal &&
          item.descuento === descuentoFinal &&
          (item.comentario || '').trim() === comentarioFinal
      );

      let nuevoCarrito = [...prevCarrito];

      if (indiceExistente !== -1) {
        nuevoCarrito[indiceExistente] = {
          ...nuevoCarrito[indiceExistente],
          cantidad: nuevoCarrito[indiceExistente].cantidad + cantAgregar
        };
        setProductoSeleccionado(nuevoCarrito[indiceExistente]);
      } else {
        const nuevoItem = {
          ...producto,
          id_unico: `${producto.id}_${Date.now()}_${Math.random()}`,
          precioUnitario: precioFinal,
          descuento: descuentoFinal,
          comentario: comentarioFinal,
          cantidad: cantAgregar,
          imagenLocacion: producto.imagenLocacion || ''
        };
        nuevoCarrito.push(nuevoItem);
        setProductoSeleccionado(nuevoItem);
      }

      return nuevoCarrito;
    });

    if (!mantenerModalAbierto) {
      setBusqueda('');
      setMostrarModalBusqueda(false);
      setResultadosBusqueda([]);
      setTimeout(() => inputBusquedaRef.current?.focus(), 100);
    }
  };

  const ejecutarBusqueda = (e) => {
    if (e) e.preventDefault();
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return;

    const coincidenciaCodigo = catalogo.find((prod) => prod.codigo.toLowerCase() === termino);
    if (coincidenciaCodigo) {
      agregarAlCarrito({
        ...coincidenciaCodigo,
        promocionId: 'PROMO_NINGUNA',
        promocionNombre: '',
        esDescuentoManual: false,
        descuento: 0,
        comentario: '',
        cantidadAgregar: 1,
        imagenLocacion: coincidenciaCodigo.imagenLocacion
      });
      return;
    }

    const coincidencias = catalogo.filter((prod) =>
      prod.nombre.toLowerCase().includes(termino)
    ).map((p) => ({
      ...p,
      precioOriginal: p.precioUnitario,
      promocionId: 'PROMO_NINGUNA',
      promocionNombre: '',
      esDescuentoManual: false,
      descuento: 0,
      comentario: '',
      cantidadAgregar: 1,
      imagenLocacion: p.imagenLocacion
    }));

    if (coincidencias.length > 0) {
      setResultadosBusqueda(coincidencias);
      setMostrarModalBusqueda(true);
    } else {
      alert(`No se encontraron productos para "${busqueda}".`);
    }
  };

  const eliminarSeleccionado = useCallback(() => {
    if (!productoSeleccionado) return;
    setCarrito((prevCarrito) => {
      const nuevoCarrito = prevCarrito.filter(
        (item) => (item.id_unico || item.id) !== (productoSeleccionado.id_unico || productoSeleccionado.id)
      );
      setProductoSeleccionado(nuevoCarrito[0] || null);
      return nuevoCarrito;
    });
  }, [productoSeleccionado]);

  const guardarVentaEnEspera = () => {
    if (carrito.length === 0) return alert('El carrito está vacío.');
    const nuevaEspera = {
      id: Date.now(),
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: [...carrito],
      total: totalPagar
    };
    setVentasEnEspera((prev) => [...prev, nuevaEspera]);
    setCarrito([]);
    setProductoSeleccionado(null);
    alert('Venta puesta en espera correctamente.');
  };

  const recuperarVentaEnEspera = (venta) => {
    setCarrito(venta.items);
    setProductoSeleccionado(venta.items[0] || null);
    setVentasEnEspera((prev) => prev.filter((v) => v.id !== venta.id));
    setModalActivo(null);
  };

  const consultarChecador = (e) => {
    e.preventDefault();
    const termino = busquedaChecador.trim().toLowerCase();
    const encontrado = catalogo.find(
      (p) => p.codigo.toLowerCase() === termino || p.nombre.toLowerCase().includes(termino)
    );
    setProductoChecador(encontrado || 'NO_ENCONTRADO');
  };

  const registrarMovimientoDinero = (e) => {
    e.preventDefault();
    const tipo = modalActivo === 'entrada' ? 'Entrada' : 'Salida';
    alert(`¡${tipo} de Dinero registrado exitosamente!\nMonto: $${movimientoMonto}\nMotivo: ${movimientoMotivo}`);
    setMovimientoMonto('');
    setMovimientoMotivo('');
    setModalActivo(null);
  };

  const procesarVenta = async (e) => {
    e.preventDefault();
    if (totalRecibido < totalPagar) {
      alert("El monto recibido no cubre el total a pagar.");
      return;
    }

    const payloadVenta = {
      folio: `FOL-${Date.now()}`,
      total: totalPagar,
      metodo_pago: montoEfectivo && montoTarjeta ? 'mixto' : montoEfectivo ? 'efectivo' : 'tarjeta',
      monto_efectivo: efectivoNum,
      monto_tarjeta: tarjetaNum,
      cajero: 'Turno 1',
      items: carrito
    };

    try {
      const res = await fetch('${API_URL}/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadVenta)
      });

      if (res.ok) {
        alert(`¡Venta guardada en la Base de Datos con éxito!\nCambio: $${cambio.toFixed(2)} MXN`);
        setCarrito([]);
        localStorage.removeItem('asadel_carrito_temporal');
        setProductoSeleccionado(null);
        setMostrarModalCobro(false);
        cargarDatosBD();
      }
    } catch (error) {
      alert('Error al guardar la venta en la base de datos.');
    }
  };

  useEffect(() => {
    const manejarTeclas = (event) => {
      if (event.key === 'F12' && !mostrarModalCobro && !mostrarModalBusqueda && !modalActivo && !mostrarModalEditarItem) {
        event.preventDefault();
        if (carrito.length > 0) {
          setMontoEfectivo(totalPagar.toString());
          setMostrarModalCobro(true);
        }
      }
      if (event.key === 'Delete' && !mostrarModalCobro && !mostrarModalBusqueda && !modalActivo && !mostrarModalEditarItem) {
        event.preventDefault();
        eliminarSeleccionado();
      }
      if (event.key === 'Escape') {
        setMostrarModalCobro(false);
        setMostrarModalBusqueda(false);
        setMostrarModalEditarItem(false);
        setBusquedaChecador('');
        setProductoChecador(null);
        setModalActivo(null);
        setImagenVisorFlotante(null); 
      }
    };
    window.addEventListener('keydown', manejarTeclas);
    return () => window.removeEventListener('keydown', manejarTeclas);
  }, [carrito.length, eliminarSeleccionado, modalActivo, mostrarModalBusqueda, mostrarModalCobro, mostrarModalEditarItem, totalPagar]);

  const productoFresco = productoSeleccionado ? catalogo.find(p => p.id === productoSeleccionado.id) : null;
  const imagenPrincipal = productoFresco?.imagen || productoSeleccionado?.imagen;
  const ubicacionTexto = productoFresco?.ubicacion || productoSeleccionado?.ubicacion || 'N/A';
  const fotoUbicacion = productoFresco?.imagenLocacion || productoSeleccionado?.imagenLocacion;

  return (
    <div className="pos-container">
      <header className="pos-header">
        <div className="pos-branding">
          <img src={logoAsadel} alt="Logo ASADEL" style={{ height: '30px' }} />
          <h2>VENTAS</h2>
        </div>
        <div className="pos-user-info">
          <span>[Cajero: Turno 1]</span>
        </div>
      </header>

      <form className="pos-search-bar" onSubmit={ejecutarBusqueda}>
        <label htmlFor="search-input">BÚSQUEDA:</label>
        <input
          ref={inputBusquedaRef}
          id="search-input"
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Escribe 'cuaderno' o escanea un código..."
          autoFocus
        />
        <button type="submit" className="btn-search">🔍</button>
      </form>

      <div className="pos-body">
        <div className="pos-left-panel">
          <div className="pos-table-wrapper">
            <table className="pos-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>CANT</th>
                  <th>PRODUCTO (Doble clic para editar)</th>
                  <th style={{ width: '90px' }}>PRECIO U.</th>
                  <th style={{ width: '80px' }}>DESC.</th>
                  <th style={{ width: '100px' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {carrito.map((item) => {
                  const keyItem = item.id_unico || item.id;
                  const isSelected = (productoSeleccionado?.id_unico || productoSeleccionado?.id) === keyItem;
                  const totalFila = (item.precioUnitario * item.cantidad) * (1 - (item.descuento || 0) / 100);

                  return (
                    <tr
                      key={keyItem}
                      className={isSelected ? 'selected-row' : ''}
                      onClick={() => setProductoSeleccionado(item)}
                      onDoubleClick={() => {
                        setProductoSeleccionado(item);
                        setItemEditando({ 
                          ...item, 
                          promocionId: item.promocionId || 'PROMO_NINGUNA',
                          esDescuentoManual: item.esDescuentoManual || false
                        });
                        setMostrarModalEditarItem(true);
                      }}
                      title="Doble clic para editar precio, promoción o notas"
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="qty-controls-table">
                          <button type="button" className="btn-qty-mini" onClick={(e) => { e.stopPropagation(); cambiarCantidadTabla(keyItem, item.cantidad - 1); }}>-</button>
                          <input type="number" className="input-qty-table" value={item.cantidad} onClick={(e) => e.stopPropagation()} onChange={(e) => cambiarCantidadTabla(keyItem, e.target.value)} min="1" />
                          <button type="button" className="btn-qty-mini" onClick={(e) => { e.stopPropagation(); cambiarCantidadTabla(keyItem, item.cantidad + 1); }}>+</button>
                        </div>
                      </td>
                      <td>
                        <div className="product-table-name">{item.nombre}</div>
                        {item.promocionNombre && <span className="product-table-promo">🏷️ {item.promocionNombre}</span>}
                        {item.comentario && <span className="product-table-comment">📝 Nota: {item.comentario}</span>}
                      </td>
                      <td>${item.precioUnitario.toFixed(2)}</td>
                      <td>{item.descuento ? `${item.descuento}%` : '-'}</td>
                      <td>${totalFila.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {carrito.length === 0 && (
                  <tr><td colSpan="5" className="empty-cart-message">No hay productos agregados a la venta activa</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pos-total-banner">
            <span>TOTAL A PAGAR:</span>
            <h2>${totalPagar.toFixed(2)}</h2>
          </div>

          <div className="pos-quick-actions">
            <button className="btn-secondary" onClick={() => setModalActivo('entrada')}>[Entrada Dinero]</button>
            <button className="btn-secondary" onClick={() => setModalActivo('salida')}>[Salida Dinero]</button>
            <button className="btn-secondary" onClick={() => { setBusquedaChecador(''); setProductoChecador(null); setModalActivo('checador'); }}>[Checador Precios]</button>
            <button className="btn-secondary" onClick={() => alert('Generando cotización...')}>[Cotización]</button>
            <button className="btn-secondary" onClick={() => setModalActivo('espera')}>[Venta en Espera] {ventasEnEspera.length > 0 && `(${ventasEnEspera.length})`}</button>
            <button className="btn-secondary" onClick={() => alert('Generando corte de turno...')}>[Cerrar Turno]</button>
          </div>
        </div>

        <div className="pos-right-panel">
          <div className="pos-viewer-card">
            <div className="image-box">
              {imagenPrincipal ? <img src={imagenPrincipal} alt={productoSeleccionado?.nombre} /> : <span>VISOR DE IMAGEN</span>}
            </div>
            
            <div className="location-tag" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              Loc: 
              {fotoUbicacion ? (
                <span style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setImagenVisorFlotante(fotoUbicacion)} title="Ver foto de ubicación">
                  {ubicacionTexto !== 'N/A' && ubicacionTexto !== '' ? ubicacionTexto : 'Ver Foto'} 📷
                </span>
              ) : (
                <span>{ubicacionTexto}</span>
              )}
            </div>

            <button className="btn-danger-outline" onClick={eliminarSeleccionado} disabled={!productoSeleccionado}>
              [Eliminar Selecc.] (Supr)
            </button>
          </div>

          <div className="pos-checkout-actions">
            <button className="btn-main btn-pay" onClick={() => { setMontoEfectivo(totalPagar.toString()); setMostrarModalCobro(true); }} disabled={carrito.length === 0}>[ COBRAR (F12) ]</button>
            <button className="btn-main btn-hold" onClick={guardarVentaEnEspera} disabled={carrito.length === 0}>[ TICKET PEND. ]</button>
            <button className="btn-main btn-print" onClick={() => setModalActivo('ticket')}>[ IMPRIMIR ]</button>
          </div>
        </div>
      </div>

      {/* MODAL EDITAR ÍTEM EN CARRITO */}
      {mostrarModalEditarItem && itemEditando && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h2>EDITAR: {itemEditando.nombre}</h2>
              <button className="btn-close-modal" onClick={() => setMostrarModalEditarItem(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="input-group-inline">
                <label>Cantidad:</label>
                <input type="number" min="1" value={itemEditando.cantidad} onChange={(e) => setItemEditando({ ...itemEditando, cantidad: parseInt(e.target.value, 10) || 1 })} />
              </div>
              <div className="input-group-inline">
                <label>Precio Unitario ($):</label>
                <input type="number" step="0.5" value={itemEditando.precioUnitario} onChange={(e) => setItemEditando({ ...itemEditando, precioUnitario: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="input-group-inline">
                <label>Promoción / Campaña:</label>
                <select
                  className="select-promo"
                  value={itemEditando.promocionId || 'PROMO_NINGUNA'}
                  onChange={(e) => {
                    const valor = e.target.value;
                    const promo = promocionesActivas.find((p) => p.id === valor);
                    const esManual = promo?.tipo === 'manual';
                    const porcentaje = promo?.tipo === 'porcentaje' ? promo.valor : 0;

                    setItemEditando({
                      ...itemEditando,
                      promocionId: valor,
                      promocionNombre: promo?.nombre !== 'Sin promoción' ? promo?.nombre : '',
                      esDescuentoManual: esManual,
                      descuento: esManual ? itemEditando.descuento : porcentaje
                    });
                  }}
                >
                  {promocionesActivas.map((promo) => (
                    <option key={promo.id} value={promo.id}>{promo.nombre}</option>
                  ))}
                </select>
              </div>
              {itemEditando.esDescuentoManual && (
                <div className="input-group-inline">
                  <label>% Descuento Especial:</label>
                  <input type="number" min="0" max="100" value={itemEditando.descuento || 0} onChange={(e) => setItemEditando({ ...itemEditando, descuento: parseFloat(e.target.value) || 0 })} />
                </div>
              )}
              <div className="input-group-inline">
                <label>Nota / Comentario:</label>
                <input type="text" value={itemEditando.comentario || ''} onChange={(e) => setItemEditando({ ...itemEditando, comentario: e.target.value })} placeholder="Ej. Tapa rayada, oferta, etc." />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel-modal" onClick={() => setMostrarModalEditarItem(false)}>Cancelar</button>
              <button type="button" className="btn-confirm-modal" onClick={() => {
                const keyUnico = itemEditando.id_unico || itemEditando.id;
                setCarrito((prev) => prev.map((i) => ((i.id_unico || i.id) === keyUnico ? itemEditando : i)));
                setMostrarModalEditarItem(false);
              }}>Actualizar Artículo</button>
            </div>
          </div>
        </div>
      )}

      {/* VISOR FLOTANTE IMAGEN */}
      {imagenVisorFlotante && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setImagenVisorFlotante(null)}>
          <div style={{ position: 'relative', maxWidth: '80vw', maxHeight: '80vh', backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setImagenVisorFlotante(null)} style={{ position: 'absolute', top: '-15px', right: '-15px', backgroundColor: '#0f172a', color: '#ffffff', border: '2px solid #ffffff', borderRadius: '50%', width: '40px', height: '40px', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', zIndex: 10 }}>✕</button>
            <img src={imagenVisorFlotante} alt="Locación ampliada" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '4px', objectFit: 'contain' }} />
          </div>
        </div>
      )}

      {mostrarModalBusqueda && (
        <div className="modal-overlay">
          <div className="modal-content modal-search-results">
            <div className="modal-header">
              <h2>COINCIDENCIAS ENCONTRADAS ({resultadosBusqueda.length})</h2>
              <button className="btn-close-modal" onClick={() => setMostrarModalBusqueda(false)}>✕</button>
            </div>
            <div className="modal-body search-list-body">
              <p className="search-instruction">Ajusta precio, unidades o promoción. Puedes agregar múltiples artículos sin cerrar la ventana:</p>
              <div className="search-results-list">
                {resultadosBusqueda.map((prod) => (
                  <div key={prod.id} className="search-result-card-edit">
                    <div className="card-top-row">
                      <img src={prod.imagen} alt={prod.nombre} className="result-thumb" />
                      <div className="result-info">
                        <span className="result-title">{prod.nombre}</span>
                        <span className="result-code">Código: {prod.codigo || 'S/N'} | Ubic: {prod.ubicacion}</span>
                      </div>
                      <div className="actions-modal-group">
                        <div className="modal-qty-selector">
                          <label>Cant:</label>
                          <input type="number" min="1" value={prod.cantidadAgregar || 1} onChange={(e) => manejarCambioResultado(prod.id, 'cantidadAgregar', e.target.value)} />
                        </div>
                        <button className="btn-add-item-modal" onClick={() => agregarAlCarrito(prod, true)}>+ Agregar</button>
                      </div>
                    </div>
                    <div className={`card-bottom-row ${prod.esDescuentoManual ? 'has-manual-discount' : ''}`}>
                      <div className="input-group-inline">
                        <label>Precio ($):</label>
                        <input type="number" step="0.5" value={prod.precioUnitario ?? 0} onChange={(e) => manejarCambioResultado(prod.id, 'precioUnitario', e.target.value)} />
                      </div>
                      <div className="input-group-inline">
                        <label>Promoción / Campaña:</label>
                        <select className="select-promo" value={prod.promocionId || 'PROMO_NINGUNA'} onChange={(e) => manejarCambioResultado(prod.id, 'promocionSeleccionada', e.target.value)}>
                          {promocionesActivas.map((promo) => (
                            <option key={promo.id} value={promo.id}>{promo.nombre}</option>
                          ))}
                        </select>
                      </div>
                      {prod.esDescuentoManual && (
                        <div className="input-group-inline">
                          <label>% Desc:</label>
                          <input type="number" min="0" max="100" value={prod.descuento || 0} onChange={(e) => manejarCambioResultado(prod.id, 'descuento', e.target.value)} placeholder="0" />
                        </div>
                      )}
                      <div className="input-group-inline comment-input">
                        <label>Nota / Comentario:</label>
                        <input type="text" value={prod.comentario || ''} onChange={(e) => manejarCambioResultado(prod.id, 'comentario', e.target.value)} placeholder="Ej. Tapa rayada, oferta, etc." />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cerrar" onClick={() => setMostrarModalBusqueda(false)}>Listo / Cerrar Ventana</button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalCobro && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>COBRAR VENTA (F12)</h2>
              <button className="btn-close-modal" onClick={() => setMostrarModalCobro(false)}>✕</button>
            </div>
            <form onSubmit={procesarVenta} className="modal-body">
              <div className="modal-total-box">
                <span>TOTAL A COBRAR</span>
                <h1>${totalPagar.toFixed(2)} MXN</h1>
              </div>
              <div className="payment-fields">
                <div className="field-group">
                  <label>Monto en Efectivo ($):</label>
                  <input type="number" step="0.01" min="0" value={montoEfectivo} onChange={(e) => setMontoEfectivo(e.target.value)} placeholder="0.00" autoFocus />
                </div>
                <div className="field-group">
                  <label>Monto con Tarjeta ($):</label>
                  <input type="number" step="0.01" min="0" value={montoTarjeta} onChange={(e) => setMontoTarjeta(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="payment-summary">
                <div className="summary-row"><span>Total Ingresado:</span><strong>${totalRecibido.toFixed(2)}</strong></div>
                {restante > 0 ? (
                  <div className="summary-row pending-amount"><span>Falta por pagar:</span><strong>${restante.toFixed(2)}</strong></div>
                ) : (
                  <div className="summary-row change-amount"><span>Cambio:</span><strong>${cambio.toFixed(2)}</strong></div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setMostrarModalCobro(false)}>Cancelar (Esc)</button>
                <button type="submit" className="btn-confirm-modal" disabled={totalRecibido < totalPagar}>Confirmar Pago y Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(modalActivo === 'entrada' || modalActivo === 'salida') && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{modalActivo === 'entrada' ? 'ENTRADA DE DINERO A CAJA' : 'SALIDA DE DINERO DE CAJA'}</h2>
              <button className="btn-close-modal" onClick={() => setModalActivo(null)}>✕</button>
            </div>
            <form onSubmit={registrarMovimientoDinero} className="modal-body">
              <div className="field-group"><label>Monto ($):</label><input type="number" step="0.01" required value={movimientoMonto} onChange={(e) => setMovimientoMonto(e.target.value)} placeholder="0.00" autoFocus /></div>
              <div className="field-group"><label>Motivo / Concepto:</label><input type="text" required value={movimientoMotivo} onChange={(e) => setMovimientoMotivo(e.target.value)} placeholder="Ej. Cambio inicial, pago de flete, etc." /></div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setModalActivo(null)}>Cancelar</button>
                <button type="submit" className="btn-confirm-modal">Registrar Movimiento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalActivo === 'checador' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>CHECADOR DE PRECIOS E INVENTARIO</h2>
              <button className="btn-close-modal" onClick={cerrarChecador}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={consultarChecador} className="search-bar-inline">
                <input type="text" value={busquedaChecador} onChange={(e) => setBusquedaChecador(e.target.value)} placeholder="Escanea o escribe el producto..." autoFocus />
                <button type="submit" className="btn-confirm-modal">Consultar</button>
              </form>
              {productoChecador && productoChecador !== 'NO_ENCONTRADO' && (
                <div className="checador-result-box">
                  <h3>{productoChecador.nombre}</h3>
                  <h1 className="checador-price">${productoChecador.precioUnitario.toFixed(2)} MXN</h1>
                  <div className="checador-details-grid">
                    <p>📍 Ubicación: <strong>{productoChecador.ubicacion}</strong></p>
                    <p>🏷️ Código: <strong>{productoChecador.codigo}</strong></p>
                    <p className={`stock-tag ${productoChecador.stock <= 5 ? 'stock-low' : 'stock-ok'}`}>📦 Stock disponible: <strong>{formatoEmpaque(productoChecador.stock, productoChecador.piezasPorCaja)}</strong></p>
                  </div>
                </div>
              )}
              {productoChecador === 'NO_ENCONTRADO' && (<div className="checador-result-box error">❌ Producto no encontrado.</div>)}
            </div>
          </div>
        </div>
      )}

      {modalActivo === 'espera' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>VENTAS EN ESPERA ({ventasEnEspera.length})</h2>
              <button className="btn-close-modal" onClick={() => setModalActivo(null)}>✕</button>
            </div>
            <div className="modal-body">
              {ventasEnEspera.length === 0 ? (<p>No hay ventas guardadas en espera.</p>) : (
                ventasEnEspera.map((v) => (
                  <div key={v.id} className="espera-item-card">
                    <div><strong>Hora: {v.hora}</strong> — {v.items.length} productos<div>Total: <strong>${v.total.toFixed(2)}</strong></div></div>
                    <button className="btn-confirm-modal" onClick={() => recuperarVentaEnEspera(v)}>Recuperar</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {modalActivo === 'ticket' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>VISTA PREVIA DE TICKET</h2>
              <button className="btn-close-modal" onClick={() => setModalActivo(null)}>✕</button>
            </div>
            <div className="modal-body ticket-preview">
              <div className="ticket-box">
                <h3>ASADEL PAPELERÍA</h3>
                <p>Sucursal Principal</p>
                <hr />
                {carrito.map((item) => (
                  <div key={item.id_unico || item.id} className="ticket-line">
                    <span>{item.cantidad}x {item.nombre}</span>
                    <span>${(item.precioUnitario * item.cantidad).toFixed(2)}</span>
                  </div>
                ))}
                <hr />
                <h4>TOTAL: ${totalPagar.toFixed(2)}</h4>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-confirm-modal" onClick={() => { alert('Imprimiendo ticket en la impresora térmica...'); setModalActivo(null); }}>🖨️ Mandar a Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}