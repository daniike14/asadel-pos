import React, { useState, useEffect, useCallback, useRef } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './PuntoDeVenta.css';
import { API_URL } from '../config';

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
  const [ventaFinalizada, setVentaFinalizada] = useState(null);

  // Estados de Cobro (F12)
  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [montoTarjeta, setMontoTarjeta] = useState('');

  // Estados de Fidelización / Clientes
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [sugerenciasClientes, setSugerenciasClientes] = useState([]);
  const [mostrarSugerenciasClientes, setMostrarSugerenciasClientes] = useState(false);
  const [clienteActivo, setClienteActivo] = useState(null);
  const [canjearPuntos, setCanjearPuntos] = useState(false);
  
  // Reglas dinámicas de lealtad
  const [reglasLealtad, setReglasLealtad] = useState({
    valor_punto_pesos: 1.0,
    minimo_puntos_canje: 0,
    porcentaje_max_descuento: 100
  });

  // Alta rápida de cliente
  const [mostrarAltaRapida, setMostrarAltaRapida] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('');
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState('');

  useEffect(() => {
    localStorage.setItem('asadel_carrito_temporal', JSON.stringify(carrito));
  }, [carrito]);

  const cargarDatosBD = async () => {
    try {
      const [resProd, resPromo, resKits, resReglas] = await Promise.all([
        fetch(`${API_URL}/api/productos`),
        fetch(`${API_URL}/api/promociones`),
        fetch(`${API_URL}/api/kits`),
        fetch(`${API_URL}/api/configuracion/lealtad`)
      ]);

      let itemsCombinados = [];

      if (resProd.ok) {
        const dataProd = await resProd.json();
        const normalizados = dataProd.map((p) => ({
          ...p,
          codigo: p.codigoBarras || '',
          precioUnitario: parseFloat(p.precioVenta) || 0,
          ubicacion: p.locacion || 'N/A',
          stock: p.invActual || 0,
          piezasPorCaja: p.piezasPorPaquete || 1,
          imagenLocacion: p.imagenLocacion || '',
          puntosLealtad: parseInt(p.puntosLealtad) || 0,
          esKit: false
        }));
        itemsCombinados = [...normalizados];
      }

      if (resKits.ok) {
        const dataKits = await resKits.json();
        const kitsNormalizados = dataKits.map((k) => ({
          id: `KIT_${k.id}`,
          kit_id: k.id,
          codigo: k.codigo || '',
          nombre: `[PAQUETE] ${k.nombre}`,
          precioUnitario: parseFloat(k.precio) || 0,
          ubicacion: 'Área de Kits',
          stock: 999,
          piezasPorCaja: 1,
          imagenLocacion: '',
          puntosLealtad: 0,
          esKit: true,
          componentes: k.items || []
        }));
        itemsCombinados = [...itemsCombinados, ...kitsNormalizados];
      }

      setCatalogo(itemsCombinados);

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

      if (resReglas.ok) {
        const dataReglas = await resReglas.json();
        setReglasLealtad(dataReglas);
      }
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
    }
  };

  useEffect(() => {
    cargarDatosBD();
  }, []);

  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(-1);
  const contenedorBusquedaRef = useRef(null);

  const [ventasEnEspera, setVentasEnEspera] = useState([]);
  const [mostrarModalBusqueda, setMostrarModalBusqueda] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  const [modalActivo, setModalActivo] = useState(null);
  const [movimientoMonto, setMovimientoMonto] = useState('');
  const [movimientoMotivo, setMovimientoMotivo] = useState('');
  const [busquedaChecador, setBusquedaChecador] = useState('');
  const [productoChecador, setProductoChecador] = useState(null);

  const [cotizacionCliente, setCotizacionCliente] = useState({
    nombre: '',
    telefono: '',
    vigenciaDias: 7,
    folio: ''
  });

  const [datosCorte, setDatosCorte] = useState({
    ventasEfectivo: 0,
    ventasTarjeta: 0,
    totalVentas: 0,
    ticketsTotal: 0,
    totalEntradas: 0,
    totalSalidas: 0,
    saldoEsperado: 0
  });
  const [dineroContado, setDineroContado] = useState('');
  const [observacionesCorte, setObservacionesCorte] = useState('');
  const [corteGuardado, setCorteGuardado] = useState(null);

  const inputBusquedaRef = useRef(null);

  // Búsqueda en vivo de clientes
  useEffect(() => {
    const q = busquedaCliente.trim();
    if (q.length >= 2 && !clienteActivo) {
      fetch(`${API_URL}/api/clientes/buscar?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          setSugerenciasClientes(data);
          setMostrarSugerenciasClientes(true);
        })
        .catch(() => setSugerenciasClientes([]));
    } else {
      setSugerenciasClientes([]);
      setMostrarSugerenciasClientes(false);
    }
  }, [busquedaCliente, clienteActivo]);

  // Filtrado de sugerencias de productos
  useEffect(() => {
    const termino = busqueda.trim().toLowerCase();
    if (termino.length >= 1) {
      const coincidencias = catalogo.filter((p) =>
        p.nombre.toLowerCase().includes(termino) ||
        p.codigo.toLowerCase().includes(termino)
      ).slice(0, 8);

      setSugerencias(coincidencias);
      setMostrarSugerencias(coincidencias.length > 0);
      setIndiceSeleccionado(-1);
    } else {
      setSugerencias([]);
      setMostrarSugerencias(false);
      setIndiceSeleccionado(-1);
    }
  }, [busqueda, catalogo]);

  useEffect(() => {
    const clickAfuera = (e) => {
      if (contenedorBusquedaRef.current && !contenedorBusquedaRef.current.contains(e.target)) {
        setMostrarSugerencias(false);
      }
    };
    document.addEventListener('mousedown', clickAfuera);
    return () => document.removeEventListener('mousedown', clickAfuera);
  }, []);

  // Totales de compra
  const subtotalCarrito = carrito.reduce((acc, item) => {
    const sub = item.precioUnitario * item.cantidad;
    const conDescuento = sub * (1 - (item.descuento || 0) / 100);
    return acc + conDescuento;
  }, 0);

  const puntosGanadosCompra = carrito.reduce((acc, item) => {
    return acc + (item.puntosLealtad || 0) * item.cantidad;
  }, 0);

  // Cálculo dinámico de canje con reglas configuradas
  const valorPunto = reglasLealtad.valor_punto_pesos || 1.0;
  const puntosDisponibles = clienteActivo ? (clienteActivo.puntos_acumulados || 0) : 0;
  const cumpleMinimoCanje = puntosDisponibles >= (reglasLealtad.minimo_puntos_canje || 0);

  const maxDescuentoPermitido = subtotalCarrito * ((reglasLealtad.porcentaje_max_descuento || 100) / 100);
  const maxDineroConPuntos = puntosDisponibles * valorPunto;

  const descuentoPorPuntos = canjearPuntos && cumpleMinimoCanje
    ? Math.min(maxDineroConPuntos, maxDescuentoPermitido)
    : 0;

  const puntosACanjear = descuentoPorPuntos > 0
    ? Math.ceil(descuentoPorPuntos / valorPunto)
    : 0;

  const totalPagar = Math.max(0, subtotalCarrito - descuentoPorPuntos);

  const efectivoNum = parseFloat(montoEfectivo) || 0;
  const tarjetaNum = parseFloat(montoTarjeta) || 0;
  const totalRecibido = efectivoNum + tarjetaNum;
  const cambio = totalRecibido >= totalPagar ? totalRecibido - totalPagar : 0;
  const restante = totalPagar > totalRecibido ? totalPagar - totalRecibido : 0;

  // Manejo de Clientes en Cobro
  const seleccionarClienteCobro = (c) => {
    setClienteActivo(c);
    setBusquedaCliente(`${c.nombre} (${c.telefono})`);
    setMostrarSugerenciasClientes(false);
    setCanjearPuntos(false);
    setMostrarAltaRapida(false);
  };

  const quitarClienteCobro = () => {
    setClienteActivo(null);
    setBusquedaCliente('');
    setCanjearPuntos(false);
    setMostrarAltaRapida(false);
    setMontoEfectivo(subtotalCarrito.toFixed(2));
  };

  const guardarClienteRapido = async (e) => {
    e.preventDefault();
    if (!nuevoClienteNombre.trim() || !nuevoClienteTelefono.trim()) {
      return alert('Ingresa nombre y teléfono del cliente.');
    }

    try {
      const res = await fetch(`${API_URL}/api/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoClienteNombre,
          telefono: nuevoClienteTelefono
        })
      });

      if (res.ok) {
        const nuevo = await res.json();
        alert(`✅ Cliente ${nuevo.nombre} registrado con éxito.`);
        seleccionarClienteCobro(nuevo);
        setNuevoClienteNombre('');
        setNuevoClienteTelefono('');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Error al registrar cliente.');
      }
    } catch {
      alert('Error de conexión al guardar cliente.');
    }
  };

  const cerrarChecador = () => {
    setBusquedaChecador('');
    setProductoChecador(null);
    setModalActivo(null);
  };

  const iniciarCotizacion = () => {
    if (carrito.length === 0) {
      alert('⚠️ Agrega al menos un producto al carrito para generar una cotización.');
      return;
    }
    setCotizacionCliente({
      nombre: '',
      telefono: '',
      vigenciaDias: 7,
      folio: `COT-${Date.now().toString().slice(-6)}`
    });
    setModalActivo('cotizacion');
  };

  const imprimirCotizacion = () => {
    window.print();
  };

  const abrirNotaImpresion = () => {
    if (carrito.length === 0 && !ventaFinalizada) {
      alert('⚠️ No hay productos en la venta activa ni venta reciente para imprimir.');
      return;
    }
    setModalActivo('ticket');
  };

  const abrirCerrarTurno = async () => {
    try {
      const res = await fetch(`${API_URL}/api/corte-caja/balance-actual`);
      if (res.ok) {
        const data = await res.json();
        setDatosCorte(data);
        setDineroContado('');
        setObservacionesCorte('');
        setCorteGuardado(null);
        setModalActivo('corte');
      }
    } catch {
      alert('Error al consultar el balance de caja en el servidor.');
    }
  };

  const guardarCorteTurno = async () => {
    const contadoNum = parseFloat(dineroContado);
    if (isNaN(contadoNum) || contadoNum < 0) {
      alert('⚠️ Ingresa el dinero en efectivo contado en el cajón.');
      return;
    }

    const diferencia = contadoNum - datosCorte.saldoEsperado;

    const payload = {
      cajero: 'Turno 1',
      ventasEfectivo: datosCorte.ventasEfectivo,
      ventasTarjeta: datosCorte.ventasTarjeta,
      totalEntradas: datosCorte.totalEntradas,
      totalSalidas: datosCorte.totalSalidas,
      saldoEsperado: datosCorte.saldoEsperado,
      saldoDeclarado: contadoNum,
      diferencia,
      observaciones: observacionesCorte.trim()
    };

    try {
      const res = await fetch(`${API_URL}/api/corte-caja`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const resJson = await res.json();
        alert(`✅ ¡Corte de turno ${resJson.folio} guardado exitosamente!`);
        setDineroContado('');
        setObservacionesCorte('');
        setCorteGuardado(null);
        setModalActivo(null);
        cargarDatosBD();
      } else {
        alert('Error al guardar el corte de caja.');
      }
    } catch {
      alert('Error de conexión al guardar el corte.');
    }
  };

  const cambiarCantidadTabla = (idUnico, nuevaCantidad) => {
    const cantNum = parseInt(nuevaCantidad, 10);
    if (isNaN(cantNum) || cantNum <= 0) return;

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
          puntosLealtad: producto.puntosLealtad || 0,
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
      setMostrarSugerencias(false);
      setSugerencias([]);
      setTimeout(() => inputBusquedaRef.current?.focus(), 100);
    }
  };

  const seleccionarSugerencia = (producto) => {
    agregarAlCarrito({
      ...producto,
      promocionId: 'PROMO_NINGUNA',
      promocionNombre: '',
      esDescuentoManual: false,
      descuento: 0,
      comentario: '',
      cantidadAgregar: 1,
      imagenLocacion: producto.imagenLocacion
    });
  };

  const manejarKeyDownBusqueda = (e) => {
    if (!mostrarSugerencias || sugerencias.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceSeleccionado((prev) => (prev < sugerencias.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceSeleccionado((prev) => (prev > 0 ? prev - 1 : sugerencias.length - 1));
    } else if (e.key === 'Enter') {
      if (indiceSeleccionado >= 0 && sugerencias[indiceSeleccionado]) {
        e.preventDefault();
        seleccionarSugerencia(sugerencias[indiceSeleccionado]);
      }
    } else if (e.key === 'Escape') {
      setMostrarSugerencias(false);
    }
  };

  const ejecutarBusqueda = (e) => {
    if (e) e.preventDefault();
    setMostrarSugerencias(false);
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
      alert(`No se encontraron productos ni kits para "${busqueda}".`);
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

  const registrarMovimientoDinero = async (e) => {
    e.preventDefault();
    const tipo = modalActivo === 'entrada' ? 'entrada' : 'salida';
    const montoVal = parseFloat(movimientoMonto);

    if (isNaN(montoVal) || montoVal <= 0) {
      alert('⚠️ Ingresa un monto válido mayor a 0.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/movimientos-caja`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          monto: montoVal,
          motivo: movimientoMotivo.trim(),
          cajero: 'Turno 1'
        })
      });

      if (res.ok) {
        alert(`✅ ${tipo === 'entrada' ? 'Entrada' : 'Salida'} de dinero ($${montoVal.toFixed(2)}) registrada en el sistema.`);
        setMovimientoMonto('');
        setMovimientoMotivo('');
        setModalActivo(null);
      } else {
        const errorData = await res.json();
        alert(`Error al registrar el movimiento: ${errorData.error || 'Problema en el servidor'}`);
      }
    } catch {
      alert('Error de conexión al guardar el movimiento de caja.');
    }
  };

  const procesarVenta = async (e) => {
    e.preventDefault();
    if (totalRecibido < totalPagar) {
      alert("El monto recibido no cubre el total a pagar.");
      return;
    }

    const folioGenerado = `VTA-${Date.now().toString().slice(-6)}`;
    const fechaHoraVenta = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const payloadVenta = {
      folio: folioGenerado,
      total: totalPagar,
      metodo_pago: montoEfectivo && montoTarjeta ? 'mixto' : montoEfectivo ? 'efectivo' : 'tarjeta',
      monto_efectivo: efectivoNum,
      monto_tarjeta: tarjetaNum,
      cajero: 'Turno 1',
      items: carrito,
      cliente_id: clienteActivo ? clienteActivo.id : null,
      puntos_ganados: puntosGanadosCompra,
      puntos_canjeados: puntosACanjear
    };

    try {
      const res = await fetch(`${API_URL}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadVenta)
      });

      if (res.ok) {
        setVentaFinalizada({
          folio: folioGenerado,
          fechaHora: fechaHoraVenta,
          cajero: 'Turno 1',
          items: [...carrito],
          total: totalPagar,
          efectivo: efectivoNum,
          tarjeta: tarjetaNum,
          cambio: cambio,
          cliente: clienteActivo ? clienteActivo.nombre : null,
          puntosGanados: puntosGanadosCompra,
          puntosCanjeados: puntosACanjear,
          descuentoPuntosPesos: descuentoPorPuntos
        });

        setCarrito([]);
        localStorage.removeItem('asadel_carrito_temporal');
        setProductoSeleccionado(null);
        setMontoEfectivo('');
        setMontoTarjeta('');
        setClienteActivo(null);
        setBusquedaCliente('');
        setCanjearPuntos(false);
        setMostrarModalCobro(false);
        cargarDatosBD();

        setModalActivo('ticket');
      } else {
        alert('Error al registrar la venta en el servidor.');
      }
    } catch {
      alert('Error al guardar la venta en la base de datos.');
    }
  };

  const abrirModalEditarItem = (item) => {
    setProductoSeleccionado(item);
    setItemEditando({ 
      ...item, 
      promocionId: item.promocionId || 'PROMO_NINGUNA',
      esDescuentoManual: item.esDescuentoManual || false
    });
    setMostrarModalEditarItem(true);
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

  const itemsNotaImpresion = ventaFinalizada ? ventaFinalizada.items : carrito;
  const folioNotaImpresion = ventaFinalizada ? ventaFinalizada.folio : `VTA-${Date.now().toString().slice(-6)}`;
  const fechaNotaImpresion = ventaFinalizada ? ventaFinalizada.fechaHora : `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const totalNotaImpresion = ventaFinalizada ? ventaFinalizada.total : totalPagar;

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
        <div className="pos-search-wrapper" ref={contenedorBusquedaRef}>
          <input
            ref={inputBusquedaRef}
            id="search-input"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={manejarKeyDownBusqueda}
            onFocus={() => {
              if (sugerencias.length > 0) setMostrarSugerencias(true);
            }}
            placeholder="Escribe 'cuaderno', código o 'paquete'..."
            autoComplete="off"
            autoFocus
          />

          {mostrarSugerencias && sugerencias.length > 0 && (
            <ul className="pos-autocomplete-list">
              {sugerencias.map((item, idx) => (
                <li
                  key={item.id}
                  className={`pos-autocomplete-item ${idx === indiceSeleccionado ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    seleccionarSugerencia(item);
                  }}
                >
                  <div className="pos-autocomplete-info">
                    <span className="pos-autocomplete-name">
                      {item.esKit && <span style={{ color: '#2563eb', marginRight: '4px' }}>📦</span>}
                      {item.nombre}
                    </span>
                    <span className="pos-autocomplete-sub">
                      Cód: {item.codigo || 'S/N'} | Loc: {item.ubicacion}
                    </span>
                  </div>
                  <div className="pos-autocomplete-price-stock">
                    <span className="pos-autocomplete-price">${item.precioUnitario.toFixed(2)}</span>
                    <span className="pos-autocomplete-stock">
                      {item.esKit ? 'Kit' : `Stock: ${item.stock}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="btn-search">🔍</button>
      </form>

      <div className="pos-body">
        <div className="pos-left-panel">
          <div className="pos-table-wrapper">
            <table className="pos-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>CANT</th>
                  <th>PRODUCTO / PAQUETE</th>
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
                    >
                      {/* Celda aislada: los clics o dobles clics no disparan el modal */}
                      <td onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <div className="qty-controls-table" onDoubleClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button" 
                            className="btn-qty-mini" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              cambiarCantidadTabla(keyItem, item.cantidad - 1); 
                            }}
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            className="input-qty-table" 
                            value={item.cantidad} 
                            onClick={(e) => e.stopPropagation()} 
                            onDoubleClick={(e) => e.stopPropagation()}
                            onChange={(e) => cambiarCantidadTabla(keyItem, e.target.value)} 
                            min="1" 
                          />
                          <button 
                            type="button" 
                            className="btn-qty-mini" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              cambiarCantidadTabla(keyItem, item.cantidad + 1); 
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Las demás celdas conservan la función de doble clic para editar */}
                      <td onDoubleClick={() => abrirModalEditarItem(item)} title="Doble clic para editar precio, promoción o notas">
                        <div className="product-table-name">
                          {item.esKit && <strong style={{ color: '#2563eb' }}>[PAQUETE] </strong>}
                          {item.nombre}
                        </div>
                        {item.promocionNombre && <span className="product-table-promo">🏷️ {item.promocionNombre}</span>}
                        {item.comentario && <span className="product-table-comment">📝 {item.comentario}</span>}
                      </td>
                      <td onDoubleClick={() => abrirModalEditarItem(item)} title="Doble clic para editar">${item.precioUnitario.toFixed(2)}</td>
                      <td onDoubleClick={() => abrirModalEditarItem(item)} title="Doble clic para editar">{item.descuento ? `${item.descuento}%` : '-'}</td>
                      <td onDoubleClick={() => abrirModalEditarItem(item)} title="Doble clic para editar">${totalFila.toFixed(2)}</td>
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
            <button className="btn-secondary" onClick={() => setModalActivo('entrada')}>Entrada Dinero</button>
            <button className="btn-secondary" onClick={() => setModalActivo('salida')}>Salida Dinero</button>
            <button className="btn-secondary" onClick={() => { setBusquedaChecador(''); setProductoChecador(null); setModalActivo('checador'); }}>Checador Precios</button>
            <button className="btn-secondary" onClick={iniciarCotizacion}>Cotización</button>
            <button className="btn-secondary" onClick={() => setModalActivo('espera')}>Venta en Espera {ventasEnEspera.length > 0 && `(${ventasEnEspera.length})`}</button>
            <button className="btn-secondary" onClick={abrirCerrarTurno}>Cerrar Turno</button>
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
            <button 
              className="btn-main btn-pay" 
              onClick={() => { 
                setMontoEfectivo(totalPagar.toString()); 
                setMostrarModalCobro(true); 
              }} 
              disabled={carrito.length === 0}
            > 
              COBRAR (F12) 
            </button>
            <button className="btn-main btn-hold" onClick={guardarVentaEnEspera} disabled={carrito.length === 0}> TICKET PEND. </button>
            <button className="btn-main btn-print" onClick={abrirNotaImpresion} disabled={carrito.length === 0 && !ventaFinalizada}> IMPRIMIR </button>
          </div>
        </div>
      </div>

      {/* MODAL DE COBRO (F12) CON CANJE DINÁMICO */}
      {mostrarModalCobro && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h2>COBRAR VENTA (F12)</h2>
              <button className="btn-close-modal" onClick={() => setMostrarModalCobro(false)}>✕</button>
            </div>
            <form onSubmit={procesarVenta} className="modal-body">
              <div className="modal-total-box">
                <span>TOTAL A COBRAR</span>
                <h1>${totalPagar.toFixed(2)} MXN</h1>
                {descuentoPorPuntos > 0 && (
                  <small style={{ color: '#86efac' }}>
                    (-${descuentoPorPuntos.toFixed(2)} por {puntosACanjear} puntos)
                  </small>
                )}
              </div>

              {/* SECCIÓN CLIENTE / MONEDERO DE PUNTOS */}
              <div className="customer-loyalty-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                    👤 CLIENTE / PROGRAMA DE LEALTAD:
                  </label>
                  {!clienteActivo && !mostrarAltaRapida && (
                    <button 
                      type="button" 
                      onClick={() => setMostrarAltaRapida(true)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      + Registrar Rápido
                    </button>
                  )}
                </div>

                {!clienteActivo ? (
                  !mostrarAltaRapida ? (
                    <div className="customer-search-group">
                      <input
                        type="text"
                        placeholder="Buscar por teléfono o nombre..."
                        value={busquedaCliente}
                        onChange={(e) => setBusquedaCliente(e.target.value)}
                      />
                      {mostrarSugerenciasClientes && sugerenciasClientes.length > 0 && (
                        <ul className="customer-dropdown">
                          {sugerenciasClientes.map((c) => (
                            <li 
                              key={c.id} 
                              className="customer-dropdown-item"
                              onClick={() => seleccionarClienteCobro(c)}
                            >
                              <div>
                                <strong>{c.nombre}</strong> ({c.telefono})
                              </div>
                              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>
                                {c.puntos_acumulados} pts (${((c.puntos_acumulados || 0) * valorPunto).toFixed(2)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    /* FORMULARIO DE ALTA RÁPIDA DE CLIENTE */
                    <div className="fast-register-box">
                      <div className="fast-register-row">
                        <input 
                          type="text" 
                          placeholder="Nombre del cliente..." 
                          value={nuevoClienteNombre} 
                          onChange={(e) => setNuevoClienteNombre(e.target.value)} 
                          autoFocus
                        />
                        <input 
                          type="text" 
                          placeholder="Teléfono..." 
                          value={nuevoClienteTelefono} 
                          onChange={(e) => setNuevoClienteTelefono(e.target.value)} 
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn-cancel-modal" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setMostrarAltaRapida(false)}>Cancelar</button>
                        <button type="button" className="btn-confirm-modal" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={guardarClienteRapido}>Guardar y Asignar</button>
                      </div>
                    </div>
                  )
                ) : (
                  /* CLIENTE ASIGNADO */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="customer-active-badge">
                      <div>
                        <strong>{clienteActivo.nombre}</strong> ({clienteActivo.telefono})
                        <button type="button" className="btn-remove-client" onClick={quitarClienteCobro} title="Quitar cliente">✕</button>
                      </div>
                      <span className="loyalty-points-tag">
                        {clienteActivo.puntos_acumulados} pts (${((clienteActivo.puntos_acumulados || 0) * valorPunto).toFixed(2)})
                      </span>
                    </div>

                    {/* OPCIÓN DE CANJE DE PUNTOS DINÁMICA */}
                    {puntosDisponibles > 0 && (
                      cumpleMinimoCanje ? (
                        <div className="redemption-box">
                          <input 
                            type="checkbox" 
                            id="check-canjear" 
                            checked={canjearPuntos} 
                            onChange={(e) => {
                              setCanjearPuntos(e.target.checked);
                              const desc = e.target.checked ? Math.min(maxDineroConPuntos, maxDescuentoPermitido) : 0;
                              setMontoEfectivo(Math.max(0, subtotalCarrito - desc).toFixed(2));
                            }}
                          />
                          <label htmlFor="check-canjear" style={{ cursor: 'pointer', flex: 1 }}>
                            Canjear <strong>{Math.ceil(Math.min(maxDineroConPuntos, maxDescuentoPermitido) / valorPunto)} pts</strong> como descuento (-${Math.min(maxDineroConPuntos, maxDescuentoPermitido).toFixed(2)} MXN)
                          </label>
                        </div>
                      ) : (
                        <small style={{ color: '#d97706', fontStyle: 'italic' }}>
                          ℹ️ Requiere acumular al menos {reglasLealtad.minimo_puntos_canje} puntos para comenzar a canjear (tiene {puntosDisponibles}).
                        </small>
                      )
                    )}
                  </div>
                )}

                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  ⭐ Esta compra acumulará: <strong>+{puntosGanadosCompra} puntos</strong>
                </div>
              </div>

              {/* CAMPOS DE FORMA DE PAGO */}
              <div className="payment-fields">
                <div className="field-group">
                  <label>Monto en Efectivo ($):</label>
                  <input type="number" step="0.01" min="0" value={montoEfectivo} onChange={(e) => setMontoEfectivo(e.target.value)} placeholder="0.00" />
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

      {/* MODAL DE NOTA DE VENTA TAMAÑO CARTA */}
      {modalActivo === 'ticket' && (
        <div className="modal-overlay">
          <div className="modal-content modal-cotizacion-content">
            <div className="modal-header">
              <h2>NOTA DE VENTA / REMISIÓN</h2>
              <button className="btn-close-modal" onClick={() => { setModalActivo(null); setVentaFinalizada(null); }}>✕</button>
            </div>
            
            <div className="modal-body ticket-preview">
              <div className="nota-carta-container">
                <div className="nota-carta-header">
                  <div className="nota-carta-empresa">
                    <h2>PAPELERÍA ASADEL</h2>
                    <p>Artículos de Papelería, Oficina, Copias e Impresiones</p>
                    <p>Atención y servicio de calidad</p>
                  </div>
                  <div className="nota-carta-datos-folio">
                    <strong>NOTA DE VENTA</strong><br />
                    <span><strong>Folio:</strong> {folioNotaImpresion}</span><br />
                    <span><strong>Fecha:</strong> {fechaNotaImpresion}</span><br />
                    <span><strong>Atendido por:</strong> Turno 1</span>
                    {ventaFinalizada?.cliente && (
                      <><br /><span><strong>Cliente:</strong> {ventaFinalizada.cliente}</span></>
                    )}
                  </div>
                </div>

                <table className="nota-carta-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '45px' }}>Cant</th>
                      <th>Descripción del Producto</th>
                      <th style={{ textAlign: 'right', width: '90px' }}>P. Unit</th>
                      <th style={{ textAlign: 'right', width: '65px' }}>Desc.</th>
                      <th style={{ textAlign: 'right', width: '95px' }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsNotaImpresion.map((item) => {
                      const key = item.id_unico || item.id;
                      const sub = (item.precioUnitario * item.cantidad) * (1 - (item.descuento || 0) / 100);
                      return (
                        <tr key={key}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.cantidad}</td>
                          <td>
                            <strong>{item.nombre}</strong>
                            {item.comentario && (
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                                Nota: {item.comentario}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>${item.precioUnitario.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{item.descuento ? `${item.descuento}%` : '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${sub.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="nota-carta-totales">
                  <table className="nota-carta-totales-tabla">
                    <tbody>
                      <tr>
                        <td>Total Artículos:</td>
                        <td>{itemsNotaImpresion.reduce((acc, it) => acc + (it.cantidad || 0), 0)} pzs</td>
                      </tr>
                      {ventaFinalizada && ventaFinalizada.descuentoPuntosPesos > 0 && (
                        <tr>
                          <td>Descuento Puntos ({ventaFinalizada.puntosCanjeados} pts):</td>
                          <td style={{ color: '#16a34a' }}>-${ventaFinalizada.descuentoPuntosPesos.toFixed(2)}</td>
                        </tr>
                      )}
                      {ventaFinalizada && ventaFinalizada.efectivo > 0 && (
                        <tr>
                          <td>Efectivo Recibido:</td>
                          <td>${ventaFinalizada.efectivo.toFixed(2)}</td>
                        </tr>
                      )}
                      {ventaFinalizada && ventaFinalizada.tarjeta > 0 && (
                        <tr>
                          <td>Pago con Tarjeta:</td>
                          <td>${ventaFinalizada.tarjeta.toFixed(2)}</td>
                        </tr>
                      )}
                      {ventaFinalizada && ventaFinalizada.cambio > 0 && (
                        <tr>
                          <td>Cambio entregado:</td>
                          <td>${ventaFinalizada.cambio.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="nota-carta-total-destacado">
                        <td>TOTAL PAGADO:</td>
                        <td>${totalNotaImpresion.toFixed(2)} MXN</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {ventaFinalizada?.puntosGanados > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12px', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
                    ¡Ganaste +{ventaFinalizada.puntosGanados} puntos de lealtad en esta compra!
                  </div>
                )}

                <div className="nota-carta-footer">
                  <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>¡Gracias por su compra y preferencia!</p>
                  <p style={{ margin: 0 }}>Cualquier aclaración favor de presentar esta nota de remisión.</p>
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn-cancel-modal" onClick={() => { setModalActivo(null); setVentaFinalizada(null); }}>Cerrar</button>
              <button type="button" className="btn-confirm-modal" onClick={() => window.print()}>🖨️ Mandar a Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CORTE DE CAJA */}
      {modalActivo === 'corte' && (
        <div className="modal-overlay">
          <div className="modal-content modal-corte-content">
            <div className="modal-header">
              <h2>CORTE DE CAJA / ARQUEO DE TURNO</h2>
              <button className="btn-close-modal" onClick={() => setModalActivo(null)}>✕</button>
            </div>

            <div className="modal-body corte-print-container">
              <div className="nota-carta-header">
                <div className="nota-carta-empresa">
                  <h2>PAPELERÍA ASADEL</h2>
                  <p>Reporte de Arqueo y Cierre de Turno</p>
                </div>
                <div className="nota-carta-datos-folio">
                  <strong>{corteGuardado ? corteGuardado.folio : 'PRE-CORTE'}</strong><br />
                  <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><br />
                  <span>Cajero: Turno 1</span>
                </div>
              </div>

              <div className="corte-resumen-grid">
                <div className="corte-stat">
                  <span>Ventas en Efectivo:</span>
                  <strong>${datosCorte.ventasEfectivo.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Ventas con Tarjeta:</span>
                  <strong>${datosCorte.ventasTarjeta.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Total Ventas ({datosCorte.ticketsTotal} tckts):</span>
                  <strong style={{ color: '#16a34a' }}>${datosCorte.totalVentas.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Entradas / Fondo:</span>
                  <strong style={{ color: '#0284c7' }}>+${datosCorte.totalEntradas.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Salidas / Gastos:</span>
                  <strong style={{ color: '#dc2626' }}>-${datosCorte.totalSalidas.toFixed(2)}</strong>
                </div>
                <div className="corte-stat">
                  <span>Efectivo Esperado en Caja:</span>
                  <strong style={{ color: '#0f172a', fontSize: '18px' }}>${datosCorte.saldoEsperado.toFixed(2)}</strong>
                </div>
              </div>

              <div className="corte-arqueo-box no-print">
                <div className="input-group-inline">
                  <label>Efectivo Físico en Cajón ($):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Ingresa el monto contado..."
                    value={dineroContado}
                    onChange={(e) => setDineroContado(e.target.value)}
                    autoFocus
                  />
                </div>

                {dineroContado !== '' && (
                  <div className={`corte-diff-banner ${
                    (parseFloat(dineroContado) - datosCorte.saldoEsperado) === 0
                      ? 'cuadrado'
                      : (parseFloat(dineroContado) - datosCorte.saldoEsperado) > 0
                      ? 'sobrante'
                      : 'faltante'
                  }`}>
                    <span>
                      {(parseFloat(dineroContado) - datosCorte.saldoEsperado) === 0
                        ? '✅ La caja está cuadrada'
                        : (parseFloat(dineroContado) - datosCorte.saldoEsperado) > 0
                        ? '🔼 Sobrante en caja:'
                        : '⚠️ Faltante en caja:'}
                    </span>
                    <strong>${Math.abs(parseFloat(dineroContado) - datosCorte.saldoEsperado).toFixed(2)} MXN</strong>
                  </div>
                )}

                <div className="input-group-inline">
                  <label>Notas u Observaciones del Cierre:</label>
                  <input
                    type="text"
                    placeholder="Ej. Se dejaron $200 de cambio, caja entregada sin novedad..."
                    value={observacionesCorte}
                    onChange={(e) => setObservacionesCorte(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn-cancel-modal" onClick={() => setModalActivo(null)}>Cerrar</button>
              <button type="button" className="btn-secondary" onClick={() => window.print()}>🖨️ Imprimir Reporte</button>
              <button type="button" className="btn-confirm-modal" onClick={guardarCorteTurno} disabled={!dineroContado}>
                💾 Guardar Cierre de Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COTIZACIÓN */}
      {modalActivo === 'cotizacion' && (
        <div className="modal-overlay">
          <div className="modal-content modal-cotizacion-content">
            <div className="modal-header">
              <h2>COTIZACIÓN ({cotizacionCliente.folio})</h2>
              <button className="btn-close-modal" onClick={() => setModalActivo(null)}>✕</button>
            </div>
            
            <div className="modal-body cotizacion-body">
              <div className="cotizacion-form-grid no-print">
                <div className="input-group-inline">
                  <label>Nombre del Cliente:</label>
                  <input
                    type="text"
                    value={cotizacionCliente.nombre}
                    onChange={(e) => setCotizacionCliente({ ...cotizacionCliente, nombre: e.target.value })}
                    placeholder="Ej. Juan Pérez / Escuela..."
                    autoFocus
                  />
                </div>
                <div className="input-group-inline">
                  <label>Teléfono (Opcional):</label>
                  <input
                    type="text"
                    value={cotizacionCliente.telefono}
                    onChange={(e) => setCotizacionCliente({ ...cotizacionCliente, telefono: e.target.value })}
                    placeholder="Ej. 55 1234 5678"
                  />
                </div>
                <div className="input-group-inline">
                  <label>Vigencia (Días):</label>
                  <input
                    type="number"
                    min="1"
                    value={cotizacionCliente.vigenciaDias}
                    onChange={(e) => setCotizacionCliente({ ...cotizacionCliente, vigenciaDias: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
              </div>

              <div className="cotizacion-print-area">
                <div className="cotizacion-print-header">
                  <div>
                    <h3 style={{ margin: 0 }}>PAPELERÍA ASADEL</h3>
                    <p style={{ margin: '2px 0', fontSize: '12px', color: '#64748b' }}>Cotización de Artículos y Material Escolar</p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12px' }}>
                    <strong>Folio:</strong> {cotizacionCliente.folio}<br />
                    <strong>Fecha:</strong> {new Date().toLocaleDateString()}<br />
                    <strong>Válido por:</strong> {cotizacionCliente.vigenciaDias} días
                  </div>
                </div>

                {cotizacionCliente.nombre && (
                  <div style={{ fontSize: '13px', margin: '8px 0', padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                    <strong>Cliente:</strong> {cotizacionCliente.nombre} {cotizacionCliente.telefono && `| Tel: ${cotizacionCliente.telefono}`}
                  </div>
                )}

                <table className="cotizacion-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '40px' }}>Cant</th>
                      <th>Descripción</th>
                      <th style={{ textAlign: 'right', width: '85px' }}>P. Unit</th>
                      <th style={{ textAlign: 'right', width: '60px' }}>Desc.</th>
                      <th style={{ textAlign: 'right', width: '90px' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.map((item) => {
                      const key = item.id_unico || item.id;
                      const sub = (item.precioUnitario * item.cantidad) * (1 - (item.descuento || 0) / 100);
                      return (
                        <tr key={key}>
                          <td style={{ textAlign: 'center' }}>{item.cantidad}</td>
                          <td>
                            <strong>{item.nombre}</strong>
                            {item.comentario && <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{item.comentario}</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>${item.precioUnitario.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{item.descuento ? `${item.descuento}%` : '-'}</td>
                          <td style={{ textAlign: 'right' }}>${sub.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: '10px' }}>TOTAL ESTIMADO:</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px', color: '#16a34a', paddingTop: '10px' }}>
                        ${totalPagar.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn-cancel-modal" onClick={() => setModalActivo(null)}>Cerrar</button>
              <button type="button" className="btn-confirm-modal" onClick={imprimirCotizacion}>🖨️ Imprimir / Guardar PDF</button>
            </div>
          </div>
        </div>
      )}

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

      {/* ENTRADA / SALIDA DE DINERO */}
      {(modalActivo === 'entrada' || modalActivo === 'salida') && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{modalActivo === 'entrada' ? 'ENTRADA DE DINERO A CAJA' : 'SALIDA DE DINERO DE CAJA'}</h2>
              <button className="btn-close-modal" onClick={() => setModalActivo(null)}>✕</button>
            </div>
            <form onSubmit={registrarMovimientoDinero} className="modal-body">
              <div className="field-group">
                <label>Monto ($):</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  value={movimientoMonto} 
                  onChange={(e) => setMovimientoMonto(e.target.value)} 
                  placeholder="0.00" 
                  autoFocus 
                />
              </div>
              <div className="field-group">
                <label>Motivo / Concepto:</label>
                <input 
                  type="text" 
                  required 
                  value={movimientoMotivo} 
                  onChange={(e) => setMovimientoMotivo(e.target.value)} 
                  placeholder={modalActivo === 'entrada' ? "Ej. Fondo inicial, cambio recibido..." : "Ej. Pago a repartidor, retiro de efectivo..."} 
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setModalActivo(null)}>Cancelar</button>
                <button type="submit" className="btn-confirm-modal">Registrar Movimiento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECADOR DE PRECIOS */}
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

      {/* VENTAS EN ESPERA */}
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
    </div>
  );
}