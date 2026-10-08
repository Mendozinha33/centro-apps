/* =====================================================================
   PDF A EXCEL
   Lee el texto de un PDF (con pdf.js), lo coloca en filas y columnas
   según su posición en la página y lo convierte en un .xlsx.
   Los números, importes, porcentajes y fechas se guardan como tales
   para que se puedan sumar en Excel.
   Todo ocurre en el navegador: el PDF no se sube a ningún sitio.
===================================================================== */
(function (raiz) {
'use strict';

/* ------------------------- entender cada valor ------------------------- */
function valorDe(texto){
  const t = texto.trim();
  if (!t) return null;
  // fechas 01/09/2026, 1-9-26
  let m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/.exec(t);
  if (m){
    let a = Number(m[3]); if (a < 100) a += a < 70 ? 2000 : 1900;
    const d = Number(m[1]), me = Number(m[2]);
    if (me >= 1 && me <= 12 && d >= 1 && d <= 31){
      return { t: 'n', v: Date.UTC(a, me - 1, d) / 86400000 + 25569, z: 'dd/mm/yyyy' };
    }
  }
  let s = t.replace(/\s/g, '');
  const euro = /€|EUR$/i.test(s); s = s.replace(/€|EUR$/i, '');
  const pct = /%$/.test(s); if (pct) s = s.slice(0, -1);
  let neg = false;
  if (/^\(.*\)$/.test(s)){ neg = true; s = s.slice(1, -1); }           // (12,50) = -12,50
  if (/-$/.test(s)){ neg = true; s = s.slice(0, -1); }                   // 12,50-  (como en las nóminas)
  // códigos que parecen números pero no lo son: 007, DNI, teléfonos, cuentas
  if (/^0\d/.test(s) || /^\d{9,}$/.test(s)) return { t: 's', v: t };
  let n = null, dec = 0;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)){ n = Number(s.replace(/\./g, '').replace(',', '.')); dec = (s.split(',')[1] || '').length; }
  else if (/^[-+]?\d{1,3}(,\d{3})+\.\d+$/.test(s)){ n = Number(s.replace(/,/g, '')); dec = s.split('.')[1].length; }
  else if (/^[-+]?\d+,\d+$/.test(s)){ n = Number(s.replace(',', '.')); dec = s.split(',')[1].length; }
  else if (/^[-+]?\d+\.\d{1,2}$/.test(s)){ n = Number(s); dec = s.split('.')[1].length; }
  else if (/^[-+]?\d+$/.test(s)){ n = Number(s); }
  if (n === null || !isFinite(n)) return { t: 's', v: t };
  if (neg) n = -n;
  if (pct) return { t: 'n', v: n / 100, z: dec ? '0.' + '0'.repeat(Math.min(dec, 4)) + '%' : '0%' };
  const base = dec ? '#,##0.' + '0'.repeat(Math.min(dec, 6)) : (euro || Math.abs(n) >= 1000 ? '#,##0' : 'General');
  return { t: 'n', v: n, z: euro ? (base === 'General' ? '#,##0' : base) + ' €' : base };
}

/* ------------------------- trozos de texto con su posición ------------------------- */
function trozosDePagina(items){
  // 1) cada fragmento con su caja
  const fr = [];
  for (const it of items){
    if (!it.str || !it.str.trim()) continue;
    const tr = it.transform;
    const alto = Math.abs(it.height || Math.hypot(tr[2], tr[3])) || 8;
    const x = tr[4], y = tr[5], ancho = Math.abs(it.width) || it.str.length * alto * 0.5;
    // un fragmento que lleva dentro varios espacios seguidos suele ser varias columnas
    const partes = it.str.split(/(\s{2,})/);
    if (partes.length > 1){
      const porLetra = ancho / Math.max(1, it.str.length);
      let pos = 0;
      for (const p of partes){
        if (p.trim() && !/^\s+$/.test(p)) fr.push({ x0: x + pos * porLetra, x1: x + (pos + p.length) * porLetra, y: y, alto: alto, txt: p });
        pos += p.length;
      }
    } else fr.push({ x0: x, x1: x + ancho, y: y, alto: alto, txt: it.str });
  }
  // 2) agrupar en líneas por su altura en la página
  fr.sort(function(a, b){ return b.y - a.y || a.x0 - b.x0; });
  const lineas = [];
  for (const f of fr){
    const l = lineas.length ? lineas[lineas.length - 1] : null;
    if (l && Math.abs(l.y - f.y) <= Math.max(2, Math.min(l.alto, f.alto) * 0.5)) { l.fr.push(f); l.alto = Math.max(l.alto, f.alto); }
    else lineas.push({ y: f.y, alto: f.alto, fr: [f] });
  }
  // 3) dentro de cada línea, juntar los fragmentos que van seguidos (palabras de una misma celda)
  for (const l of lineas){
    l.fr.sort(function(a, b){ return a.x0 - b.x0; });
    const celdas = [];
    for (const f of l.fr){
      const c = celdas.length ? celdas[celdas.length - 1] : null;
      const hueco = c ? f.x0 - c.x1 : Infinity;
      if (c && hueco < Math.max(l.alto * 0.55, 3)){
        c.txt += (hueco > l.alto * 0.12 && !/\s$/.test(c.txt) && !/^\s/.test(f.txt) ? ' ' : '') + f.txt;
        c.x1 = Math.max(c.x1, f.x1);
      } else celdas.push({ x0: f.x0, x1: f.x1, txt: f.txt });
    }
    l.celdas = celdas;
    delete l.fr;
  }
  return lineas;
}

