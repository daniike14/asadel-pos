import * as pdfjsLib from 'pdfjs-dist';
import { API_URL } from '../config';
import { PDFDocument } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export function clasificarPorTarifas(porcentajeColor, porcentajeTotalTinta, reglas) {
  // Si la cobertura total es menor o igual a 0.20% (o 0%), es una hoja en blanco
  if (porcentajeTotalTinta <= 0.20) {
    return {
      esBlanca: true,
      tipo: 'negro',
      nombreTarifa: 'En blanco',
      precio: 0,
      porcentajeEvaluar: 0
    };
  }

  const esColor = porcentajeColor > 0.15;
  const listaReglas = esColor ? (reglas.color || []) : (reglas.negro || []);
  const porcentajeEvaluar = esColor ? porcentajeColor : porcentajeTotalTinta;

  for (const r of listaReglas) {
    if (porcentajeEvaluar <= r.hasta_porcentaje) {
      return {
        esBlanca: false,
        tipo: esColor ? 'color' : 'negro',
        nombreTarifa: r.nombre,
        precio: r.precio,
        porcentajeEvaluar: +porcentajeEvaluar.toFixed(2)
      };
    }
  }

  const ultima = listaReglas[listaReglas.length - 1];
  return {
    esBlanca: false,
    tipo: esColor ? 'color' : 'negro',
    nombreTarifa: ultima ? ultima.nombre : (esColor ? 'Pleno Color' : 'Pleno'),
    precio: ultima ? ultima.precio : (esColor ? 10.0 : 3.0),
    porcentajeEvaluar: +porcentajeEvaluar.toFixed(2)
  };
}

export function analizarCanvasColor(canvas, reglas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const totalPixelesHoja = canvas.width * canvas.height;
  let pixelesConTinta = 0;
  let pixelesColor = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Ignorar píxeles transparentes o fondo blanco de la hoja
    if (a < 50 || (r > 240 && g > 240 && b > 240)) {
      continue;
    }

    pixelesConTinta++;

    const maxCanal = Math.max(r, g, b);
    const minCanal = Math.min(r, g, b);
    const delta = maxCanal - minCanal;

    if (delta > 30) {
      pixelesColor++;
    }
  }

  const porcentajeColor = (pixelesColor / totalPixelesHoja) * 100;
  const porcentajeTotalTinta = (pixelesConTinta / totalPixelesHoja) * 100;

  return clasificarPorTarifas(porcentajeColor, porcentajeTotalTinta, reglas);
}

async function procesarPdfArrayBuffer(arrayBuffer, reglas) {
  const resultados = [];
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

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

    const clasificacion = analizarCanvasColor(canvas, reglas);

    // DESCARTAR HOJA EN BLANCO: no se agrega al listado
    if (clasificacion.esBlanca) {
      continue;
    }

    const miniatura = canvas.toDataURL('image/jpeg', 0.8);

    resultados.push({
      numeroPaginaOriginal: pageNum,
      tipo: clasificacion.tipo,
      nombreTarifa: clasificacion.nombreTarifa,
      precio: clasificacion.precio,
      porcentaje: clasificacion.porcentajeEvaluar,
      miniatura,
      seleccionada: true
    });
  }

  return resultados;
}

export async function procesarArchivoImpresion(file, reglas) {
  if (
    file.name.toLowerCase().endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const base64Data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    const res = await fetch(`${API_URL}/api/impresiones/convertir-docx-a-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreArchivo: file.name,
        base64Data
      })
    });

    if (!res.ok) throw new Error('Error al convertir DOCX a PDF');

    const { pdfBase64 } = await res.json();
    const binaryString = atob(pdfBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const paginas = await procesarPdfArrayBuffer(bytes.buffer, reglas);
    return { paginas, pdfArrayBuffer: bytes.buffer, pdfBase64 };
  }

  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const paginas = await procesarPdfArrayBuffer(arrayBuffer, reglas);
    return { paginas, pdfArrayBuffer: arrayBuffer, pdfBase64: null };
  }

  if (file.type.startsWith('image/')) {
    const imgUrl = URL.createObjectURL(file);
    const img = new Image();

    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = imgUrl;
    });

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const clasificacion = analizarCanvasColor(canvas, reglas);
    const miniatura = canvas.toDataURL('image/jpeg', 0.8);

    if (clasificacion.esBlanca) {
      return { paginas: [], pdfArrayBuffer: null, pdfBase64: null };
    }

    return {
      paginas: [{
        numeroPaginaOriginal: 1,
        tipo: clasificacion.tipo,
        nombreTarifa: clasificacion.nombreTarifa,
        precio: clasificacion.precio,
        porcentaje: clasificacion.porcentajeEvaluar,
        miniatura,
        seleccionada: true
      }],
      pdfArrayBuffer: null,
      pdfBase64: null
    };
  }

  return { paginas: [], pdfArrayBuffer: null, pdfBase64: null };
}

export function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK_SIZE, len)));
  }
  return btoa(binary);
}

export async function extraerPaginasPdf(arrayBufferOriginal, numerosPaginas) {
  const bufferClonado = arrayBufferOriginal.slice(0);
  const pdfOriginal = await PDFDocument.load(bufferClonado);
  const nuevoPdf = await PDFDocument.create();

  const indices = numerosPaginas.map(num => num - 1);
  const paginasCopiadas = await nuevoPdf.copyPages(pdfOriginal, indices);

  paginasCopiadas.forEach((pag) => nuevoPdf.addPage(pag));

  const bytesNuevoPdf = await nuevoPdf.save();
  return bytesNuevoPdf;
}

export async function ensamblarDocumentosMultiples(itemsParaEnsamblar) {
  const nuevoPdf = await PDFDocument.create();
  const mapaBuffers = new Map();

  for (const item of itemsParaEnsamblar) {
    if (!mapaBuffers.has(item.bufferOriginal)) {
      const docCargado = await PDFDocument.load(item.bufferOriginal.slice(0));
      mapaBuffers.set(item.bufferOriginal, docCargado);
    }

    const docOrigen = mapaBuffers.get(item.bufferOriginal);
    const [paginaCopiada] = await nuevoPdf.copyPages(docOrigen, [item.numeroPaginaOriginal - 1]);
    nuevoPdf.addPage(paginaCopiada);
  }

  const bytesNuevoPdf = await nuevoPdf.save();
  return bytesNuevoPdf;
}