import * as pdfjsLib from 'pdfjs-dist';
import { API_URL } from '../config';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Determina el precio y nombre según las reglas de CyberPlanet
 */
export function clasificarPorTarifas(porcentajeColor, porcentajeTotalTinta, reglas) {
  const esColor = porcentajeColor > 0.8;
  const listaReglas = esColor ? (reglas.color || []) : (reglas.negro || []);
  const porcentajeEvaluar = esColor ? porcentajeColor : porcentajeTotalTinta;

  // Buscar el primer tramo cuyo tope cubra el porcentaje evaluado
  for (const r of listaReglas) {
    if (porcentajeEvaluar <= r.hasta_porcentaje) {
      return {
        tipo: esColor ? 'color' : 'negro',
        nombreTarifa: r.nombre,
        precio: r.precio,
        porcentajeEvaluar: +porcentajeEvaluar.toFixed(1)
      };
    }
  }

  // Fallback si sobrepasa el último tramo
  const ultima = listaReglas[listaReglas.length - 1];
  return {
    tipo: esColor ? 'color' : 'negro',
    nombreTarifa: ultima ? ultima.nombre : (esColor ? 'Color Full' : 'Texto'),
    precio: ultima ? ultima.precio : (esColor ? 5.0 : 2.0),
    porcentajeEvaluar: +porcentajeEvaluar.toFixed(1)
  };
}

export function analizarCanvasColor(canvas, reglas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  let totalPixelesHoja = canvas.width * canvas.height;
  let pixelesConTinta = 0;
  let pixelesColor = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 50 || (r > 240 && g > 240 && b > 240)) {
      continue;
    }

    pixelesConTinta++;

    const maxCanal = Math.max(r, g, b);
    const minCanal = Math.min(r, g, b);
    const delta = maxCanal - minCanal;

    if (delta > 22) {
      pixelesColor++;
    }
  }

  const porcentajeColor = pixelesConTinta === 0 ? 0 : (pixelesColor / pixelesConTinta) * 100;
  const porcentajeTotalTinta = (pixelesConTinta / totalPixelesHoja) * 100;

  return clasificarPorTarifas(porcentajeColor, porcentajeTotalTinta, reglas);
}

async function procesarPdfArrayBuffer(arrayBuffer, reglas) {
  const resultados = [];
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
    const miniatura = canvas.toDataURL('image/jpeg', 0.8);

    resultados.push({
      numeroPagina: pageNum,
      tipo: clasificacion.tipo,
      nombreTarifa: clasificacion.nombreTarifa,
      precio: clasificacion.precio,
      porcentaje: clasificacion.porcentajeEvaluar,
      miniatura
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
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const paginas = await procesarPdfArrayBuffer(bytes.buffer, reglas);
    const nuevoBlobPdf = new Blob([bytes], { type: 'application/pdf' });

    return { paginas, archivoPdfParaImprimir: nuevoBlobPdf };
  }

  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const paginas = await procesarPdfArrayBuffer(arrayBuffer, reglas);
    return { paginas, archivoPdfParaImprimir: file };
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

    return {
      paginas: [{
        numeroPagina: 1,
        tipo: clasificacion.tipo,
        nombreTarifa: clasificacion.nombreTarifa,
        precio: clasificacion.precio,
        porcentaje: clasificacion.porcentajeEvaluar,
        miniatura
      }],
      archivoPdfParaImprimir: file
    };
  }

  return { paginas: [], archivoPdfParaImprimir: null };
}