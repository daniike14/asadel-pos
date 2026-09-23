import React, { useState, useEffect, useRef } from 'react';
import logoAsadel from '../assets/Logo.jpg';
import './GestionProductos.css';

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
};

const estadoInicialOpciones = {
    esServicio: false,
    esKit: false,
    aGranel: false,
    noInventariado: false,
};

export default function GestionProductos() {
    const busquedaInputRef = useRef(null);
    const fileInputRef = useRef(null);

    const [vista, setVista] = useState('catalogo'); // 'catalogo' | 'formulario' | 'promociones'
    const [pestanaActiva, setPestanaActiva] = useState('generales');

    const [departamentos, setDepartamentos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [promociones, setPromociones] = useState([]);

    const [nuevaPromoNombre, setNuevaPromoNombre] = useState('');
    const [nuevaPromoTipo, setNuevaPromoTipo] = useState('porcentaje');
    const [nuevaPromoValor, setNuevaPromoValor] = useState('');

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

    useEffect(() => {
        if (vista === 'catalogo' && busquedaInputRef.current) {
            setTimeout(() => busquedaInputRef.current?.focus(), 50);
        }
    }, [vista]);

    const cargarCatalogos = async () => {
        try {
            const [resDeptos, resCats, resProvs, resPromos] = await Promise.all([
                fetch('${API_URL}/api/departamentos'),
                fetch('${API_URL}/api/categorias'),
                fetch('${API_URL}/api/proveedores'),
                fetch('${API_URL}/api/promociones'),
            ]);

            if (resDeptos.ok) setDepartamentos(await resDeptos.json());
            if (resCats.ok) setCategorias(await resCats.json());
            if (resProvs.ok) setProveedores(await resProvs.json());
            if (resPromos.ok) setPromociones(await resPromos.json());
        } catch (err) {
            console.error('Error al cargar catálogos:', err);
        }
    };

    const cargarProductos = async () => {
        setCargando(true);
        try {
            const res = await fetch('${API_URL}/api/productos');
            if (res.ok) {
                const data = await res.json();
                setProductos(data);
            }
        } catch (err) {
            console.error('Error al cargar la lista de productos:', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarCatalogos();
        cargarProductos();
    }, []);

    const guardarPromocion = async (e) => {
        e.preventDefault();
        if (!nuevaPromoNombre.trim()) return alert('Escribe el nombre de la promoción.');

        try {
            const res = await fetch('${API_URL}/api/promociones', {
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
        });

        setOpciones({
            esServicio: Boolean(prod.esServicio),
            esKit: Boolean(prod.esKit),
            aGranel: Boolean(prod.aGranel),
            noInventariado: Boolean(prod.noInventariado),
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

    const handleOpcionChange = (key) => {
        setOpciones((prev) => ({ ...prev, [key]: !prev[key] }));
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
        const payload = { ...datosForm, ...opciones };
        const esEdicion = Boolean(datosForm.id);
        const url = esEdicion ? `${API_URL}/api/productos/${datosForm.id}` : '${API_URL}/api/productos';
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
        if (modalTipo === 'departamento') { url = '${API_URL}/api/departamentos'; body = { nombre: nuevoNombre }; }
        else if (modalTipo === 'categoria') { url = '${API_URL}api/categorias'; body = { nombre: nuevoNombre }; }
        else if (modalTipo === 'proveedor') { url = '${API_URL}/api/proveedores'; body = { nombre: nuevoNombre, telefono: nuevoTelefono, contacto: nuevoContacto }; }

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

    const pzsPorPaquete = parseInt(datosForm.piezasPorPaquete) || 1;
    const stockTotalPzs = parseInt(datosForm.invActual) || 0;
    const paquetesCompletos = Math.floor(stockTotalPzs / pzsPorPaquete);
    const piezasSueltas = stockTotalPzs % pzsPorPaquete;

    return (
        <div className="gp-container">
            <header className="gp-header">
                <div className="gp-branding">
                    <img src={logoAsadel} alt="Logo ASADEL" style={{ height: '35px' }} />
                    <h2>
                        {vista === 'catalogo' ? 'CATÁLOGO DE PRODUCTOS' : 
                         vista === 'promociones' ? 'GESTIÓN DE PROMOCIONES' : 
                         datosForm.id ? 'EDITAR PRODUCTO' : 'AGREGAR NUEVO PRODUCTO'}
                    </h2>
                </div>
                <div className="gp-header-actions">
                    {vista === 'catalogo' ? (
                        <>
                            <button className="btn-secondary" onClick={() => setVista('promociones')}>
                                🏷️ Promociones
                            </button>
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
                            <button className="btn-secondary" onClick={() => fileInputRef.current.click()}>⬆️ Importar</button>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv" onChange={handleImportarVacio} />
                            <button className="btn-secondary" onClick={handleExportarVacio}>⬇️ Exportar CSV</button>
                            <button className="btn-primary" onClick={handleNuevoProducto}>+ Agregar Producto</button>
                        </>
                    ) : (
                        <button className="btn-secondary" onClick={handleVolverAlCatalogo}>
                            ← Volver al Catálogo
                        </button>
                    )}
                </div>
            </header>

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
                                        const stock = parseInt(prod.invActual) || 0;
                                        const min = parseInt(prod.invMinimo) || 0;
                                        let badgeClass = 'badge-success'; let badgeText = 'Normal';
                                        if (stock <= 0) { badgeClass = 'badge-danger'; badgeText = 'Agotado'; } 
                                        else if (stock <= min) { badgeClass = 'badge-warning'; badgeText = 'Bajo Stock'; }

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
                                                    </td>
                                                )}
                                                {columnasVisibles.departamento && <td>{prod.departamento_nombre || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin asignación</span>}</td>}
                                                {columnasVisibles.categoria && <td>{prod.categoria_nombre || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin asignación</span>}</td>}
                                                {columnasVisibles.proveedor && <td>{prod.proveedor_nombre || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin asignación</span>}</td>}
                                                {columnasVisibles.costo && <td>${parseFloat(prod.costo || 0).toFixed(2)}</td>}
                                                {columnasVisibles.precio && <td><strong>${parseFloat(prod.precioVenta || 0).toFixed(2)}</strong></td>}
                                                {columnasVisibles.stock && <td>{prod.invActual || 0} pza(s)</td>}
                                                {columnasVisibles.estado && <td><span className={`badge ${badgeClass}`}>{badgeText}</span></td>}
                                                {columnasVisibles.acciones && (
                                                    <td className="col-actions">
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

                        <div className="gp-options-box">
                            <h4>Opciones Especiales:</h4>
                            <label className="checkbox-label"><input type="checkbox" checked={opciones.esServicio} onChange={() => handleOpcionChange('esServicio')} />Este producto es servicio</label>
                            <label className="checkbox-label"><input type="checkbox" checked={opciones.esKit} onChange={() => handleOpcionChange('esKit')} />Este producto es un Kit</label>
                            <label className="checkbox-label"><input type="checkbox" checked={opciones.aGranel} onChange={() => handleOpcionChange('aGranel')} />Se vende a granel</label>
                            <label className="checkbox-label"><input type="checkbox" checked={opciones.noInventariado} onChange={() => handleOpcionChange('noInventariado')} />Producto no inventariado</label>
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

                                    <div className="form-group"><label>Clave/Unidad:</label><input type="text" name="claveUnidad" value={datosForm.claveUnidad} onChange={handleInputChange} /></div>
                                    <div className="form-group"><label>Atributo (Color/Talla):</label><input type="text" name="atributoColor" value={datosForm.atributoColor} onChange={handleInputChange} /></div>
                                    <div className="form-group"><label>Departamento:</label><div className="select-with-btn"><select name="departamento" value={datosForm.departamento} onChange={handleInputChange}><option value="">-- Seleccionar --</option>{departamentos.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}</select><button type="button" className="btn-add-quick" onClick={() => setModalTipo('departamento')}>+</button></div></div>
                                    <div className="form-group"><label>Categoría:</label><div className="select-with-btn"><select name="categoria" value={datosForm.categoria} onChange={handleInputChange}><option value="">-- Seleccionar --</option>{categorias.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}</select><button type="button" className="btn-add-quick" onClick={() => setModalTipo('categoria')}>+</button></div></div>
                                    <div className="form-group full-width"><label>Proveedor:</label><div className="select-with-btn"><select name="proveedor" value={datosForm.proveedor} onChange={handleInputChange}><option value="">-- Seleccionar Proveedor --</option>{proveedores.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}</select><button type="button" className="btn-add-quick" onClick={() => setModalTipo('proveedor')}>+</button></div></div>
                                </div>
                            ) : (
                                <div className="gp-form-grid">
                                    <div className="form-group"><label>Costo por Paquete ($):</label><input type="number" step="0.01" name="costoPaquete" value={datosForm.costoPaquete} onChange={handlePrecioChange} /></div>
                                    <div className="form-group"><label>Pzs por Paquete:</label><input type="number" name="piezasPorPaquete" value={datosForm.piezasPorPaquete} onChange={handlePrecioChange} /></div>
                                    <div className="form-group"><label>Costo Unitario ($):</label><input type="number" step="0.01" name="costo" value={datosForm.costo} onChange={handlePrecioChange} /></div>
                                    <div className="form-group"><label>Ganancia Deseada (%):</label><input type="number" step="0.1" name="ganancia" value={datosForm.ganancia} onChange={handlePrecioChange} /></div>
                                    <div className="form-group"><label>Precio Venta Pza ($):</label><input type="number" step="0.01" name="precioVenta" value={datosForm.precioVenta} onChange={handlePrecioChange} /></div>
                                    <div className="form-group"><label>Precio Venta Paquete ($): <small style={{ fontWeight: 'normal', color: '#666' }}>(Opcional)</small></label><input type="number" step="0.01" name="precioVentaPaquete" value={datosForm.precioVentaPaquete} onChange={handleInputChange} /></div>
                                    <div className="form-group"><label>Stock Inicial (Pzs totales):</label><input type="number" name="invActual" value={datosForm.invActual} onChange={handleInputChange} /></div>
                                    <div className="form-group"><label>Equivalencia en Paquetes:</label><div style={{ padding: '8px 12px', background: '#eef2ff', borderRadius: '4px', color: '#1e40af', fontWeight: 'bold', fontSize: '0.9rem' }}>{paquetesCompletos} Paq. {piezasSueltas > 0 ? `+ ${piezasSueltas} pza(s)` : ''}</div></div>
                                    <div className="form-group"><label>Inventario Mínimo (Pzs):</label><input type="number" name="invMinimo" value={datosForm.invMinimo} onChange={handleInputChange} /></div>
                                    <div className="form-group"><label>Puntos de Lealtad:</label><input type="number" name="puntosLealtad" value={datosForm.puntosLealtad} onChange={handleInputChange} /></div>
                                    <div className="form-group full-width"><label>Nota / Detalles del Paquete:</label><input type="text" name="notaPaquete" value={datosForm.notaPaquete} onChange={handleInputChange} /></div>
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