/* ------------------------- columnas: huecos verticales que se repiten ------------------------- */
function columnas(lineas){
  const tabla = lineas.filter(function(l){ return l.celdas.length >= 2; });
  if (!tabla.length) return [];
  let min = Infinity, max = -Infinity;
  for (const l of tabla) for (const c of l.celdas){ min = Math.min(min, c.x0); max = Math.max(max, c.x1); }
  const ancho = Math.ceil(max - min) + 2;
  const cubre = new Int32Array(ancho);
  for (const l of tabla) for (const c of l.celdas){
    for (let x = Math.floor(c.x0 - min); x < Math.ceil(c.x1 - min); x++) cubre[x]++;
  }
  // se toleran unas pocas celdas que crucen un hueco (títulos que ocupan dos columnas)
  const tolera = Math.floor(tabla.length * 0.06);
  const cortes = [];
  let ini = -1;
  for (let x = 0; x <= ancho; x++){
    const libre = x < ancho && cubre[x] <= tolera;
    if (libre && ini < 0) ini = x;
    if (!libre && ini >= 0){
      if (x - ini >= 3 && ini > 0 && x < ancho) cortes.push(min + (ini + x) / 2);
      ini = -1;
    }
  }
  return cortes;
}
/* un título alineado a la izquierda y sus números alineados a la derecha pueden quedar en dos
   columnas distintas: si nunca coinciden en la misma fila y están pegadas, son la misma columna */
function unirColumnas(lineas, cortes){
  let cambio = true;
  while (cambio && cortes.length){
    cambio = false;
    const n = cortes.length + 1;
    const ext = []; for (let i = 0; i < n; i++) ext.push({ x0: Infinity, x1: -Infinity });
    const juntas = new Set();
    let alto = 0, nAlto = 0;
    for (const l of lineas){
      alto += l.alto; nAlto++;
      const usadas = new Set();
      for (const c of l.celdas){
        const k = columnaDe(cortes, c); usadas.add(k);
        ext[k].x0 = Math.min(ext[k].x0, c.x0); ext[k].x1 = Math.max(ext[k].x1, c.x1);
      }
      usadas.forEach(function(k){ if (usadas.has(k + 1)) juntas.add(k); });
    }
    const tipico = nAlto ? alto / nAlto : 10;
    for (let k = 0; k < n - 1; k++){
      if (juntas.has(k) || ext[k].x0 === Infinity || ext[k + 1].x0 === Infinity) continue;
      if (ext[k + 1].x0 - ext[k].x1 < tipico * 1.5){ cortes.splice(k, 1); cambio = true; break; }
    }
  }
  return cortes;
}
function columnaDe(cortes, c){
  let i = 0;
  while (i < cortes.length && c.x0 >= cortes[i] - 0.5) i++;
  return i;
}

/* ------------------------- de líneas a filas ------------------------- */
function aFilas(lineas, cortes){
  const filas = [];
  // separación normal entre líneas, para dejar una fila en blanco donde hay un hueco grande
  const saltos = [];
  for (let i = 1; i < lineas.length; i++) if (lineas[i].pagina === lineas[i - 1].pagina) saltos.push(lineas[i - 1].y - lineas[i].y);
  saltos.sort(function(a, b){ return a - b; });
  const normal = saltos.length ? saltos[Math.floor(saltos.length / 2)] : 0;
  lineas.forEach(function(l, i){
    const prev = lineas[i - 1];
    if (prev && prev.pagina === l.pagina && normal && prev.y - l.y > normal * 2.2 && filas.length && filas[filas.length - 1].length) filas.push([]);
    const fila = [];
    for (const c of l.celdas){
      const k = columnaDe(cortes, c);
      fila[k] = fila[k] ? fila[k] + ' ' + c.txt.trim() : c.txt.trim();
    }
    filas.push(fila);
  });
  return filas;
}

