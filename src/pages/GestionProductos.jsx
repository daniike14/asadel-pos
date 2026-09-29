import React, { useState, useEffect, useRef } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './GestionProductos.css';
import { API_URL } from '../config';

const fechaHoyLocal = () => new Date().toISOString().split('T')[0];
const generarCodigoKitAutomatico = () => `KIT-${Date.now().toString().slice(-5)}`;

const estadoInicialForm = {
    id: null,
    codigoBarras: '',
    nombre: '',
    locacion: '',
    claveUnidad: 'PZA',
    atributoColor: '',
    departamento: '',
    categoria: '',
    proveedor: '',
    imagen: '',
    imagenLocacion: '',
    costoPaquete: '',
    piezasPorPaquete: '1',
    precioVentaPaquete: '',
    notaPaquete: '',
    costo: '',
    precioVenta: '',
    ganancia: '',
    invMinimo: '',
    invActual: '',
    puntosLealtad: '',
    fechaCompra: fechaHoyLocal()
};

const estadoInicialOpciones = {
    esServicio: false,
    aGranel: false
};

export default function GestionProductos() {
    const busquedaInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const kitBuscadorRef = useRef(null);

    const [vista, setVista] = useState('catalogo'); // 'catalogo' | 'formulario' | 'promociones' | 'kits' | 'gestion_catalogos'
    const [pestanaActiva, setPestanaActiva] = useState('generales');

    const [departamentos, setDepartamentos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [promociones, setPromociones] = useState([]);
    const [kits, setKits] = useState([]);

    // Subpestañas para Gestión de Catálogos (Deptos, Cats, Provs)
    const [subvistaCatalogo, setSubvistaCatalogo] = useState('departamentos');
    const [modalEditCatalog, setModalEditCatalog] = useState(null); // { tipo: 'departamento'|'categoria'|'proveedor', item: obj }
    const [editNombre, setEditNombre] = useState('');
    const [editTelefono, setEditTelefono] = useState('');
    const [editContacto, setEditContacto] = useState('');

    // Formulario de Promociones
    const [nuevaPromoNombre, setNuevaPromoNombre] = useState('');
    const [nuevaPromoTipo, setNuevaPromoTipo] = useState('porcentaje');
    const [nuevaPromoValor, setNuevaPromoValor] = useState('');

    // Formulario de Kits
    const [nuevoKitCodigo, setNuevoKitCodigo] = useState(generarCodigoKitAutomatico());
    const [nuevoKitNombre, setNuevoKitNombre] = useState('');
    const [nuevoKitPrecio, setNuevoKitPrecio] = useState('');
    const [kitComponentes, setKitComponentes] = useState([]);

    // Buscador predictivo para componentes de Kits
    const [busquedaProductoKit, setBusquedaProductoKit] = useState('');
    const [sugerenciasKit, setSugerenciasKit] = useState([]);
    const [mostrarSugerenciasKit, setMostrarSugerenciasKit] = useState(false);
    const [productoSeleccionadoKit, setProductoSeleccionadoKit] = useState(null);
    const [cantidadSeleccionadaKit, setCantidadSeleccionadaKit] = useState('1');

    const [busqueda, setBusqueda] = useState('');
    const [filtroDepto, setFiltroDepto] = useState('');
    const [cargando, setCargando] = useState(false);

    const [imagenAmpliada, setImagenAmpliada] = useState(null);
    const [mostrarMenuColumnas, setMostrarMenuColumnas] = useState(false);
    const [columnasVisibles, setColumnasVisibles] = useState({
        img: true,
        codigo: true,
        nombre: true,
        departamento: true,
        categoria: true,
        proveedor: true,
        costo: true,
        precio: true,
        stock: true,
        estado: true,
        acciones: true
    });

    const [ordenColumna, setOrdenColumna] = useState('nombre'); 
    const [ordenDireccion, setOrdenDireccion] = useState('asc'); 
    const [paginaActual, setPaginaActual] = useState(1);
    const [itemsPorPagina, setItemsPorPagina] = useState(10);

    const [opciones, setOpciones] = useState(estadoInicialOpciones);
    const [datosForm, setDatosForm] = useState(estadoInicialForm);

    const [modalTipo, setModalTipo] = useState(null);
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevoTelefono, setNuevoTelefono] = useState('');
    const [nuevoContacto, setNuevoContacto] = useState('');

    const [productoHistorial, setProductoHistorial] = useState(null);
    const [listaHistorialCostos, setListaHistorialCostos] = useState([]);
    const [datosNuevaCompra, setDatosNuevaCompra] = useState({
        proveedor: '',
        costoPaquete: '',
        piezasPorPaquete: '1',
        costoUnitario: '',
        cantidadComprada: '',
        nota: '',
        fechaCompra: fechaHoyLocal(),
        actualizarPrecioVenta: false,
        nuevoPrecioVenta: ''
    });

    useEffect(() => {
        if (vista === 'catalogo' && busquedaInputRef.current) {
            setTimeout(() => busquedaInputRef.current?.focus(), 50);
        }
    }, [vista]);

    // Filtrado de sugerencias de componentes de kit
    useEffect(() => {
        const termino = busquedaProductoKit.trim().toLowerCase();
        if (termino.length >= 1) {
            const listaOpciones = [];
            productos.filter(p => !p.esServicio && !p.esKit).forEach(p => {
                const coincide = p.nombre.toLowerCase().includes(termino) || (p.codigoBarras && p.codigoBarras.toLowerCase().includes(termino));
                if (coincide) {
                    const pzsPaq = parseInt(p.piezasPorPaquete, 10) || 1;
                    const precioPza = parseFloat(p.precioVenta) || 0;
                    const precioPaq = parseFloat(p.precioVentaPaquete) > 0 ? parseFloat(p.precioVentaPaquete) : +(precioPza * pzsPaq).toFixed(2);

                    listaOpciones.push({
                        ...p,
                        id_kit_item: `${p.id}_pza`,
                        nombre_mostrar: p.nombre,
                        precio_aplicar: precioPza,
                        multiplicador: 1
                    });

                    if (pzsPaq > 1) {
                        listaOpciones.push({
                            ...p,
                            id_kit_item: `${p.id}_pkg`,
                            nombre_mostrar: `📦 [PAQ. ${pzsPaq} pzs] ${p.nombre}`,
                            precio_aplicar: precioPaq,
                            multiplicador: pzsPaq
                        });
                    }
                }
            });

            setSugerenciasKit(listaOpciones.slice(0, 8));
            setMostrarSugerenciasKit(listaOpciones.length > 0);
        } else {
            setSugerenciasKit([]);
            setMostrarSugerenciasKit(false);
        }
    }, [busquedaProductoKit, productos]);

    useEffect(() => {
        const handleClickAfuera = (e) => {
            if (kitBuscadorRef.current && !kitBuscadorRef.current.contains(e.target)) {
                setMostrarSugerenciasKit(false);
            }
        };
        document.addEventListener('mousedown', handleClickAfuera);
        return () => document.removeEventListener('mousedown', handleClickAfuera);
    }, []);

    const cargarCatalogos = async () => {
        try {
            const [resDeptos, resCats, resProvs, resPromos, resKits] = await Promise.all([
                fetch(`${API_URL}/api/departamentos`),
                fetch(`${API_URL}/api/categorias`),
                fetch(`${API_URL}/api/proveedores`),
                fetch(`${API_URL}/api/promociones`),
                fetch(`${API_URL}/api/kits`)
            ]);

            if (resDeptos.ok) setDepartamentos(await resDeptos.json());
            if (resCats.ok) setCategorias(await resCats.json());
            if (resProvs.ok) setProveedores(await resProvs.json());
            if (resPromos.ok) setPromociones(await resPromos.json());
            if (resKits.ok) setKits(await resKits.json());
        } catch (err) {
            console.error('Error al cargar catálogos:', err);
        }
    };

    const cargarProductos = async () => {
        setCargando(true);
        try {
            const res = await fetch(`${API_URL}/api/productos`);
            if (res.ok) {
                const data = await res.json();
                setProductos(data);
            }
        } catch (err) {
            console.error('Error al cargar productos:', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarCatalogos();
        cargarProductos();
    }, []);

    const handleOpcionChange = (key) => {
        setOpciones((prev) => {
            const estabaActiva = prev[key];
            const nuevoEstado = {
                esServicio: false,
                aGranel: false,
                [key]: !estabaActiva
            };

            if (nuevoEstado.esServicio) {
                setDatosForm((f) => ({ ...f, invActual: '0', invMinimo: '0', claveUnidad: 'E48', locacion: '', imagenLocacion: '' }));
            } else if (estabaActiva && key === 'esServicio') {
                setDatosForm((f) => ({ ...f, claveUnidad: 'PZA' }));
            }

            if (nuevoEstado.aGranel && (datosForm.claveUnidad === 'PZA' || !datosForm.claveUnidad)) {
                setDatosForm((f) => ({ ...f, claveUnidad: 'MTR' }));
            }

            return nuevoEstado;
        });
    };

    // Funciones del Kit
    const seleccionarProductoKit = (itemOpcion) => {
        setProductoSeleccionadoKit(itemOpcion);
        setBusquedaProductoKit(itemOpcion.nombre_mostrar);
        setMostrarSugerenciasKit(false);
    };

    const agregarItemAlKit = () => {
        if (!productoSeleccionadoKit) {
            return alert('⚠️ Busca y selecciona un producto del catálogo para añadirlo al kit.');
        }
        const cant = parseFloat(cantidadSeleccionadaKit);
        if (isNaN(cant) || cant <= 0) return alert('Ingresa una cantidad válida.');

        const piezasRealesTotal = +(cant * (productoSeleccionadoKit.multiplicador || 1)).toFixed(3);

        const existente = kitComponentes.find((item) => item.producto_id === productoSeleccionadoKit.id);
        if (existente) {
            setKitComponentes(kitComponentes.map((item) => 
                item.producto_id === productoSeleccionadoKit.id 
                    ? { ...item, cantidad: +(item.cantidad + piezasRealesTotal).toFixed(3) } 
                    : item
            ));
        } else {
            setKitComponentes([
                ...kitComponentes,
                {
                    producto_id: productoSeleccionadoKit.id,
                    nombre: productoSeleccionadoKit.nombre_mostrar,
                    precioUnitario: productoSeleccionadoKit.precio_aplicar,
                    cantidad: piezasRealesTotal
                }
            ]);
        }

        setProductoSeleccionadoKit(null);
        setBusquedaProductoKit('');
        setCantidadSeleccionadaKit('1');
    };

    const quitarItemDelKit = (productoId) => {
        setKitComponentes(kitComponentes.filter((it) => it.producto_id !== productoId));
    };

    const guardarKit = async (e) => {
        e.preventDefault();
        if (!nuevoKitCodigo.trim() || !nuevoKitNombre.trim() || !nuevoKitPrecio) {
            return alert('Completa el código, nombre y precio del kit.');
        }
        if (kitComponentes.length === 0) {
            return alert('Agrega al menos un artículo componente al kit.');
        }

        const payload = {
            codigo: nuevoKitCodigo.trim(),
            nombre: nuevoKitNombre.trim(),
            precio: parseFloat(nuevoKitPrecio),
            items: kitComponentes.map((it) => ({
                producto_id: it.producto_id,
                cantidad: it.cantidad
            }))
        };

        try {
            const res = await fetch(`${API_URL}/api/kits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('✅ ¡Kit creado exitosamente!');
                setNuevoKitCodigo(generarCodigoKitAutomatico());
                setNuevoKitNombre('');
                setNuevoKitPrecio('');
                setKitComponentes([]);
                cargarCatalogos();
            } else {
                alert('Error al guardar el kit en el servidor.');
            }
        } catch (error) {
            alert('Error de conexión al guardar el kit.');
        }
    };

    const eliminarKit = async (id, nombre) => {
        if (!window.confirm(`¿Seguro que deseas eliminar el kit "${nombre}"?`)) return;
        try {
            const res = await fetch(`${API_URL}/api/kits/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Kit eliminado correctamente.');
                cargarCatalogos();
            }
        } catch (error) {
            alert('Error al eliminar el kit.');
        }
    };

    const costoSumaComponentes = kitComponentes.reduce(
        (acc, it) => acc + (it.precioUnitario || 0) * (it.cantidad || 1),
        0
    );

    // Funciones de Gestión de Catálogos (Editar/Eliminar Deptos, Cats, Provs)
    const abrirModalEditarCat = (tipo, item) => {
        setModalEditCatalog({ tipo, item });
        setEditNombre(item.nombre || '');
        setEditTelefono(item.telefono || '');
        setEditContacto(item.contacto || '');
    };

    const guardarEdicionCat = async (e) => {
        e.preventDefault();
        const { tipo, item } = modalEditCatalog;
        let url = '';
        let body = {};

        if (tipo === 'departamento') {
            url = `${API_URL}/api/departamentos/${item.id}`;
            body = { nombre: editNombre };
        } else if (tipo === 'categoria') {
            url = `${API_URL}/api/categorias/${item.id}`;
            body = { nombre: editNombre };
        } else if (tipo === 'proveedor') {
            url = `${API_URL}/api/proveedores/${item.id}`;
            body = { nombre: editNombre, telefono: editTelefono, contacto: editContacto };
        }

        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert('✅ Actualizado correctamente.');
                setModalEditCatalog(null);
                cargarCatalogos();
                cargarProductos();
            } else {
                const data = await res.json();
                alert(data.error || 'Error al actualizar.');
            }
        } catch {
            alert('Error de conexión.');
        }
    };

    const eliminarElementoCat = async (tipo, item) => {
        if (!window.confirm(`¿Seguro que deseas eliminar "${item.nombre}"?`)) return;
        let url = '';
        if (tipo === 'departamento') url = `${API_URL}/api/departamentos/${item.id}`;
        else if (tipo === 'categoria') url = `${API_URL}/api/categorias/${item.id}`;
        else if (tipo === 'proveedor') url = `${API_URL}/api/proveedores/${item.id}`;

        try {
            const res = await fetch(url, { method: 'DELETE' });
            if (res.ok) {
                alert('✅ Eliminado correctamente.');
                cargarCatalogos();
            } else {
                const data = await res.json();
                alert(data.error || 'No se pudo eliminar.');
            }
        } catch {
            alert('Error de conexión.');
        }
    };

    // Historial de compras
    const abrirHistorialCostos = async (prod) => {
        setProductoHistorial(prod);
        setDatosNuevaCompra({
            proveedor: prod.proveedor_nombre || '',
            costoPaquete: prod.costoPaquete || '',
            piezasPorPaquete: prod.piezasPorPaquete || '1',
            costoUnitario: prod.costo || '',
            cantidadComprada: '',
            nota: '',
            fechaCompra: fechaHoyLocal(),
            actualizarPrecioVenta: false,
            nuevoPrecioVenta: prod.precioVenta || ''
        });

        try {
            const res = await fetch(`${API_URL}/api/productos/${prod.id}/historial-costos`);
            if (res.ok) setListaHistorialCostos(await res.json());
        } catch (error) {
            console.error('Error al consultar historial:', error);
        }
    };

    const registrarNuevaCompra = async (e) => {
        e.preventDefault();
        if (!datosNuevaCompra.proveedor.trim()) return alert('⚠️ Indica el proveedor o lugar de compra.');
        if (!datosNuevaCompra.costoUnitario) return alert('⚠️ Ingresa el costo unitario de la compra.');

        try {
            const res = await fetch(`${API_URL}/api/productos/${productoHistorial.id}/registrar-compra`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosNuevaCompra)
            });

            if (res.ok) {
                alert('✅ ¡Compra registrada! Se actualizó el stock y el historial.');
                await cargarProductos();
                const resHist = await fetch(`${API_URL}/api/productos/${productoHistorial.id}/historial-costos`);
                if (resHist.ok) setListaHistorialCostos(await resHist.json());
                setDatosNuevaCompra((prev) => ({ 
                    ...prev, 
                    cantidadComprada: '', 
                    nota: '',
                    fechaCompra: fechaHoyLocal() 
                }));
            }
        } catch (error) {
            alert('Error de conexión al guardar la compra.');
        }
    };

    const guardarPromocion = async (e) => {
        e.preventDefault();
        if (!nuevaPromoNombre.trim()) return alert('Escribe el nombre de la promoción.');

        try {
            const res = await fetch(`${API_URL}/api/promociones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nuevaPromoNombre,
                    tipo: nuevaPromoTipo,
                    valor: nuevaPromoTipo === 'porcentaje' ? parseFloat(nuevaPromoValor) || 0 : 0
                })
            });

            if (res.ok) {
                alert('¡Promoción creada exitosamente!');
                setNuevaPromoNombre('');
                setNuevaPromoValor('');
                cargarCatalogos();
            }
        } catch (err) {
            alert('Error de conexión.');
        }
    };

    const eliminarPromocion = async (id, nombre) => {
        if (!window.confirm(`¿Estás seguro de eliminar la promoción "${nombre}"?`)) return;
        try {
            const res = await fetch(`${API_URL}/api/promociones/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Promoción eliminada.');
                cargarCatalogos();
            }
        } catch (err) {
            alert('Error al eliminar.');
        }
    };

    const handleExportarVacio = () => { alert("La exportación está desactivada temporalmente."); };
    const handleImportarVacio = () => { alert("La importación está desactivada temporalmente."); if(fileInputRef.current) fileInputRef.current.value = null; };

    const toggleColumna = (colName) => {
        setColumnasVisibles(prev => ({ ...prev, [colName]: !prev[colName] }));
    };

    const handleNuevoProducto = () => {
        limpiarFormulario();
        setVista('formulario');
    };

    const handleEditarProducto = (prod) => {
        setDatosForm({
            id: prod.id || null,
            codigoBarras: prod.codigoBarras || '',
            nombre: prod.nombre || '',
            locacion: prod.locacion || '',
            claveUnidad: prod.claveUnidad || 'PZA',
            atributoColor: prod.atributoColor || '',
            departamento: prod.departamento_id || prod.departamento || '',
            categoria: prod.categoria_id || prod.categoria || '',
            proveedor: prod.proveedor_id || prod.proveedor || '',
            imagen: prod.imagen || '',
            imagenLocacion: prod.imagenLocacion || '',
            costoPaquete: prod.costoPaquete || '',
            piezasPorPaquete: prod.piezasPorPaquete || '1',
            precioVentaPaquete: prod.precioVentaPaquete || '',
            notaPaquete: prod.notaPaquete || '',
            costo: prod.costo || '',
            precioVenta: prod.precioVenta || '',
            ganancia: prod.ganancia || '',
            invMinimo: prod.invMinimo || '',
            invActual: prod.invActual || '',
            puntosLealtad: prod.puntosLealtad || '',
            fechaCompra: prod.fechaCompra ? prod.fechaCompra.split('T')[0] : fechaHoyLocal()
        });

        setOpciones({
            esServicio: Boolean(prod.esServicio),
            aGranel: Boolean(prod.aGranel)
        });

        setPestanaActiva('generales');
        setVista('formulario');
    };

    const handleEliminarProducto = async (id, nombre) => {
        if (!window.confirm(`¿Estás seguro de eliminar el producto "${nombre}"?`)) return;
        try {
            const res = await fetch(`${API_URL}/api/productos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Producto eliminado correctamente.');
                cargarProductos();
            }
        } catch (err) {
            alert('Error de conexión.');
        }
    };

    const limpiarFormulario = () => {
        setDatosForm(estadoInicialForm);
        setOpciones(estadoInicialOpciones);
        setPestanaActiva('generales');
    };

    const handleVolverAlCatalogo = () => {
        limpiarFormulario();
        setVista('catalogo');
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setDatosForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleImagenChange = (e, campo) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setDatosForm((prev) => ({ ...prev, [campo]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePrecioChange = (e) => {
        const { name, value } = e.target;
        setDatosForm((prev) => {
            const nuevoForm = { ...prev, [name]: value };
            let costoPaq = parseFloat(name === 'costoPaquete' ? value : prev.costoPaquete) || 0;
            let pzsPaq = parseFloat(name === 'piezasPorPaquete' ? value : prev.piezasPorPaquete) || 1;
            let costoUnitario = parseFloat(prev.costo) || 0;
            
            if (name === 'costoPaquete' || name === 'piezasPorPaquete') {
                if (costoPaq > 0 && pzsPaq > 0) {
                    costoUnitario = costoPaq / pzsPaq;
                    nuevoForm.costo = costoUnitario.toFixed(2);
                }
            } else if (name === 'costo') {
                costoUnitario = parseFloat(value) || 0;
            }

            if (name === 'precioVenta' || name === 'costo' || name === 'costoPaquete' || name === 'piezasPorPaquete') {
                let precio = parseFloat(name === 'precioVenta' ? value : prev.precioVenta) || 0;
                if (costoUnitario > 0 && precio > 0) {
                    let gananciaCalculada = ((precio - costoUnitario) / costoUnitario) * 100;
                    nuevoForm.ganancia = gananciaCalculada.toFixed(2);
                }
            }

            if (name === 'ganancia') {
                let porcGanancia = parseFloat(value) || 0;
                if (costoUnitario > 0) {
                    let precioCalculado = costoUnitario * (1 + porcGanancia / 100);
                    nuevoForm.precioVenta = precioCalculado.toFixed(2);
                }
            }

            return nuevoForm;
        });
    };

    const guardarProducto = async (e) => {
        e.preventDefault();
        const payload = {
            ...datosForm,
            ...opciones,
            invActual: parseFloat(datosForm.invActual) || 0,
            invMinimo: parseFloat(datosForm.invMinimo) || 0,
            costo: parseFloat(datosForm.costo) || 0,
            precioVenta: parseFloat(datosForm.precioVenta) || 0
        };

        const esEdicion = Boolean(datosForm.id);
        const url = esEdicion ? `${API_URL}/api/productos/${datosForm.id}` : `${API_URL}/api/productos`;
        const method = esEdicion ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                alert(`¡Producto ${esEdicion ? 'actualizado' : 'guardado'} exitosamente!`);
                await cargarProductos();
                handleVolverAlCatalogo();
            } else {
                const errorData = await res.json();
                alert(`Error al guardar: ${errorData.error || 'Verifica los campos.'}`);
            }
        } catch (err) {
            alert('No se pudo conectar con el servidor.');
        }
    };

    const handleGuardarNuevoElemento = async (e) => {
        e.preventDefault();
        let url = '';
        let body = {};
        if (modalTipo === 'departamento') { url = `${API_URL}/api/departamentos`; body = { nombre: nuevoNombre }; }
        else if (modalTipo === 'categoria') { url = `${API_URL}/api/categorias`; body = { nombre: nuevoNombre }; }
        else if (modalTipo === 'proveedor') { url = `${API_URL}/api/proveedores`; body = { nombre: nuevoNombre, telefono: nuevoTelefono, contacto: nuevoContacto }; }

        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (res.ok) {
                const creado = await res.json();
                await cargarCatalogos();
                setDatosForm((prev) => ({ ...prev, [modalTipo]: creado.id }));
                cerrarModal();
            }
        } catch (err) {
            alert('Error de conexión.');
        }
    };

    const cerrarModal = () => { setModalTipo(null); setNuevoNombre(''); setNuevoTelefono(''); setNuevoContacto(''); };

    const handleSort = (columna) => {
        if (ordenColumna === columna) { setOrdenDireccion((prev) => (prev === 'asc' ? 'desc' : 'asc')); } 
        else { setOrdenColumna(columna); setOrdenDireccion('asc'); }
    };

    const productosFiltrados = productos.filter((prod) => {
        const busq = busqueda.toLowerCase();
        const coincideBusqueda =
            prod.nombre?.toLowerCase().includes(busq) ||
            prod.codigoBarras?.toLowerCase().includes(busq) ||
            prod.departamento_nombre?.toLowerCase().includes(busq) ||
            prod.categoria_nombre?.toLowerCase().includes(busq) ||
            prod.proveedor_nombre?.toLowerCase().includes(busq);
        const coincideDepto = filtroDepto ? String(prod.departamento_id || prod.departamento) === String(filtroDepto) : true;
        return coincideBusqueda && coincideDepto;
    });

    const productosOrdenados = [...productosFiltrados].sort((a, b) => {
        let valA = a[ordenColumna]; let valB = b[ordenColumna];
        if (['costo', 'precioVenta', 'invActual'].includes(ordenColumna)) {
            valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0;
        } else {
            valA = (valA || '').toString().toLowerCase(); valB = (valB || '').toString().toLowerCase();
        }
        if (valA < valB) return ordenDireccion === 'asc' ? -1 : 1;
        if (valA > valB) return ordenDireccion === 'asc' ? 1 : -1;
        return 0;
    });

    const totalItems = productosOrdenados.length;
    const totalPaginas = Math.ceil(totalItems / itemsPorPagina) || 1;
    const indiceInicial = (paginaActual - 1) * itemsPorPagina;
    const productosPaginados = productosOrdenados.slice(indiceInicial, indiceInicial + itemsPorPagina);

    const pzsPorPaquete = parseFloat(datosForm.piezasPorPaquete) || 1;
    const stockTotalPzs = parseFloat(datosForm.invActual) || 0;
    const paquetesCompletos = Math.floor(stockTotalPzs / pzsPorPaquete);
    const piezasSueltas = +(stockTotalPzs % pzsPorPaquete).toFixed(2);
    const deshabilitaInventario = opciones.esServicio;

    return (
        <div className="gp-container">
            <header className="gp-header">
                <div className="gp-branding">
                    <img src={logoAsadel} alt="Logo ASADEL" style={{ height: '35px' }} />
                    <h2>
                        {vista === 'catalogo' ? 'CATÁLOGO DE PRODUCTOS' : 
                         vista === 'promociones' ? 'GESTIÓN DE PROMOCIONES' : 
                         vista === 'kits' ? 'PAQUETES Y KITS ESCOLARES' :
                         vista === 'gestion_catalogos' ? 'ADMINISTRACIÓN DE DEPARTAMENTOS Y PROVEEDORES' :
                         datosForm.id ? 'EDITAR PRODUCTO' : 'AGREGAR NUEVO PRODUCTO'}
                    </h2>
                </div>

                <div className="gp-header-actions">
                    {vista !== 'formulario' ? (
                        <>
                            {/* Pestañas de navegación superiores */}
                            <div className="gp-tabs-nav">
                                <button 
                                    className={`gp-tab-nav-btn ${vista === 'catalogo' ? 'active' : ''}`}
                                    onClick={() => setVista('catalogo')}
                                >
                                    📋 Catálogo ({productos.length})
                                </button>
                                <button 
                                    className={`gp-tab-nav-btn ${vista === 'kits' ? 'active' : ''}`}
                                    onClick={() => {
                                        setNuevoKitCodigo(generarCodigoKitAutomatico());
                                        setVista('kits');
                                    }}
                                >
                                    📦 Paquetes y Kits ({kits.length})
                                </button>
                                <button 
                                    className={`gp-tab-nav-btn ${vista === 'promociones' ? 'active' : ''}`}
                                    onClick={() => setVista('promociones')}
                                >
                                    🏷️ Promociones ({promociones.length})
                                </button>
                                <button 
                                    className={`gp-tab-nav-btn ${vista === 'gestion_catalogos' ? 'active' : ''}`}
                                    onClick={() => setVista('gestion_catalogos')}
                                >
                                    📂 Deptos y Proveedores
                                </button>
                            </div>

                            {vista === 'catalogo' && (
                                <>
                                    <div className="column-menu-wrapper">
                                        <button className="btn-secondary" onClick={() => setMostrarMenuColumnas(!mostrarMenuColumnas)}>
                                            ⚙️ Columnas
                                        </button>
                                        {mostrarMenuColumnas && (
                                            <div className="column-dropdown">
                                                <h4>Mostrar/Ocultar</h4>
                                                {Object.keys(columnasVisibles).map(key => (
                                                    <label key={key} className="checkbox-label">
                                                        <input type="checkbox" checked={columnasVisibles[key]} onChange={() => toggleColumna(key)} />
                                                        {key.charAt(0).toUpperCase() + key.slice(1)}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn-secondary" onClick={() => fileInputRef.current.click()}>⬆️️ Importar</button>
                                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv" onChange={handleImportarVacio} />
                                    <button className="btn-secondary" onClick={handleExportarVacio}>⬇️ Exportar CSV</button>
                                    <button className="btn-primary" onClick={handleNuevoProducto}>+ Agregar Producto</button>
                                </>
                            )}
                        </>
                    ) : (
                        <button className="btn-secondary" onClick={handleVolverAlCatalogo}>
                            ← Volver al Catálogo
                        </button>
                    )}
                </div>
            </header>

            {/* VISTA DE GESTIÓN DE DEPARTAMENTOS, CATEGORÍAS Y PROVEEDORES */}
            {vista === 'gestion_catalogos' && (
                <div className="gp-catalogo-view" style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
                        <button className={`gp-tab-btn ${subvistaCatalogo === 'departamentos' ? 'active' : ''}`} onClick={() => setSubvistaCatalogo('departamentos')}>
                            🏢 Departamentos ({departamentos.length})
                        </button>
                        <button className={`gp-tab-btn ${subvistaCatalogo === 'categorias' ? 'active' : ''}`} onClick={() => setSubvistaCatalogo('categorias')}>
                            🏷️ Categorías ({categorias.length})
                        </button>
                        <button className={`gp-tab-btn ${subvistaCatalogo === 'proveedores' ? 'active' : ''}`} onClick={() => setSubvistaCatalogo('proveedores')}>
                            🚚 Proveedores ({proveedores.length})
                        </button>
                    </div>

                    {subvistaCatalogo === 'departamentos' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0' }}>
                                <h3>Administrar Departamentos</h3>
                                <button className="btn-primary" onClick={() => setModalTipo('departamento')}>+ Nuevo Departamento</button>
                            </div>
                            <table className="gp-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Nombre del Departamento</th>
                                        <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departamentos.map((d) => (
                                        <tr key={d.id}>
                                            <td>#{d.id}</td>
                                            <td><strong>{d.nombre}</strong></td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn-action edit" onClick={() => abrirModalEditarCat('departamento', d)} title="Editar" style={{ marginRight: '6px' }}>✏️</button>
                                                <button className="btn-action delete" onClick={() => eliminarElementoCat('departamento', d)} title="Eliminar">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {subvistaCatalogo === 'categorias' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0' }}>
                                <h3>Administrar Categorías</h3>
                                <button className="btn-primary" onClick={() => setModalTipo('categoria')}>+ Nueva Categoría</button>
                            </div>
                            <table className="gp-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Nombre de la Categoría</th>
                                        <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categorias.map((c) => (
                                        <tr key={c.id}>
                                            <td>#{c.id}</td>
                                            <td><strong>{c.nombre}</strong></td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn-action edit" onClick={() => abrirModalEditarCat('categoria', c)} title="Editar" style={{ marginRight: '6px' }}>✏️</button>
                                                <button className="btn-action delete" onClick={() => eliminarElementoCat('categoria', c)} title="Eliminar">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {subvistaCatalogo === 'proveedores' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0' }}>
                                <h3>Administrar Proveedores</h3>
                                <button className="btn-primary" onClick={() => setModalTipo('proveedor')}>+ Nuevo Proveedor</button>
                            </div>
                            <table className="gp-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Nombre / Empresa</th>
                                        <th>Teléfono</th>
                                        <th>Contacto</th>
                                        <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {proveedores.map((p) => (
                                        <tr key={p.id}>
                                            <td>#{p.id}</td>
                                            <td><strong>{p.nombre}</strong></td>
                                            <td>{p.telefono || '—'}</td>
                                            <td>{p.contacto || '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn-action edit" onClick={() => abrirModalEditarCat('proveedor', p)} title="Editar" style={{ marginRight: '6px' }}>✏️</button>
                                                <button className="btn-action delete" onClick={() => eliminarElementoCat('proveedor', p)} title="Eliminar">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA DE KITS Y PAQUETES */}
            {vista === 'kits' && (
                <div className="gp-catalogo-view">
                    <div className="gp-kits-builder">
                        <form className="box-kit-form" onSubmit={guardarKit}>
                            <h3>+ Crear Paquete o Kit Escolar</h3>
                            <div className="form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    Código del Kit (Generado Automáticamente):
                                    <button 
                                        type="button" 
                                        onClick={() => setNuevoKitCodigo(generarCodigoKitAutomatico())} 
                                        style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                    >
                                        🔄 Cambiar código
                                    </button>
                                </label>
                                <input 
                                    type="text" 
                                    value={nuevoKitCodigo} 
                                    onChange={(e) => setNuevoKitCodigo(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label>Nombre del Kit:</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej. Paquete Escolar Primaria..." 
                                    value={nuevoKitNombre} 
                                    onChange={(e) => setNuevoKitNombre(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label>Precio Especial de Venta ($):</label>
                                <input 
                                    type="number" 
                                    step="0.5" 
                                    placeholder="0.00" 
                                    value={nuevoKitPrecio} 
                                    onChange={(e) => setNuevoKitPrecio(e.target.value)} 
                                    required 
                                />
                            </div>

                            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
                                💾 Guardar Kit
                            </button>
                        </form>

                        <div className="box-kit-componentes">
                            <h4>Componentes del Paquete</h4>
                            
                            <div className="kit-selector-row" ref={kitBuscadorRef}>
                                <div className="kit-search-wrapper">
                                    <input 
                                        type="text" 
                                        placeholder="🔍 Escribe para buscar producto..." 
                                        value={busquedaProductoKit}
                                        onChange={(e) => {
                                            setBusquedaProductoKit(e.target.value);
                                            setProductoSeleccionadoKit(null);
                                        }}
                                        onFocus={() => {
                                            if (sugerenciasKit.length > 0) setMostrarSugerenciasKit(true);
                                        }}
                                    />
                                    {mostrarSugerenciasKit && sugerenciasKit.length > 0 && (
                                        <ul className="kit-autocomplete-dropdown">
                                            {sugerenciasKit.map((itemOpcion) => (
                                                <li 
                                                    key={itemOpcion.id_kit_item} 
                                                    className="kit-autocomplete-item"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        seleccionarProductoKit(itemOpcion);
                                                    }}
                                                >
                                                    <div>
                                                        <strong>{itemOpcion.nombre_mostrar}</strong>
                                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                            Cód: {itemOpcion.codigoBarras || 'S/N'} {itemOpcion.multiplicador > 1 ? `(${itemOpcion.multiplicador} pzs/paq)` : ''}
                                                        </div>
                                                    </div>
                                                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>
                                                        ${parseFloat(itemOpcion.precio_aplicar || 0).toFixed(2)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <input 
                                    type="number" 
                                    step="any"
                                    min="0.1" 
                                    value={cantidadSeleccionadaKit} 
                                    onChange={(e) => setCantidadSeleccionadaKit(e.target.value)} 
                                    title="Cantidad de piezas o paquetes a añadir al kit"
                                />
                                <button type="button" className="btn-primary" onClick={agregarItemAlKit}>
                                    + Agregar
                                </button>
                            </div>

                            <div className="kit-items-list">
                                {kitComponentes.map((item) => (
                                    <div key={item.producto_id} className="kit-item-row">
                                        <div>
                                            <strong>{item.cantidad}x</strong> {item.nombre} 
                                            <span style={{ color: '#64748b', marginLeft: '6px' }}>
                                                (${(item.precioUnitario * item.cantidad).toFixed(2)})
                                            </span>
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn-remove-kit-item" 
                                            onClick={() => quitarItemDelKit(item.producto_id)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {kitComponentes.length === 0 && (
                                    <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '15px 0', textAlign: 'center' }}>
                                        No has agregado artículos a este kit todavía.
                                    </div>
                                )}
                            </div>

                            <div className="kit-cost-preview">
                                <span>Suma de precios normales:</span>
                                <strong>${costoSumaComponentes.toFixed(2)} MXN</strong>
                            </div>
                        </div>
                    </div>

                    <h3 style={{ marginTop: '20px' }}>Kits Registrados en el Sistema</h3>
                    <table className="gp-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Nombre del Kit</th>
                                <th>Artículos que Descuenta</th>
                                <th>Precio Venta</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {kits.map((k) => (
                                <tr key={k.id}>
                                    <td><code>{k.codigo}</code></td>
                                    <td><strong>{k.nombre}</strong></td>
                                    <td>
                                        {(k.items || []).map((it, idx) => (
                                            <span key={idx} style={{ display: 'inline-block', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', margin: '2px' }}>
                                                {it.cantidad}x {it.nombre}
                                            </span>
                                        ))}
                                    </td>
                                    <td style={{ fontWeight: 'bold', color: '#16a34a' }}>
                                        ${parseFloat(k.precio || 0).toFixed(2)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button 
                                            className="btn-action delete" 
                                            onClick={() => eliminarKit(k.id, k.nombre)} 
                                            title="Eliminar Kit"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {kits.length === 0 && (
                                <tr><td colSpan="5" className="gp-empty">No hay kits registrados todavía.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* VISTA DE PROMOCIONES */}
            {vista === 'promociones' && (
                <div className="gp-catalogo-view" style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <h3>Crear Nueva Promoción o Campaña</h3>
                    <form onSubmit={guardarPromocion} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '25px' }}>
                        <div className="form-group">
                            <label>Nombre de la Promoción:</label>
                            <input type="text" value={nuevaPromoNombre} onChange={(e) => setNuevaPromoNombre(e.target.value)} placeholder="Ej. 10% Descuento Especial" required />
                        </div>
                        <div className="form-group">
                            <label>Tipo de Promoción:</label>
                            <select value={nuevaPromoTipo} onChange={(e) => setNuevaPromoTipo(e.target.value)}>
                                <option value="porcentaje">Porcentaje de Descuento (%)</option>
                                <option value="manual">Descuento Especial (Manual en Caja)</option>
                            </select>
                        </div>
                        {nuevaPromoTipo === 'porcentaje' && (
                            <div className="form-group">
                                <label>Porcentaje (%):</label>
                                <input type="number" min="1" max="100" value={nuevaPromoValor} onChange={(e) => setNuevaPromoValor(e.target.value)} placeholder="Ej. 15" required />
                            </div>
                        )}
                        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>Guardar Promoción</button>
                    </form>

                    <h3>Promociones Activas en el Sistema</h3>
                    <table className="gp-table" style={{ marginTop: '10px' }}>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Valor</th>
                                <th style={{ width: '80px' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {promociones.map((p) => (
                                <tr key={p.id}>
                                    <td><strong>{p.nombre}</strong></td>
                                    <td>{p.tipo === 'porcentaje' ? 'Porcentaje' : 'Manual'}</td>
                                    <td>{p.tipo === 'porcentaje' ? `${p.valor}%` : 'Variable'}</td>
                                    <td>
                                        <button className="btn-action delete" onClick={() => eliminarPromocion(p.id, p.nombre)} title="Eliminar">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                            {promociones.length === 0 && (
                                <tr><td colSpan="4" className="gp-empty">No hay promociones registradas.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {vista === 'catalogo' && (
                <div className="gp-catalogo-view">
                    <div className="gp-filter-bar">
                        <div className="filter-group flex-1">
                            <input
                                ref={busquedaInputRef}
                                type="text"
                                placeholder="🔍 Buscar por nombre, código, depto, categoría..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                        <div className="filter-group">
                            <select value={filtroDepto} onChange={(e) => setFiltroDepto(e.target.value)}>
                                <option value="">-- Todos los Departamentos --</option>
                                {departamentos.map((d) => (
                                    <option key={d.id} value={d.id}>{d.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-group">
                            <select value={itemsPorPagina} onChange={(e) => setItemsPorPagina(Number(e.target.value))}>
                                <option value={5}>5 por pág.</option>
                                <option value={10}>10 por pág.</option>
                                <option value={20}>20 por pág.</option>
                                <option value={50}>50 por pág.</option>
                            </select>
                        </div>
                    </div>

                    <div className="gp-table-container">
                        {cargando ? (
                            <div className="gp-loading">Cargando catálogo de productos...</div>
                        ) : productosPaginados.length === 0 ? (
                            <div className="gp-empty">No se encontraron productos registrados.</div>
                        ) : (
                            <table className="gp-table">
                                <thead>
                                    <tr>
                                        {columnasVisibles.img && <th className="col-img">Img</th>}
                                        {columnasVisibles.codigo && <th className="sortable" onClick={() => handleSort('codigoBarras')}>Código</th>}
                                        {columnasVisibles.nombre && <th className="sortable" onClick={() => handleSort('nombre')}>Producto</th>}
                                        {columnasVisibles.departamento && <th>Departamento</th>}
                                        {columnasVisibles.categoria && <th>Categoría</th>}
                                        {columnasVisibles.proveedor && <th>Proveedor</th>}
                                        {columnasVisibles.costo && <th className="sortable" onClick={() => handleSort('costo')}>Costo</th>}
                                        {columnasVisibles.precio && <th className="sortable" onClick={() => handleSort('precioVenta')}>Precio</th>}
                                        {columnasVisibles.stock && <th className="sortable" onClick={() => handleSort('invActual')}>Stock</th>}
                                        {columnasVisibles.estado && <th>Estado</th>}
                                        {columnasVisibles.acciones && <th>Acciones</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosPaginados.map((prod) => {
                                        const stock = parseFloat(prod.invActual) || 0;
                                        const min = parseFloat(prod.invMinimo) || 0;
                                        let badgeClass = 'badge-success'; let badgeText = 'Normal';
                                        
                                        if (prod.esServicio) {
                                            badgeClass = 'badge-warning';
                                            badgeText = 'Servicio';
                                        } else if (stock <= 0) { 
                                            badgeClass = 'badge-danger'; 
                                            badgeText = 'Agotado'; 
                                        } else if (stock <= min) { 
                                            badgeClass = 'badge-warning'; 
                                            badgeText = 'Bajo Stock'; 
                                        }

                                        return (
                                            <tr key={prod.id || prod.codigoBarras}>
                                                {columnasVisibles.img && (
                                                    <td className="col-img">
                                                        {prod.imagen ? (
                                                            <img 
                                                              src={prod.imagen} 
                                                              alt={prod.nombre} 
                                                              className="thumb-img clickable-img" 
                                                              onClick={() => setImagenAmpliada(prod.imagen)}
                                                            />
                                                        ) : (
                                                            <div className="thumb-placeholder">📷</div>
                                                        )}
                                                    </td>
                                                )}
                                                {columnasVisibles.codigo && <td><code>{prod.codigoBarras}</code></td>}
                                                {columnasVisibles.nombre && (
                                                    <td className="col-nombre">
                                                        <strong>{prod.nombre}</strong>
                                                        {prod.atributoColor && <small>({prod.atributoColor})</small>}
                                                        {prod.esKit ? <small style={{ color: '#0d6efd' }}>📦 [Kit]</small> : null}
                                                        {prod.aGranel ? <small style={{ color: '#16a34a' }}>⚖️ [Granel]</small> : null}
                                                    </td>
                                                )}
                                                {columnasVisibles.departamento && <td>{prod.departamento_nombre || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin asignación</span>}</td>}
                                                {columnasVisibles.categoria && <td>{prod.categoria_nombre || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin asignación</span>}</td>}
                                                {columnasVisibles.proveedor && <td>{prod.proveedor_nombre || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin asignación</span>}</td>}
                                                {columnasVisibles.costo && <td>${parseFloat(prod.costo || 0).toFixed(2)}</td>}
                                                {columnasVisibles.precio && <td><strong>${parseFloat(prod.precioVenta || 0).toFixed(2)}</strong></td>}
                                                {columnasVisibles.stock && (
                                                    <td>
                                                        {prod.esServicio ? '—' : `${prod.invActual || 0} pza(s)`}
                                                    </td>
                                                )}
                                                {columnasVisibles.estado && <td><span className={`badge ${badgeClass}`}>{badgeText}</span></td>}
                                                {columnasVisibles.acciones && (
                                                    <td className="col-actions">
                                                        <button 
                                                            className="btn-action history" 
                                                            onClick={() => abrirHistorialCostos(prod)} 
                                                            title="Historial de costos y registrar nueva compra"
                                                        >
                                                            📜
                                                        </button>
                                                        <button className="btn-action edit" onClick={() => handleEditarProducto(prod)} title="Editar">✏️</button>
                                                        <button className="btn-action delete" onClick={() => handleEliminarProducto(prod.id, prod.nombre)} title="Eliminar">🗑️</button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {totalItems > 0 && (
                        <div className="gp-pagination">
                            <div className="pagination-info">Mostrando {indiceInicial + 1} - {Math.min(indiceInicial + itemsPorPagina, totalItems)} de {totalItems} productos</div>
                            <div className="pagination-controls">
                                <button className="btn-page" disabled={paginaActual === 1} onClick={() => setPaginaActual((prev) => prev - 1)}>◀ Anterior</button>
                                <span className="page-indicator">Página <strong>{paginaActual}</strong> de <strong>{totalPaginas}</strong></span>
                                <button className="btn-page" disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual((prev) => prev + 1)}>Siguiente ▶</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL DE HISTORIAL DE COMPRAS / COSTOS Y REGISTRO RÁPIDO */}
            {productoHistorial && (
                <div className="gp-modal-overlay">
                    <div className="gp-modal gp-modal-historial">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>HISTORIAL DE COMPRAS Y COSTOS</h3>
                                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                                    Producto: <strong>{productoHistorial.nombre}</strong> (Cód: {productoHistorial.codigoBarras || 'S/N'})
                                </p>
                            </div>
                            <button className="btn-secondary" onClick={() => setProductoHistorial(null)}>✕ Cerrar</button>
                        </div>

                        <form className="box-nueva-compra" onSubmit={registrarNuevaCompra}>
                            <h4>+ Registrar Nueva Compra / Entrada de Mercancía</h4>
                            <div className="grid-nueva-compra">
                                <div className="form-group">
                                    <label>Fecha de Compra:</label>
                                    <input 
                                        type="date" 
                                        value={datosNuevaCompra.fechaCompra} 
                                        onChange={(e) => setDatosNuevaCompra({ ...datosNuevaCompra, fechaCompra: e.target.value })} 
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Proveedor / Tienda:</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej. Tony, Scribe, Lumen..." 
                                        value={datosNuevaCompra.proveedor} 
                                        onChange={(e) => setDatosNuevaCompra({ ...datosNuevaCompra, proveedor: e.target.value })} 
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Costo Caja/Paq ($):</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="0.00" 
                                        value={datosNuevaCompra.costoPaquete} 
                                        onChange={(e) => {
                                            const cPaq = parseFloat(e.target.value) || 0;
                                            const pzs = parseFloat(datosNuevaCompra.piezasPorPaquete) || 1;
                                            setDatosNuevaCompra({ 
                                                ...datosNuevaCompra, 
                                                costoPaquete: e.target.value,
                                                costoUnitario: cPaq > 0 && pzs > 0 ? (cPaq / pzs).toFixed(2) : datosNuevaCompra.costoUnitario
                                            });
                                        }} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Pzs por Caja:</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={datosNuevaCompra.piezasPorPaquete} 
                                        onChange={(e) => {
                                            const pzs = parseFloat(e.target.value) || 1;
                                            const cPaq = parseFloat(datosNuevaCompra.costoPaquete) || 0;
                                            setDatosNuevaCompra({ 
                                                ...datosNuevaCompra, 
                                                piezasPorPaquete: e.target.value,
                                                costoUnitario: cPaq > 0 && pzs > 0 ? (cPaq / pzs).toFixed(2) : datosNuevaCompra.costoUnitario
                                            });
                                        }} 
                                    />
                                </div>
                            </div>

                            <div className="grid-nueva-compra" style={{ marginTop: '10px' }}>
                                <div className="form-group">
                                    <label>Costo Unitario ($):</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={datosNuevaCompra.costoUnitario} 
                                        onChange={(e) => setDatosNuevaCompra({ ...datosNuevaCompra, costoUnitario: e.target.value })} 
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Pzs Compradas (Sumar a Stock):</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        min="0" 
                                        placeholder="Ej. 50 ó 12.5" 
                                        value={datosNuevaCompra.cantidadComprada} 
                                        onChange={(e) => setDatosNuevaCompra({ ...datosNuevaCompra, cantidadComprada: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group" style={{ gridColumn: 'span 1' }}>
                                    <label>Nota de la compra (Opcional):</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej. Subió $4 en Tony..." 
                                        value={datosNuevaCompra.nota} 
                                        onChange={(e) => setDatosNuevaCompra({ ...datosNuevaCompra, nota: e.target.value })} 
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button type="submit" className="btn-primary" style={{ width: '100%', height: '38px' }}>
                                        📥 Guardar Compra
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <label className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        checked={datosNuevaCompra.actualizarPrecioVenta} 
                                        onChange={(e) => setDatosNuevaCompra({ ...datosNuevaCompra, actualizarPrecioVenta: e.target.checked })} 
                                    />
                                    ¿Ajustar también nuevo Precio de Venta al Público?
                                </label>
                                {datosNuevaCompra.actualizarPrecioVenta && (
                                    <input 
                                        type="number" 
                                        step="0.5" 
                                        style={{ width: '120px', padding: '4px 8px' }} 
                                        placeholder="Nuevo Precio $" 
                                        value={datosNuevaCompra.nuevoPrecioVenta} 
                                        onChange={(e) => setDatosNuevaCompra({ ...datosNuevaCompra, nuevoPrecioVenta: e.target.value })} 
                                    />
                                )}
                            </div>
                        </form>

                        <h4>Bitácora de Costos Anteriores</h4>
                        <table className="gp-table" style={{ fontSize: '0.85rem' }}>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Proveedor / Lugar</th>
                                    <th>Costo Caja/Paq</th>
                                    <th>Pzs/Caja</th>
                                    <th>Costo Unitario</th>
                                    <th>Compradas</th>
                                    <th>Nota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listaHistorialCostos.map((h) => (
                                    <tr key={h.id}>
                                        <td>
                                            {h.fecha_compra ? h.fecha_compra.split('T')[0] : '—'}
                                        </td>
                                        <td><strong>{h.proveedor}</strong></td>
                                        <td>{h.costo_paquete > 0 ? `$${parseFloat(h.costo_paquete).toFixed(2)}` : '-'}</td>
                                        <td>{h.piezas_por_paquete || 1} pzs</td>
                                        <td style={{ fontWeight: 'bold', color: '#16a34a' }}>${parseFloat(h.costo_unitario).toFixed(2)}</td>
                                        <td>{h.cantidad_comprada ? `+${h.cantidad_comprada} pzs` : '-'}</td>
                                        <td style={{ color: '#64748b', fontStyle: 'italic' }}>{h.nota || '-'}</td>
                                    </tr>
                                ))}
                                {listaHistorialCostos.length === 0 && (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                                            No hay registros de compras anteriores para este producto.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {imagenAmpliada && (
                <div className="gp-modal-overlay image-viewer-overlay" onClick={() => setImagenAmpliada(null)}>
                    <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-close-viewer" onClick={() => setImagenAmpliada(null)}>✕</button>
                        <img src={imagenAmpliada} alt="Producto ampliado" />
                    </div>
                </div>
            )}

            {vista === 'formulario' && (
                <form className="gp-body" onSubmit={guardarProducto}>
                    <div className="gp-left-col">
                        <div className="gp-image-box">
                            {datosForm.imagen ? (
                                <img src={datosForm.imagen} alt="Vista previa del producto" />
                            ) : (
                                <div className="gp-image-placeholder">IMAGEN DEL PRODUCTO</div>
                            )}
                        </div>

                        <label className="btn-upload">
                            📷 Cargar Imagen
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleImagenChange(e, 'imagen')}
                            />
                        </label>

                        {/* Opciones Especiales Excluyentes */}
                        <div className="gp-options-box">
                            <h4>Opciones Especiales:</h4>
                            <label className="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    checked={opciones.esServicio} 
                                    onChange={() => handleOpcionChange('esServicio')} 
                                />
                                Este producto es servicio (copias, impresiones, etc.)
                            </label>
                            <label className="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    checked={opciones.aGranel} 
                                    onChange={() => handleOpcionChange('aGranel')} 
                                />
                                Se vende a granel (listón, papel por metro, etc.)
                            </label>
                        </div>
                    </div>

                    <div className="gp-right-col">
                        <div className="gp-tabs">
                            <button type="button" className={`gp-tab-btn ${pestanaActiva === 'generales' ? 'active' : ''}`} onClick={() => setPestanaActiva('generales')}>DATOS GENERALES</button>
                            <button type="button" className={`gp-tab-btn ${pestanaActiva === 'precios' ? 'active' : ''}`} onClick={() => setPestanaActiva('precios')}>PRECIOS E INVENTARIO</button>
                        </div>

                        <div className="gp-tab-content">
                            {pestanaActiva === 'generales' ? (
                                <div className="gp-form-grid">
                                    <div className="form-group full-width"><label>Cód. de Barras:</label><input type="text" name="codigoBarras" value={datosForm.codigoBarras} onChange={handleInputChange} required /></div>
                                    <div className="form-group full-width"><label>Nombre:</label><input type="text" name="nombre" value={datosForm.nombre} onChange={handleInputChange} required /></div>
                                    
                                    {!opciones.esServicio && (
                                        <div className="form-group full-width locacion-group">
                                            <label>Locación (Anaquel/Fila/Caja):</label>
                                            <div className="select-with-btn">
                                                <input type="text" name="locacion" value={datosForm.locacion} onChange={handleInputChange} placeholder="Ej. Pasillo 3, Nivel 2" />
                                                <label className="btn-add-quick" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Subir foto de la locación">
                                                    📷
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => handleImagenChange(e, 'imagenLocacion')}
                                                    />
                                                </label>
                                                {datosForm.imagenLocacion && (
                                                    <button type="button" className="btn-secondary" style={{ padding: '0 10px', height: '38px' }} onClick={() => setImagenAmpliada(datosForm.imagenLocacion)}>
                                                        👁️ Ver Foto
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-group"><label>Clave/Unidad:</label><input type="text" name="claveUnidad" value={datosForm.claveUnidad} onChange={handleInputChange} /></div>
                                    <div className="form-group"><label>Atributo (Color/Talla):</label><input type="text" name="atributoColor" value={datosForm.atributoColor} onChange={handleInputChange} /></div>
                                    <div className="form-group"><label>Departamento:</label><div className="select-with-btn"><select name="departamento" value={datosForm.departamento} onChange={handleInputChange}><option value="">-- Seleccionar --</option>{departamentos.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}</select><button type="button" className="btn-add-quick" onClick={() => setModalTipo('departamento')}>+</button></div></div>
                                    <div className="form-group"><label>Categoría:</label><div className="select-with-btn"><select name="categoria" value={datosForm.categoria} onChange={handleInputChange}><option value="">-- Seleccionar --</option>{categorias.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}</select><button type="button" className="btn-add-quick" onClick={() => setModalTipo('categoria')}>+</button></div></div>
                                    <div className="form-group full-width"><label>Proveedor Habitual:</label><div className="select-with-btn"><select name="proveedor" value={datosForm.proveedor} onChange={handleInputChange}><option value="">-- Seleccionar Proveedor --</option>{proveedores.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}</select><button type="button" className="btn-add-quick" onClick={() => setModalTipo('proveedor')}>+</button></div></div>
                                </div>
                            ) : (
                                <div className="gp-form-grid">
                                    {opciones.esServicio ? (
                                        /* 1. MODO SERVICIO */
                                        <>
                                            <div className="form-group full-width" style={{ background: '#eff6ff', padding: '10px 14px', borderRadius: '6px', color: '#1e40af', fontSize: '0.85rem' }}>
                                                ℹ️ <strong>Modo Servicio:</strong> No requiere inventario, empaques ni locación física. Solo define el precio al público y el costo de tus insumos si aplica.
                                            </div>
                                            <div className="form-group">
                                                <label>Precio al Público ($):</label>
                                                <input 
                                                    type="number" 
                                                    step="0.05" 
                                                    name="precioVenta" 
                                                    value={datosForm.precioVenta} 
                                                    onChange={handlePrecioChange} 
                                                    placeholder="Ej. 1.00" 
                                                    required 
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Costo Estimado de Insumo ($): <small style={{ fontWeight: 'normal', color: '#666' }}>(Opcional)</small></label>
                                                <input 
                                                    type="number" 
                                                    step="0.05" 
                                                    name="costo" 
                                                    value={datosForm.costo} 
                                                    onChange={handlePrecioChange} 
                                                    placeholder="Ej. 0.30" 
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Ganancia Estimada (%):</label>
                                                <input 
                                                    type="number" 
                                                    step="0.1" 
                                                    name="ganancia" 
                                                    value={datosForm.ganancia} 
                                                    onChange={handlePrecioChange} 
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Puntos de Lealtad:</label>
                                                <input 
                                                    type="number" 
                                                    name="puntosLealtad" 
                                                    value={datosForm.puntosLealtad} 
                                                    onChange={handleInputChange} 
                                                    placeholder="0" 
                                                />
                                            </div>
                                        </>
                                    ) : opciones.aGranel ? (
                                        /* 2. MODO GRANEL / FRACCIÓN (METROS, ROLLOS, KILOS) */
                                        <>
                                            <div className="form-group full-width" style={{ background: '#ecfdf5', padding: '10px 14px', borderRadius: '6px', color: '#065f46', fontSize: '0.85rem' }}>
                                                ⚖️ <strong>Modo Granel / Fracción:</strong> Ideal para papel por pliego o metro, forro, hule cristal y listones. Permite registrar rollos/cajas y cobrar decimales en caja.
                                            </div>
                                            <div className="form-group">
                                                <label>Fecha de Entrada / Compra:</label>
                                                <input type="date" name="fechaCompra" value={datosForm.fechaCompra} onChange={handleInputChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Costo del Rollo o Caja Completa ($):</label>
                                                <input type="number" step="0.01" name="costoPaquete" value={datosForm.costoPaquete} onChange={handlePrecioChange} placeholder="Ej. 150.00" />
                                            </div>
                                            <div className="form-group">
                                                <label>Metros o Unidades que trae el Rollo/Caja:</label>
                                                <input type="number" step="any" name="piezasPorPaquete" value={datosForm.piezasPorPaquete} onChange={handlePrecioChange} placeholder="Ej. 50" />
                                            </div>
                                            <div className="form-group">
                                                <label>Costo por Metro / Fracción ($):</label>
                                                <input type="number" step="0.01" name="costo" value={datosForm.costo} onChange={handlePrecioChange} placeholder="0.00" required />
                                            </div>
                                            <div className="form-group">
                                                <label>Ganancia Deseada (%):</label>
                                                <input type="number" step="0.1" name="ganancia" value={datosForm.ganancia} onChange={handlePrecioChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Precio Venta al Público por Metro / Fracción ($):</label>
                                                <input type="number" step="0.01" name="precioVenta" value={datosForm.precioVenta} onChange={handlePrecioChange} placeholder="0.00" required />
                                            </div>
                                            <div className="form-group">
                                                <label>Existencia Actual (Metros/Kgs en Mostrador):</label>
                                                <input 
                                                    type="number" 
                                                    step="any" 
                                                    name="invActual" 
                                                    value={datosForm.invActual} 
                                                    onChange={handleInputChange} 
                                                    placeholder="Ej. 25.5" 
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Alerta Mínima de Stock (Metros/Kgs restantes):</label>
                                                <input 
                                                    type="number" 
                                                    step="any" 
                                                    name="invMinimo" 
                                                    value={datosForm.invMinimo} 
                                                    onChange={handleInputChange} 
                                                    placeholder="Ej. 5" 
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Puntos de Lealtad:</label>
                                                <input type="number" name="puntosLealtad" value={datosForm.puntosLealtad} onChange={handleInputChange} placeholder="0" />
                                            </div>
                                        </>
                                    ) : (
                                        /* 3. MODO NORMAL (LIBRETAS, PLUMAS Y ARTÍCULOS POR PIEZA) */
                                        <>
                                            <div className="form-group">
                                                <label>Fecha de Compra / Entrada:</label>
                                                <input type="date" name="fechaCompra" value={datosForm.fechaCompra} onChange={handleInputChange} />
                                            </div>
                                            <div className="form-group"><label>Costo por Paquete ($):</label><input type="number" step="0.01" name="costoPaquete" value={datosForm.costoPaquete} onChange={handlePrecioChange} /></div>
                                            <div className="form-group"><label>Pzs por Paquete:</label><input type="number" step="any" name="piezasPorPaquete" value={datosForm.piezasPorPaquete} onChange={handlePrecioChange} /></div>
                                            <div className="form-group"><label>Costo Unitario ($):</label><input type="number" step="0.01" name="costo" value={datosForm.costo} onChange={handlePrecioChange} /></div>
                                            <div className="form-group"><label>Ganancia Deseada (%):</label><input type="number" step="0.1" name="ganancia" value={datosForm.ganancia} onChange={handlePrecioChange} /></div>
                                            <div className="form-group"><label>Precio Venta Pza ($):</label><input type="number" step="0.01" name="precioVenta" value={datosForm.precioVenta} onChange={handlePrecioChange} /></div>
                                            <div className="form-group"><label>Precio Venta Paquete ($): <small style={{ fontWeight: 'normal', color: '#666' }}>(Opcional)</small></label><input type="number" step="0.01" name="precioVentaPaquete" value={datosForm.precioVentaPaquete} onChange={handleInputChange} /></div>
                                            
                                            <div className="form-group">
                                                <label>Stock Inicial (Pzs totales):</label>
                                                <input 
                                                    type="number" 
                                                    step="1"
                                                    name="invActual" 
                                                    disabled={deshabilitaInventario} 
                                                    value={deshabilitaInventario ? '0' : datosForm.invActual} 
                                                    onChange={handleInputChange} 
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Equivalencia en Paquetes:</label>
                                                <div style={{ padding: '8px 12px', background: deshabilitaInventario ? '#f1f5f9' : '#eef2ff', borderRadius: '4px', color: deshabilitaInventario ? '#64748b' : '#1e40af', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                    {deshabilitaInventario ? 'No aplica' : `${paquetesCompletos} Paq. ${piezasSueltas > 0 ? `+ ${piezasSueltas} pza(s)` : ''}`}
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label>Inventario Mínimo (Pzs):</label>
                                                <input 
                                                    type="number" 
                                                    step="1" 
                                                    name="invMinimo" 
                                                    disabled={deshabilitaInventario} 
                                                    value={deshabilitaInventario ? '0' : datosForm.invMinimo} 
                                                    onChange={handleInputChange} 
                                                />
                                            </div>

                                            <div className="form-group"><label>Puntos de Lealtad:</label><input type="number" name="puntosLealtad" value={datosForm.puntosLealtad} onChange={handleInputChange} /></div>
                                            <div className="form-group full-width"><label>Nota / Detalles del Paquete:</label><input type="text" name="notaPaquete" value={datosForm.notaPaquete} onChange={handleInputChange} /></div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="gp-footer">
                        <button type="button" className="btn-cancel" onClick={handleVolverAlCatalogo}>[ CANCELAR ]</button>
                        <button type="submit" className="btn-save">[ {datosForm.id ? 'ACTUALIZAR' : 'GUARDAR'} ]</button>
                    </div>
                </form>
            )}

            {/* MODAL EDITAR DEPARTAMENTO, CATEGORÍA O PROVEEDOR */}
            {modalEditCatalog && (
                <div className="gp-modal-overlay">
                    <div className="gp-modal">
                        <h3>Editar {modalEditCatalog.tipo.charAt(0).toUpperCase() + modalEditCatalog.tipo.slice(1)}</h3>
                        <form onSubmit={guardarEdicionCat}>
                            <div className="form-group">
                                <label>Nombre:</label>
                                <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required autoFocus />
                            </div>
                            {modalEditCatalog.tipo === 'proveedor' && (
                                <>
                                    <div className="form-group" style={{ marginTop: '10px' }}>
                                        <label>Teléfono:</label>
                                        <input type="text" value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ marginTop: '10px' }}>
                                        <label>Contacto:</label>
                                        <input type="text" value={editContacto} onChange={(e) => setEditContacto(e.target.value)} />
                                    </div>
                                </>
                            )}
                            <div className="gp-modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setModalEditCatalog(null)}>Cancelar</button>
                                <button type="submit" className="btn-save">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalTipo && (
                <div className="gp-modal-overlay">
                    <div className="gp-modal">
                        <h3>Agregar Nuevo {modalTipo === 'departamento' ? 'Departamento' : modalTipo === 'categoria' ? 'Categoría' : 'Proveedor'}</h3>
                        <form onSubmit={handleGuardarNuevoElemento}>
                            <div className="form-group"><label>Nombre:</label><input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required autoFocus/></div>
                            {modalTipo === 'proveedor' && (
                                <>
                                    <div className="form-group" style={{ marginTop: '10px' }}><label>Teléfono:</label><input type="text" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} /></div>
                                    <div className="form-group" style={{ marginTop: '10px' }}><label>Contacto:</label><input type="text" value={nuevoContacto} onChange={(e) => setNuevoContacto(e.target.value)} /></div>
                                </>
                            )}
                            <div className="gp-modal-actions">
                                <button type="button" className="btn-cancel" onClick={cerrarModal}>Cancelar</button>
                                <button type="submit" className="btn-save">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}