/* ------------------------- convertir ------------------------- */
async function leer(pdfjs, bytes, alProgreso){
  let doc;
  try { doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise; }
  catch (e){
    if (e && e.name === 'PasswordException') throw new Error('Este PDF tiene contraseña. Quítasela (ábrelo e imprímelo como PDF) y vuelve a probar.');
    throw new Error('Este archivo no se puede leer como PDF.');
  }
  const paginas = [];
  let letras = 0;
  for (let p = 1; p <= doc.numPages; p++){
    if (alProgreso) alProgreso(p, doc.numPages);
    const pag = await doc.getPage(p);
    const tc = await pag.getTextContent();
    const lineas = trozosDePagina(tc.items);
    lineas.forEach(function(l){ l.pagina = p; l.celdas.forEach(function(c){ letras += c.txt.trim().length; }); });
    paginas.push(lineas);
    pag.cleanup();
  }
  await doc.destroy();
  if (letras < 15) throw new Error('Este PDF es una foto o un escaneo: no lleva texto dentro, así que no se puede pasar a Excel. Si tienes el documento original (no escaneado), prueba con ese.');
  return paginas;
}

/* páginas leídas -> hojas listas: [{ nombre, filas: [[{t,v,z}|null]] }] */
function hojasDe(paginas, opciones){
  opciones = opciones || {};
  const grupos = opciones.unaHoja === false ? paginas.map(function(l, i){ return { nombre: 'Página ' + (i + 1), lineas: l }; })
                                            : [{ nombre: 'Hoja1', lineas: [].concat.apply([], paginas) }];
  return grupos.filter(function(g){ return g.lineas.length; }).map(function(g){
    const filas = aFilas(g.lineas, unirColumnas(g.lineas, columnas(g.lineas))).map(function(f){
      const out = []; for (let i = 0; i < f.length; i++) out.push(f[i] ? valorDe(f[i]) : null); return out;
    });
    return { nombre: g.nombre, filas: filas };
  });
}
async function convertir(pdfjs, bytes, opciones){
  return hojasDe(await leer(pdfjs, bytes, opciones && opciones.alProgreso), opciones);
}

/* hojas -> bytes de un .xlsx */
function aXlsx(XLSX, hojas){
  const wb = XLSX.utils.book_new();
  for (const h of hojas){
    const ws = XLSX.utils.aoa_to_sheet(h.filas.map(function(f){ return f.map(function(c){ return c || null; }); }), { cellDates: false });
    // anchura de cada columna según lo que lleva (los títulos sueltos no cuentan: en Excel se desbordan)
    const anchos = [];
    h.filas.forEach(function(f){
      const llenas = f.filter(function(c){ return c; }).length;
      f.forEach(function(c, i){
        if (!c || (llenas === 1 && c.t === 's' && String(c.v).length > 18)) return;
        let largo;
        if (c.t === 'n'){
          if (c.z === 'dd/mm/yyyy') largo = 10;
          else {
            const dec = (/\.(0+)/.exec(c.z || '') || ['', ''])[1].length;
            const ent = String(Math.floor(Math.abs(c.z && /%/.test(c.z) ? c.v * 100 : c.v))).length;
            largo = ent + Math.floor((ent - 1) / 3) + (dec ? dec + 1 : 0) + (/€/.test(c.z || '') ? 2 : 0) + (/%/.test(c.z || '') ? 1 : 0) + (c.v < 0 ? 1 : 0);
          }
        } else largo = String(c.v).length;
        anchos[i] = Math.max(anchos[i] || 8, Math.min(largo + 3, 50));
      });
    });
    ws['!cols'] = anchos.map(function(w){ return { wch: w || 8 }; });
    XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0, 31));
  }
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }));
}

const PdfAExcel = { leer: leer, hojasDe: hojasDe, convertir: convertir, aXlsx: aXlsx, valorDe: valorDe };
if (typeof module !== 'undefined' && module.exports) module.exports = PdfAExcel; else raiz.PdfAExcel = PdfAExcel;
})(typeof self !== 'undefined' ? self : this);
