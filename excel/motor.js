/* =====================================================================
   MOTOR DE MIS EXCEL
   Abre un Excel, deja verlo y cambiar celdas, recalcula las fórmulas y lo
   vuelve a guardar TOCANDO SOLO LAS CELDAS CAMBIADAS: todo lo demás del
   fichero (colores, gráficos, tablas, macros, filtros, comentarios...) se
   queda exactamente como estaba.

   Piezas de fuera (se cargan aparte): XLSX (SheetJS, para leer),
   HyperFormula (para recalcular) y fflate (para abrir y cerrar el .xlsx,
   que por dentro es un .zip). Funciona igual en el navegador y en las pruebas.
===================================================================== */
(function (raiz) {
'use strict';

let D = null;   // dependencias: { XLSX, HyperFormula, fflate, DOMParser, XMLSerializer }

/* ------------------------- nombres de fórmulas en español ------------------------- */
const MAPA_ES = {"ADDRESS":"DIRECCION","AND":"Y","ASIN":"ASENO","ASINH":"ASENOH","AVERAGE":"PROMEDIO","AVERAGEA":"PROMEDIOA","AVERAGEIF":"PROMEDIO.SI","BIN2DEC":"BIN.A.DEC","BIN2HEX":"BIN.A.HEX","BIN2OCT":"BIN.A.OCT","CEILING":"MULTIPLO.SUPERIOR","CHAR":"CARACTER","CHOOSE":"ELEGIR","CLEAN":"LIMPIAR","CODE":"CODIGO","COLUMN":"COLUMNA","COLUMNS":"COLUMNAS","CONCATENATE":"CONCATENAR","CORREL":"COEF.DE.CORREL","COUNT":"CONTAR","COUNTA":"CONTARA","COUNTBLANK":"CONTAR.BLANCO","COUNTIF":"CONTAR.SI","COUNTIFS":"CONTAR.SI.CONJUNTO","CUMIPMT":"PAGO.INT.ENTRE","CUMPRINC":"PAGO.PRINC.ENTRE","DATE":"FECHA","DATEVALUE":"FECHANUMERO","DAY":"DIA","DAYS360":"DIAS360","DAYS":"DÍAS","DAVERAGE":"BDPROMEDIO","DCOUNT":"BDCONTAR","DCOUNTA":"BDCONTARA","DGET":"BDEXTRAER","DMAX":"BDMAX","DMIN":"BDMIN","DPRODUCT":"BDPRODUCTO","DSTDEV":"BDDESVEST","DSTDEVP":"BDDESVESTP","DSUM":"BDSUMA","DVAR":"BDVAR","DVARP":"BDVARP","DEC2BIN":"DEC.A.BIN","DEC2HEX":"DEC.A.HEX","DEC2OCT":"DEC.A.OCT","DECIMAL":"CONV.DECIMAL","DEGREES":"GRADOS","DOLLARDE":"MONEDA.DEC","DOLLARFR":"MONEDA.FRAC","EDATE":"FECHA.MES","EFFECT":"INT.EFECTIVO","EOMONTH":"FIN.MES","ERF":"FUN.ERROR","ERFC":"FUN.ERROR.COMPL","EVEN":"REDONDEA.PAR","EXACT":"IGUAL","FALSE":"FALSO","FIND":"ENCONTRAR","FORMULATEXT":"FORMULATEXTO","FV":"VF","FVSCHEDULE":"VF.PLAN","HEX2BIN":"HEX.A.BIN","HEX2DEC":"HEX.A.DEC","HEX2OCT":"HEX.A.OCT","HLOOKUP":"BUSCARH","HOUR":"HORA","HYPERLINK":"HIPERVINCULO","IF":"SI","IFERROR":"SI.ERROR","IFS":"SI.CONJUNTO","INDEX":"INDICE","INT":"ENTERO","IPMT":"PAGOINT","IRR":"TIR","ISBLANK":"ESBLANCO","ISERR":"ESERR","ISERROR":"ESERROR","ISEVEN":"ES.PAR","ISLOGICAL":"ESLOGICO","ISNA":"ESNOD","ISNONTEXT":"ESNOTEXTO","ISNUMBER":"ESNUMERO","ISODD":"ES.IMPAR","ISPMT":"INT.PAGO.DIR","ISREF":"ESREF","ISTEXT":"ESTEXTO","LEFT":"IZQUIERDA","LEN":"LARGO","LOWER":"MINUSC","MATCH":"COINCIDIR","MAXIFS":"MAX.SI.CONJUNTO","MEDIAN":"MEDIANA","MID":"EXTRAE","MINIFS":"MIN.SI.CONJUNTO","MINUTE":"MINUTO","MIRR":"TIRM","MOD":"RESIDUO","MONTH":"MES","NA":"NOD","NETWORKDAYS":"DIAS.LAB","NETWORKDAYS.INTL":"DIAS.LAB.INTL","NOMINAL":"TASA.NOMINAL","NOT":"NO","NOW":"AHORA","NPV":"VNA","OCT2BIN":"OCT.A.BIN","OCT2DEC":"OCT.A.DEC","OCT2HEX":"OCT.A.HEX","ODD":"REDONDEA.IMPAR","OFFSET":"DESREF","OR":"O","PMT":"PAGO","PRODUCT":"PRODUCTO","POWER":"POTENCIA","PPMT":"PAGOPRIN","PROPER":"NOMPROPIO","PV":"VA","RADIANS":"RADIANES","RAND":"ALEATORIO","RATE":"TASA","REPLACE":"REEMPLAZAR","REPT":"REPETIR","RIGHT":"DERECHA","ROUND":"REDONDEAR","ROUNDDOWN":"REDONDEAR.MENOS","ROUNDUP":"REDONDEAR.MAS","ROW":"FILA","ROWS":"FILAS","SEARCH":"HALLAR","SECOND":"SEGUNDO","SEQUENCE":"SECUENCIA","SHEET":"HOJA","SHEETS":"HOJAS","SIN":"SENO","SINH":"SENOH","SORT":"ORDENAR","SQRT":"RAIZ","STDEVA":"DESVESTA","STDEV.P":"DESVEST.P","STDEVPA":"DESVESTPA","STDEV.S":"DESVEST.M","SUBSTITUTE":"SUSTITUIR","SUBTOTAL":"SUBTOTALES","SUM":"SUMA","SUMIF":"SUMAR.SI","SUMIFS":"SUMAR.SI.CONJUNTO","SUMPRODUCT":"SUMAPRODUCTO","SUMSQ":"SUMA.CUADRADOS","SWITCH":"","TBILLEQ":"LETRA.DE.TEST.EQV.A.BONO","TBILLPRICE":"LETRA.DE.TES.PRECIO","TBILLYIELD":"LETRA.DE.TES.RENDTO","TEXT":"TEXTO","TEXTJOIN":"UNIRCADENAS","TIME":"NSHORA","TIMEVALUE":"HORANUMERO","TODAY":"HOY","TRANSPOSE":"TRANSPONER","TRIM":"ESPACIOS","TRUE":"VERDADERO","TRUNC":"TRUNCAR","UNIQUE":"UNICOS","UPPER":"MAYUSC","VALUE":"VALOR","VLOOKUP":"BUSCARV","WEEKDAY":"DIASEM","WEEKNUM":"NUM.DE.SEMANA","WORKDAY":"DIA.LAB","WORKDAY.INTL":"DIA.LAB.INTL","XLOOKUP":"BUSCARX","XNPV":"VNA.NO.PER","XIRR":"TIR.NO.PER","YEAR":"AÑO","YEARFRAC":"FRAC.AÑO","ROMAN":"NUMERO.ROMANO","STDEV":"DESVEST","STDEVP":"DESVESTP","FACTDOUBLE":"FACT.DOBLE","COMBIN":"COMBINAT","GCD":"M.C.D","LCM":"M.C.M","MROUND":"REDOND.MULT","QUOTIENT":"COCIENTE","RANDBETWEEN":"ALEATORIO.ENTRE","SERIESSUM":"SUMA.SERIES","SIGN":"SIGNO","SQRTPI":"RAIZ2PI","SUMX2MY2":"SUMAX2MENOSY2","SUMX2PY2":"SUMAX2MASY2","SUMXMY2":"SUMAXMENOSY2","EXPON.DIST":"DISTR.EXP.N","EXPONDIST":"DISTR.EXP","FISHERINV":"PRUEBA.FISHER.INV","GAMMA.DIST":"DISTR.GAMMA.N","GAMMA.INV":"INV.GAMMA","GAMMADIST":"DISTR.GAMMA","GAMMAINV":"DISTR.GAMMA.INV","GAMMALN":"GAMMA.LN","GAMMALN.PRECISE":"GAMMA.LN.EXACTO","BETA.DIST":"DISTR.BETA.N","BETADIST":"DISTR.BETA","BETA.INV":"INV.BETA.N","BETAINV":"DISTR.BETA.INV","BINOM.DIST":"DISTR.BINOM.N","BINOMDIST":"DISTR.BINOM","BINOM.INV":"INV.BINOM","CHIDIST":"DISTR.CHI","CHIINV":"PRUEBA.CHI.INV","CHISQ.DIST":"DISTR.CHICUAD","CHISQ.DIST.RT":"DISTR.CHICUAD.CD","CHISQ.INV":"INV.CHICUAD","CHISQ.INV.RT":"INV.CHICUAD.CD","F.DIST":"DISTR.F.N","F.DIST.RT":"DISTR.F.CD","F.INV":"INV.F","F.INV.RT":"INV.F.CD","FDIST":"DISTR.F","FINV":"DISTR.F.INV","WEIBULL":"DIST.WEIBULL","WEIBULL.DIST":"DISTR.WEIBULL","HYPGEOM.DIST":"DISTR.HIPERGEOM.N","HYPGEOMDIST":"DISTR.HIPERGEOM","T.DIST":"DISTR.T.N","T.DIST.2T":"DISTR.T.2C","T.DIST.RT":"DISTR.T.CD","T.INV":"INV.T","T.INV.2T":"INV.T.2C","TDIST":"DISTR.T","TINV":"DISTR.T.INV","LOGINV":"DISTR.LOG.INV","LOGNORM.DIST":"DISTR.LOGNORM","LOGNORM.INV":"INV.LOGNORM","LOGNORMDIST":"DISTR.LOG.NORM","NORM.DIST":"DISTR.NORM.N","NORM.INV":"INV.NORM","NORM.S.DIST":"DISTR.NORM.ESTAND.N","NORM.S.INV":"INV.NORM.ESTAND","NORMDIST":"DISTR.NORM","NORMINV":"DISTR.NORM.INV","NORMSDIST":"DISTR.NORM.ESTAND","NORMSINV":"DISTR.NORM.ESTAND.INV","COMPLEX":"COMPLEJO","IMABS":"IM.ABS","IMAGINARY":"IMAGINARIO","IMARGUMENT":"IM.ANGULO","IMCONJUGATE":"IM.CONJUGADA","IMCOS":"IM.COS","IMDIV":"IM.DIV","IMEXP":"IM.EXP","IMLN":"IM.LN","IMLOG10":"IM.LOG10","IMLOG2":"IM.LOG2","IMPOWER":"IM.POT","IMPRODUCT":"IM.PRODUCT","IMREAL":"IM.REAL","IMSIN":"IM.SENO","IMSQRT":"IM.RAIZ2","IMSUB":"IM.SUSTR","IMSUM":"IM.SUM","LARGE":"K.ESIMO.MAYOR","SMALL":"K.ESIMO.MENOR","PERCENTILE":"PERCENTIL","PERCENTILE.INC":"PERCENTIL.INC","PERCENTILE.EXC":"PERCENTIL.EXC","QUARTILE":"CUARTIL","QUARTILE.INC":"CUARTIL.INC","QUARTILE.EXC":"CUARTIL.EXC","AVEDEV":"DESVPROM","CONFIDENCE":"INTERVALO.CONFIANZA","CONFIDENCE.NORM":"INTERVALO.CONFIANZA.NORM","CONFIDENCE.T":"INTERVALO.CONFIANZA.T","DEVSQ":"DESVIA2","GEOMEAN":"MEDIA.GEOM","HARMEAN":"MEDIA.ARMO","CRITBINOM":"BINOM.CRIT","RSQ":"COEFICIENTE.R2","STANDARDIZE":"NORMALIZACION","Z.TEST":"PRUEBA.Z.N","ZTEST":"PRUEBA.Z","F.TEST":"PRUEBA.F.N","FTEST":"PRUEBA.F","STEYX":"ERROR.TIPICO.XY","SLOPE":"PENDIENTE","COVARIANCE.S":"COVARIANZA.M","CHISQ.TEST":"PRUEBA.CHICUAD","CHITEST":"PRUEBA.CHI","T.TEST":"PRUEBA.T.N","TTEST":"PRUEBA.T","SKEW":"COEFICIENTE.ASIMETRIA","FLOOR":"MULTIPLO.INFERIOR"};
const MAPA_EN = {};
for (const k in MAPA_ES){ if (!/^HF\./.test(k)) MAPA_EN[MAPA_ES[k].toUpperCase()] = k; }
const ERRORES_ES = { '#DIV/0!':'#¡DIV/0!', '#N/A':'#N/D', '#NAME?':'#¿NOMBRE?', '#NUM!':'#¡NUM!',
  '#REF!':'#¡REF!', '#VALUE!':'#¡VALOR!', '#NULL!':'#¡NULO!', '#SPILL!':'#¡DESBORDAMIENTO!' };
const ERRORES_EN = {}; for (const k in ERRORES_ES) ERRORES_EN[ERRORES_ES[k]] = k;
// funciones nuevas que Excel guarda con el prefijo _xlfn.
const NUEVAS = new Set(['IFS','SWITCH','XLOOKUP','XMATCH','CONCAT','TEXTJOIN','MAXIFS','MINIFS','IFNA','FILTER',
  'SORT','SORTBY','UNIQUE','SEQUENCE','DAYS','ISOWEEKNUM','STDEV.S','STDEV.P','VAR.S','VAR.P','RANK.EQ','RANK.AVG',
  'PERCENTILE.INC','PERCENTILE.EXC','QUARTILE.INC','QUARTILE.EXC','MODE.SNGL','CEILING.MATH','FLOOR.MATH','LET',
  'NORM.DIST','NORM.INV','NORM.S.DIST','NETWORKDAYS.INTL','WORKDAY.INTL','XOR','IFERROR_NO']);

/* recorre una fórmula sin tocar lo que va entre comillas ("texto" o 'Nombre de hoja') */
function porTrozos(f, fn){
  let out = '', i = 0, codigo = '';
  while (i < f.length){
    const ch = f[i];
    if (ch === '"' || ch === "'"){
      out += fn(codigo); codigo = '';
      let j = i + 1;
      while (j < f.length){ if (f[j] === ch){ if (f[j+1] === ch){ j += 2; continue; } break; } j++; }
      out += f.slice(i, j + 1); i = j + 1;
    } else { codigo += ch; i++; }
  }
  return out + fn(codigo);
}
function aEspanol(f){
  return porTrozos(String(f), function(t){
    return t.replace(/(_xl(?:fn|ws)\.)?([A-Za-z_][A-Za-z0-9_.]*)(?=\s*\()|\b(TRUE|FALSE)\b(?!\s*[(!])|(\d+)\.(\d+)|,|(#[A-Z\/0!?]+[!?A]?)/g,
      function(m, pre, fun, bool, ent, dec, err){
        if (fun) return MAPA_ES[fun.toUpperCase()] || fun;
        if (bool) return MAPA_ES[bool] || bool;
        if (ent !== undefined) return ent + ',' + dec;
        if (m === ',') return ';';
        if (err) return ERRORES_ES[err] || err;
        return m;
      });
  });
}
function aIngles(f){
  f = String(f);
  let conPuntoYComa = false;
  porTrozos(f, function(t){ if (t.indexOf(';') >= 0) conPuntoYComa = true; return t; });
  return porTrozos(f, function(t){
    t = t.replace(/([\p{L}_][\p{L}\d_.]*)(?=\s*\()|\b(VERDADERO|FALSO)\b|(#[^\s,;()]+)/gu, function(m, fun, bool, err){
      if (fun){
        const en = MAPA_EN[fun.toUpperCase()] || fun.toUpperCase();
        return NUEVAS.has(en) ? '_xlfn.' + en : en;
      }
      if (bool) return bool === 'VERDADERO' ? 'TRUE' : 'FALSE';
      if (err) return ERRORES_EN[err] || err;
      return m;
    });
    // 0,21 es un número con decimales (salvo que la coma vaya tras una celda, como en A1,2)
    t = t.replace(/(^|[^A-Za-z0-9$_.:])(\d+),(\d+)(?![\d:])/g, '$1$2.$3');
    if (conPuntoYComa) t = t.replace(/;/g, ',');
    return t;
  });
}
function paraCalculo(f){ return String(f).replace(/_xl(?:fn|ws)\./g, ''); }

/* ------------------------- números y fechas a la española ------------------------- */
const ENTERO = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: false });
const DECIMAL = new Intl.NumberFormat('es-ES', { maximumSignificantDigits: 10, useGrouping: false });
// como el formato "General" de Excel: sin separador de miles y con unas 10 cifras como mucho
const GENERAL = { format: function(v){ return Number.isInteger(v) && Math.abs(v) < 1e15 ? ENTERO.format(v) : DECIMAL.format(v); } };
function esFormatoFecha(z){
  if (!z || z === 'General') return false;
  try { return D.XLSX.SSF.is_date(z); } catch (e) { return false; }
}
function formatoEspanol(z){
  // los formatos de fecha "cortos" de Excel se guardan al estilo de EE. UU.; en España se ven día/mes/año
  if (z === 'm/d/yy' || z === 'm/d/yyyy' || z === 'mm-dd-yy') return 'dd/mm/yyyy';
  if (z === 'm/d/yy h:mm') return 'dd/mm/yyyy h:mm';
  return z;
}
function numeroATexto(v, z){
  if (typeof v !== 'number' || !isFinite(v)) return String(v);
  if (!z || z === 'General' || z === '@') return GENERAL.format(v);
  const zz = formatoEspanol(z);
  let s;
  try { s = D.XLSX.SSF.format(zz, v); } catch (e) { return GENERAL.format(v); }
  if (esFormatoFecha(zz)) return s;
  // SheetJS pone los separadores al estilo inglés: 1,234.50 -> 1.234,50
  return s.replace(/\d[\d.,]*/g, function(m){ return m.replace(/[.,]/g, function(c){ return c === '.' ? ',' : '.'; }); });
}
function fechaASerie(d, m, a, hh, mm){
  const t = Date.UTC(a, m - 1, d, hh || 0, mm || 0);
  return t / 86400000 + 25569;
}

/* entiende lo que escribe la persona: número, fecha, porcentaje, sí/no o texto */
function interpretar(texto, z){
  const s = String(texto);
  const t = s.trim();
  if (t === '') return { vacia: true };
  if (t[0] === '=' && t.length > 1) return { formula: aIngles(t.slice(1)) };
  if (s[0] === "'") return { t: 's', v: s.slice(1) };
  if (/^(verdadero|falso)$/i.test(t)) return { t: 'b', v: /^v/i.test(t) };
  let m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(t);
  if (m){
    let a = Number(m[3]); if (a < 100) a += a < 70 ? 2000 : 1900;
    const d = Number(m[1]), me = Number(m[2]);
    if (me >= 1 && me <= 12 && d >= 1 && d <= 31){
      return { t: 'n', v: fechaASerie(d, me, a, Number(m[4] || 0), Number(m[5] || 0)), fecha: true, conHora: !!m[4] };
    }
  }
  let limpio = t.replace(/\s/g, '').replace(/€|EUR$/i, '');
  const pct = /%$/.test(limpio); if (pct) limpio = limpio.slice(0, -1);
  let n = null;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpio)) n = Number(limpio.replace(/\./g, '').replace(',', '.'));
  else if (/^[-+]?\d+(,\d+)?$/.test(limpio)) n = Number(limpio.replace(',', '.'));
  else if (/^[-+]?\d*\.\d+$/.test(limpio) || /^[-+]?\d+\.$/.test(limpio)) n = Number(limpio);
  else if (/^[-+]?\d+(\.\d+)?[eE][-+]?\d+$/.test(limpio)) n = Number(limpio);
  if (n !== null && isFinite(n)){
    if (pct) n = n / 100;
    return { t: 'n', v: n };
  }
  return { t: 's', v: s };
}

/* ------------------------- utilidades XML ------------------------- */
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const DEC = new TextDecoder('utf-8');
const ENC = new TextEncoder();
function leerXml(bytes){ return new D.DOMParser().parseFromString(DEC.decode(bytes), 'application/xml'); }
function escribirXml(doc){
  let s = new D.XMLSerializer().serializeToString(doc);
  if (!/^<\?xml/.test(s)) s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + s;
  return ENC.encode(s);
}
function hijos(el, nombre){
  const r = []; if (!el) return r;
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!nombre || n.localName === nombre)) r.push(n);
  return r;
}
function hijo(el, nombre){ return hijos(el, nombre)[0] || null; }
function nuevo(doc, padre, nombre){
  const ns = (padre && padre.namespaceURI) || NS;
  const pre = padre && padre.prefix;
  return doc.createElementNS(ns, pre ? pre + ':' + nombre : nombre);
}
function rutaJunta(base, rel){
  if (rel[0] === '/') return rel.slice(1);
  const p = base.split('/'); p.pop();
  for (const x of rel.split('/')){ if (x === '..') p.pop(); else if (x !== '.') p.push(x); }
  return p.join('/');
}
function relsDe(ruta){ const p = ruta.split('/'); const f = p.pop(); return p.concat('_rels', f + '.rels').join('/'); }
function leerRels(ficheros, ruta){
  const r = ficheros[relsDe(ruta)]; const out = {};
  if (!r) return out;
  for (const el of hijos(leerXml(r).documentElement, 'Relationship')){
    out[el.getAttribute('Id')] = { tipo: el.getAttribute('Type') || '', destino: rutaJunta(ruta, el.getAttribute('Target') || ''), el: el };
  }
  return out;
}

/* ------------------------- colores y estilos para pintar ------------------------- */
const INDEXADOS = ['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000',
  '00FF00','0000FF','FFFF00','FF00FF','00FFFF','800000','008000','000080','808000','800080','008080','C0C0C0','808080',
  '9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF','000080','FF00FF','FFFF00','00FFFF','800080',
  '800000','008080','0000FF','00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99','3366FF','33CCCC',
  '99CC00','FFCC00','FF9900','FF6600','666699','969696','003366','339966','003300','333300','993300','993366','333399','333333'];
function aplicarTinte(hex, tinte){
  if (!tinte) return hex;
  let r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b); let h = 0, s = 0, l = (max+min)/2;
  if (max !== min){ const d = max-min; s = l > .5 ? d/(2-max-min) : d/(max+min);
    h = max === r ? (g-b)/d + (g < b ? 6 : 0) : max === g ? (b-r)/d + 2 : (r-g)/d + 4; h /= 6; }
  l = tinte < 0 ? l * (1 + tinte) : l * (1 - tinte) + tinte;
  const f = function(p, q, t){ if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p+(q-p)*6*t; if (t < 1/2) return q;
    if (t < 2/3) return p+(q-p)*(2/3-t)*6; return p; };
  if (s === 0){ r = g = b = l; } else { const q = l < .5 ? l*(1+s) : l+s-l*s, p = 2*l-q; r = f(p,q,h+1/3); g = f(p,q,h); b = f(p,q,h-1/3); }
  return [r,g,b].map(function(x){ return Math.round(x*255).toString(16).padStart(2,'0'); }).join('').toUpperCase();
}
function colorDe(el, tema){
  if (!el) return null;
  let hex = null;
  if (el.getAttribute('rgb')) hex = el.getAttribute('rgb').slice(-6);
  else if (el.getAttribute('theme') !== null && el.getAttribute('theme') !== '') hex = tema[Number(el.getAttribute('theme'))] || null;
  else if (el.getAttribute('indexed')) hex = INDEXADOS[Number(el.getAttribute('indexed'))] || null;
  if (!hex) return null;
  return '#' + aplicarTinte(hex.toUpperCase(), Number(el.getAttribute('tint') || 0));
}
function leerTema(ficheros){
  const ruta = Object.keys(ficheros).filter(function(k){ return /^xl\/theme\/theme\d*\.xml$/.test(k); }).sort()[0];
  if (!ruta) return [];
  const doc = leerXml(ficheros[ruta]);
  const esq = doc.getElementsByTagNameNS('*', 'clrScheme')[0]; if (!esq) return [];
  const c = {};
  for (const el of hijos(esq)){
    const v = hijo(el, 'srgbClr') || hijo(el, 'sysClr');
    c[el.localName] = v ? (v.getAttribute('val') && v.localName === 'srgbClr' ? v.getAttribute('val') : (v.getAttribute('lastClr') || '000000')) : '000000';
  }
  return [c.lt1, c.dk1, c.lt2, c.dk2, c.accent1, c.accent2, c.accent3, c.accent4, c.accent5, c.accent6, c.hlink, c.folHlink];
}
function leerEstilos(ficheros){
  const doc = ficheros['xl/styles.xml'] ? leerXml(ficheros['xl/styles.xml']) : null;
  if (!doc) return [];
  const tema = leerTema(ficheros);
  const raizE = doc.documentElement;
  const fuentes = hijos(hijo(raizE, 'fonts'), 'font').map(function(f){
    const b = hijo(f, 'b'), i = hijo(f, 'i'), u = hijo(f, 'u');
    const on = function(x){ return x && x.getAttribute('val') !== '0' && x.getAttribute('val') !== 'false'; };
    return { b: on(b), i: on(i), u: on(u), color: colorDe(hijo(f, 'color'), tema) };
  });
  const rellenos = hijos(hijo(raizE, 'fills'), 'fill').map(function(f){
    const p = hijo(f, 'patternFill');
    if (!p || !p.getAttribute('patternType') || p.getAttribute('patternType') === 'none') return null;
    return colorDe(hijo(p, 'fgColor'), tema);
  });
  return hijos(hijo(raizE, 'cellXfs'), 'xf').map(function(x){
    const fu = fuentes[Number(x.getAttribute('fontId') || 0)] || {};
    const re = rellenos[Number(x.getAttribute('fillId') || 0)];
    const al = hijo(x, 'alignment');
    let css = '';
    if (fu.b) css += 'font-weight:600;';
    if (fu.i) css += 'font-style:italic;';
    if (fu.u) css += 'text-decoration:underline;';
    if (fu.color && fu.color !== '#000000') css += 'color:' + fu.color + ';';
    if (re) css += 'background:' + re + ';';
    const h = al && al.getAttribute('horizontal');
    const alin = (h === 'center' || h === 'centerContinuous') ? 'center' : h === 'right' ? 'right' : h === 'left' ? 'left' : '';
    return { css: css, alin: alin };
  });
}

/* ------------------------- el libro ------------------------- */
function Libro(){}

/* lo que se ve en una celda */
function textoDe(cel){
  if (!cel) return '';
  if (cel.crudo !== undefined) return cel.crudo;
  if (cel.t === 'e') return ERRORES_ES[cel.w] || ERRORES_ES[cel.v] || cel.w || '#¡ERROR!';
  if (cel.t === 'b') return cel.v ? 'VERDADERO' : 'FALSO';
  if (cel.t === 'n') return numeroATexto(cel.v, cel.z);
  if (cel.t === 's' || cel.t === 'str') return String(cel.v == null ? '' : cel.v);
  if (cel.t === 'd') return String(cel.w || cel.v);
  return '';
}
function editableDe(cel){
  if (!cel) return '';
  if (cel.crudo !== undefined) return cel.crudo;
  if (cel.f) return '=' + aEspanol(cel.f);
  if (cel.t === 'n'){
    if (esFormatoFecha(cel.z)) return numeroATexto(cel.v, /h/.test(cel.z) ? 'dd/mm/yyyy h:mm' : 'dd/mm/yyyy');
    if (cel.z && /%/.test(cel.z)) return GENERAL.format(cel.v * 100) + '%';
    return GENERAL.format(cel.v);
  }
  if (cel.t === 's' || cel.t === 'str'){
    const v = String(cel.v == null ? '' : cel.v);
    const r = interpretar(v);
    return (r.t !== 's' || v[0] === '=' || v[0] === "'") ? "'" + v : v;     // que un texto como "007" siga siendo texto
  }
  return textoDe(cel);
}

Libro.prototype.hoja = function(h){ return this.hojas[h]; };
Libro.prototype.celda = function(h, r, c){
  const hoja = this.hojas[h], dir = D.XLSX.utils.encode_cell({ r: r, c: c });
  const cel = hoja.ws[dir];
  const s = hoja.estilos ? hoja.estilos.get(dir) : 0;
  const e = (this.xfs && this.xfs[s || 0]) || null;
  let alin = e && e.alin;
  if (!alin && cel) alin = cel.t === 'n' ? 'right' : (cel.t === 'b' || cel.t === 'e') ? 'center' : '';
  return { texto: textoDe(cel), editar: editableDe(cel), css: e ? e.css : '', alin: alin || '',
           formula: !!(cel && cel.f), sinCalculo: !!(cel && cel.sinCalculo) };
};
Libro.prototype.porQueNoSePuede = function(h, r, c){
  if (!this.editable) return this.motivoSoloVer || 'Este fichero solo se puede ver.';
  const hoja = this.hojas[h];
  if (hoja.soloVer || (this.tipo !== 'csv' && !hoja.ruta)) return 'Esta hoja no se puede cambiar aquí.';
  if (hoja.protegida) return 'Esta hoja está protegida con contraseña en Excel; no se puede cambiar aquí.';
  const cel = hoja.ws[D.XLSX.utils.encode_cell({ r: r, c: c })];
  if (cel && cel.F) return 'Esta celda forma parte de una fórmula de matriz. Cámbiala en Excel.';
  return '';
};

/* ---------- recalcular ---------- */
function valorCalculo(cel){
  if (!cel) return null;
  if (cel.f) return '=' + paraCalculo(cel.f);
  if (cel.t === 'n' || cel.t === 'b') return cel.v;
  if (cel.t === 's' || cel.t === 'str'){ const v = String(cel.v); return v[0] === '=' ? "'" + v : v; }
  if (cel.t === 'e') return cel.w || cel.v || null;
  return null;
}
Libro.prototype.prepararCalculo = function(){
  if (this.hf !== undefined) return this.hf;
  this.hf = null;
  if (!D.HyperFormula || this.tipo === 'csv') return null;
  try {
    const datos = {};
    for (const hoja of this.hojas){
      const rango = hoja.ws['!ref'] ? D.XLSX.utils.decode_range(hoja.ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      const filas = [];
      for (let r = 0; r <= rango.e.r; r++){
        const fila = [];
        for (let c = 0; c <= rango.e.c; c++) fila.push(valorCalculo(hoja.ws[D.XLSX.utils.encode_cell({ r: r, c: c })]));
        filas.push(fila);
      }
      datos[hoja.nombre] = filas;
    }
    this.hf = D.HyperFormula.buildFromSheets(datos, { licenseKey: 'gpl-v3', smartRounding: true });
    for (const n of (this.nombres || [])){
      try { this.hf.addNamedExpression(n.Name, '=' + paraCalculo(n.Ref), n.Sheet != null ? this.hf.getSheetId(this.hojas[n.Sheet].nombre) : undefined); } catch (e) {}
    }
  } catch (e) { this.hf = null; }
  return this.hf;
};
// mete en la celda el resultado que da la calculadora; si no sabe calcularla, se queda el que traía de Excel
Libro.prototype.ponerResultado = function(cel, valor){
  const malo = valor && typeof valor === 'object' && valor.type;
  if (malo){
    if (valor.type === 'NAME' || valor.type === 'ERROR' || valor.type === 'CYCLE' || valor.type === 'SPILL'){
      cel.sinCalculo = true; return false;
    }
    const cod = { DIV_BY_ZERO:'#DIV/0!', NA:'#N/A', NUM:'#NUM!', REF:'#REF!', VALUE:'#VALUE!' }[valor.type] || '#VALUE!';
    cel.t = 'e'; cel.v = cod; cel.w = cod; delete cel.sinCalculo; return true;
  }
  delete cel.sinCalculo;
  if (valor === null || valor === undefined || valor === ''){ cel.t = 's'; cel.v = ''; }
  else if (typeof valor === 'number'){ cel.t = 'n'; cel.v = valor; }
  else if (typeof valor === 'boolean'){ cel.t = 'b'; cel.v = valor; }
  else { cel.t = 'str'; cel.v = String(valor); }
  delete cel.w; return true;
};
Libro.prototype.calcularPendientes = function(){
  // fórmulas sin resultado guardado (ficheros hechos con programas que no calculan)
  const faltan = [];
  this.hojas.forEach(function(hoja, h){
    for (const k in hoja.ws){ if (k[0] !== '!' && hoja.ws[k].f && (hoja.ws[k].t === 'z' || hoja.ws[k].v === undefined)) faltan.push([h, k]); }
  });
  if (!faltan.length || !this.prepararCalculo()) return;
  for (const p of faltan){
    const a = D.XLSX.utils.decode_cell(p[1]);
    try {
      if (this.ponerResultado(this.hojas[p[0]].ws[p[1]], this.hf.getCellValue({ sheet: this.hf.getSheetId(this.hojas[p[0]].nombre), row: a.r, col: a.c })))
        this.hojas[p[0]].resultados.add(p[1]);
    } catch (e) {}
  }
};

/* ---------- cambiar una celda ---------- */
Libro.prototype.cambiar = function(h, r, c, entrada, sinHistorial){
  const motivo = this.porQueNoSePuede(h, r, c);
  if (motivo) return { error: motivo };
  const hoja = this.hojas[h];
  this.prepararCalculo();            // la calculadora se monta con el libro tal como estaba antes del cambio
  const dir = D.XLSX.utils.encode_cell({ r: r, c: c });
  const antes = hoja.ws[dir] ? JSON.parse(JSON.stringify(hoja.ws[dir])) : null;
  let p = interpretar(entrada, antes && antes.z);
  if (this.tipo === 'csv'){
    // en un CSV no hay fórmulas ni formatos: se guarda lo escrito tal cual
    p = p.vacia ? p : (p.t === 'n' && !p.fecha) ? { t: 'n', v: p.v, crudo: String(entrada).trim() } : { t: 's', v: String(entrada) };
  }

  // la cabecera de una tabla de Excel tiene que tener un nombre, y no repetido
  const tabla = (hoja.tablas || []).filter(function(t){ return t.cabecera && t.rango.s.r === r && c >= t.rango.s.c && c <= t.rango.e.c; })[0];
  if (tabla){
    const nombre = p.vacia ? '' : (p.formula ? null : String(p.t === 'n' ? textoDe({ t: 'n', v: p.v }) : p.v).trim());
    if (!nombre) return { error: 'Esta celda es el título de una columna de una tabla de Excel: tiene que llevar un texto.' };
    for (let k = tabla.rango.s.c; k <= tabla.rango.e.c; k++){
      if (k !== c && textoDe(hoja.ws[D.XLSX.utils.encode_cell({ r: r, c: k })]).trim().toLowerCase() === nombre.toLowerCase())
        return { error: 'Esa tabla ya tiene otra columna llamada «' + nombre + '».' };
    }
  }

  let nueva = null;
  if (!p.vacia){
    nueva = { t: 's' };
    if (antes && antes.z) nueva.z = antes.z;
    if (p.formula){ nueva.f = p.formula; nueva.t = 'z'; }
    else { nueva.t = p.t; nueva.v = p.v; if (p.crudo !== undefined) nueva.crudo = p.crudo;
      if (tabla){ nueva.t = 's'; nueva.v = String(entrada).trim(); }
      if (p.fecha && !esFormatoFecha(nueva.z)){ nueva.z = p.conHora ? 'dd/mm/yyyy h:mm' : 'dd/mm/yyyy'; nueva.ponerFecha = nueva.z; }
      else if (p.t === 'n' && antes && antes.ponerFecha) nueva.ponerFecha = antes.ponerFecha;
    }
  }
  if (!sinHistorial) this.historial.push({ h: h, dir: dir, antes: antes, estabaCambiada: hoja.cambios.has(dir) });
  if (nueva) hoja.ws[dir] = nueva; else delete hoja.ws[dir];
  hoja.cambios.add(dir);
  hoja.resultados.delete(dir);
  if (nueva){
    const rango = hoja.ws['!ref'] ? D.XLSX.utils.decode_range(hoja.ws['!ref']) : { s: { r: r, c: c }, e: { r: r, c: c } };
    rango.s.r = Math.min(rango.s.r, r); rango.s.c = Math.min(rango.s.c, c);
    rango.e.r = Math.max(rango.e.r, r); rango.e.c = Math.max(rango.e.c, c);
    hoja.ws['!ref'] = D.XLSX.utils.encode_range(rango);
  }
  this.hayCambios = true;
  return { celdas: this.recalcular(h, r, c, nueva) };
};
Libro.prototype.recalcular = function(h, r, c, cel){
  const tocadas = [[h, r, c]];
  if (!this.prepararCalculo()){
    if (cel && cel.f){ cel.sinCalculo = true; }
    return tocadas;
  }
  const hf = this.hf, libro = this;
  try {
    const cambios = hf.setCellContents({ sheet: hf.getSheetId(this.hojas[h].nombre), row: r, col: c }, [[valorCalculo(cel)]]);
    for (const ch of cambios){
      if (!ch.address || ch.address.row === undefined) continue;
      const hi = libro.hojas.findIndex(function(x){ return hf.getSheetId(x.nombre) === ch.address.sheet; });
      if (hi < 0) continue;
      const d = D.XLSX.utils.encode_cell({ r: ch.address.row, c: ch.address.col });
      const otra = libro.hojas[hi].ws[d];
      if (!otra || !otra.f) continue;
      if (libro.ponerResultado(otra, ch.newValue) && !(hi === h && d === D.XLSX.utils.encode_cell({ r: r, c: c })))
        libro.hojas[hi].resultados.add(d);
      tocadas.push([hi, ch.address.row, ch.address.col]);
    }
  } catch (e) { if (cel && cel.f) cel.sinCalculo = true; }
  return tocadas;
};
Libro.prototype.deshacer = function(){
  const u = this.historial.pop();
  if (!u) return null;
  const hoja = this.hojas[u.h];
  if (u.antes) hoja.ws[u.dir] = u.antes; else delete hoja.ws[u.dir];
  if (!u.estabaCambiada) hoja.cambios.delete(u.dir);
  const a = D.XLSX.utils.decode_cell(u.dir);
  this.hayCambios = this.historial.length > 0 || this.hojas.some(function(x){ return x.cambios.size > 0; });
  return { h: u.h, celdas: this.recalcular(u.h, a.r, a.c, hoja.ws[u.dir]) };
};

/* =====================================================================
   GUARDAR un .xlsx: se abre el fichero original y solo se tocan las celdas cambiadas
===================================================================== */
function columnaDe(dir){ return D.XLSX.utils.decode_cell(dir).c; }

function prepararHoja(doc){
  const datos = doc.getElementsByTagNameNS('*', 'sheetData')[0];
  // pone el número de fila y la dirección de celda a quien no la tenga (casi nunca pasa)
  let rAnt = 0;
  const filas = new Map();
  for (const fila of hijos(datos, 'row')){
    let rn = Number(fila.getAttribute('r')); if (!rn){ rn = rAnt + 1; fila.setAttribute('r', String(rn)); }
    rAnt = rn; filas.set(rn, fila);
    let cAnt = -1;
    for (const c of hijos(fila, 'c')){
      let ci; if (c.getAttribute('r')) ci = columnaDe(c.getAttribute('r'));
      else { ci = cAnt + 1; c.setAttribute('r', D.XLSX.utils.encode_cell({ r: rn - 1, c: ci })); }
      cAnt = ci;
    }
  }
  return { datos: datos, filas: filas };
}
function buscarFila(doc, pre, rn, crear){
  let fila = pre.filas.get(rn);
  if (fila || !crear) return fila || null;
  fila = nuevo(doc, pre.datos, 'row'); fila.setAttribute('r', String(rn));
  let sig = null;
  for (const f of hijos(pre.datos, 'row')){ if (Number(f.getAttribute('r')) > rn){ sig = f; break; } }
  pre.datos.insertBefore(fila, sig); pre.filas.set(rn, fila);
  return fila;
}
function buscarCelda(doc, fila, dir, crear){
  const ci = columnaDe(dir); let sig = null;
  for (const c of hijos(fila, 'c')){
    const k = columnaDe(c.getAttribute('r'));
    if (k === ci) return c;
    if (k > ci){ sig = c; break; }
  }
  if (!crear) return null;
  const c = nuevo(doc, fila, 'c'); c.setAttribute('r', dir);
  fila.insertBefore(c, sig);
  fila.removeAttribute('spans');
  return c;
}
function quitarHijos(el, menos){
  for (const h of hijos(el)) if (!menos || h.localName !== menos) el.removeChild(h);
}
function ponerValor(doc, c, cel, conFormula){
  c.removeAttribute('t');
  if (cel.t === 'n'){ const v = nuevo(doc, c, 'v'); v.textContent = String(cel.v); c.appendChild(v); }
  else if (cel.t === 'b'){ c.setAttribute('t', 'b'); const v = nuevo(doc, c, 'v'); v.textContent = cel.v ? '1' : '0'; c.appendChild(v); }
  else if (cel.t === 'e'){ c.setAttribute('t', 'e'); const v = nuevo(doc, c, 'v'); v.textContent = String(cel.w || cel.v); c.appendChild(v); }
  else if ((cel.t === 's' || cel.t === 'str') && conFormula){ c.setAttribute('t', 'str'); const v = nuevo(doc, c, 'v'); v.textContent = String(cel.v); c.appendChild(v); }
  else if (cel.t === 's' || cel.t === 'str'){
    c.setAttribute('t', 'inlineStr');
    const is = nuevo(doc, c, 'is'), t = nuevo(doc, is, 't');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = String(cel.v); is.appendChild(t); c.appendChild(is);
  }
}
/* si la celda era la "madre" de una fórmula compartida, sus hijas pasan a llevar su propia fórmula */
function soltarCompartida(c, hoja, celdasXml){
  const f = hijo(c, 'f');
  if (!f || f.getAttribute('t') !== 'shared' || !f.getAttribute('ref')) return;
  const si = f.getAttribute('si');
  for (const otra of celdasXml){
    if (otra === c) continue;
    const g = hijo(otra, 'f');
    if (!g || g.getAttribute('t') !== 'shared' || g.getAttribute('si') !== si) continue;
    const cel = hoja.original[otra.getAttribute('r')] || hoja.ws[otra.getAttribute('r')];
    g.removeAttribute('t'); g.removeAttribute('si'); g.removeAttribute('ref');
    g.textContent = cel && cel.f ? cel.f : '';
  }
}

Libro.prototype.guardar = function(){
  if (this.tipo === 'csv') return this.guardarCsv();
  const F = this.ficheros, libro = this;
  const fechaXf = {};
  let estilosDoc = null, cellXfs = null;
  const xfConFecha = function(s, formato){
    const clave = s + '|' + formato;
    if (fechaXf[clave] !== undefined) return fechaXf[clave];
    if (!estilosDoc){ estilosDoc = leerXml(F['xl/styles.xml']); cellXfs = hijo(estilosDoc.documentElement, 'cellXfs'); }
    const xfs = hijos(cellXfs, 'xf');
    const base = xfs[s] || xfs[0];
    const copia = base.cloneNode(true);
    copia.setAttribute('numFmtId', formato.indexOf('h') >= 0 ? '22' : '14');
    copia.setAttribute('applyNumberFormat', '1');
    cellXfs.appendChild(copia);
    cellXfs.setAttribute('count', String(xfs.length + 1));
    return (fechaXf[clave] = xfs.length);
  };

  for (const hoja of this.hojas){
    if (!hoja.cambios.size && !hoja.resultados.size) continue;
    const doc = leerXml(F[hoja.ruta]);
    const pre = prepararHoja(doc);
    let celdasXml = null;
    const todas = function(){ return celdasXml || (celdasXml = Array.prototype.slice.call(doc.getElementsByTagNameNS('*', 'c'))); };
    const estiloCol = {};
    const cols = doc.getElementsByTagNameNS('*', 'col');
    for (let i = 0; i < cols.length; i++){
      const st = cols[i].getAttribute('style'); if (!st) continue;
      for (let k = Number(cols[i].getAttribute('min')); k <= Number(cols[i].getAttribute('max')); k++) estiloCol[k - 1] = st;
    }

    for (const dir of hoja.cambios){
      const cel = hoja.ws[dir];
      const a = D.XLSX.utils.decode_cell(dir);
      const fila = buscarFila(doc, pre, a.r + 1, !!cel);
      if (!fila) continue;
      let c = buscarCelda(doc, fila, dir, !!cel);
      if (!c) continue;
      if (hijo(c, 'f')) soltarCompartida(c, hoja, todas());
      quitarHijos(c);
      if (!c.getAttribute('s')){
        if (fila.getAttribute('customFormat') === '1' && fila.getAttribute('s')) c.setAttribute('s', fila.getAttribute('s'));
        else if (estiloCol[a.c]) c.setAttribute('s', estiloCol[a.c]);
      }
      if (!cel){
        c.removeAttribute('t');
        if (!c.getAttribute('s')) fila.removeChild(c);
        continue;
      }
      if (cel.ponerFecha){
        const s = Number(c.getAttribute('s') || 0);
        c.setAttribute('s', String(xfConFecha(s, cel.ponerFecha)));
      }
      if (cel.f){
        const f = nuevo(doc, c, 'f'); f.textContent = cel.f; c.appendChild(f);
        if (cel.t !== 'z' && !cel.sinCalculo) ponerValor(doc, c, cel, true);
      } else ponerValor(doc, c, cel, false);
      fila.removeAttribute('spans');
    }

    for (const dir of hoja.resultados){
      if (hoja.cambios.has(dir)) continue;
      const cel = hoja.ws[dir]; if (!cel || !cel.f || cel.sinCalculo) continue;
      const a = D.XLSX.utils.decode_cell(dir);
      const fila = buscarFila(doc, pre, a.r + 1, false); if (!fila) continue;
      const c = buscarCelda(doc, fila, dir, false); if (!c || !hijo(c, 'f')) continue;
      quitarHijos(c, 'f');
      ponerValor(doc, c, cel, true);
    }

    const dim = doc.getElementsByTagNameNS('*', 'dimension')[0];
    if (dim && hoja.ws['!ref']) dim.setAttribute('ref', hoja.ws['!ref']);
    F[hoja.ruta] = escribirXml(doc);

    // títulos de columna de las tablas de Excel
    for (const t of hoja.tablas){
      if (!t.cabecera) continue;
      let tocada = false;
      for (let k = t.rango.s.c; k <= t.rango.e.c; k++) if (hoja.cambios.has(D.XLSX.utils.encode_cell({ r: t.rango.s.r, c: k }))) tocada = true;
      if (!tocada) continue;
      const tdoc = leerXml(F[t.ruta]);
      const colsT = hijos(tdoc.getElementsByTagNameNS('*', 'tableColumns')[0], 'tableColumn');
      colsT.forEach(function(col, i){
        const cel = hoja.ws[D.XLSX.utils.encode_cell({ r: t.rango.s.r, c: t.rango.s.c + i })];
        if (cel) col.setAttribute('name', textoDe(cel));
      });
      F[t.ruta] = escribirXml(tdoc);
    }
  }
  if (estilosDoc) F['xl/styles.xml'] = escribirXml(estilosDoc);

  // que Excel lo recalcule todo al abrirlo, y fuera la cadena de cálculo vieja (si no, Excel "repara" el fichero)
  const wbDoc = leerXml(F[this.rutaLibro]);
  let calc = wbDoc.getElementsByTagNameNS('*', 'calcPr')[0];
  if (!calc){
    calc = nuevo(wbDoc, wbDoc.documentElement, 'calcPr');
    // en su sitio: justo después de <definedNames>, <externalReferences>, <functionGroups> o <sheets>
    const tras = hijo(wbDoc.documentElement, 'definedNames') || hijo(wbDoc.documentElement, 'externalReferences')
              || hijo(wbDoc.documentElement, 'functionGroups') || hijo(wbDoc.documentElement, 'sheets');
    wbDoc.documentElement.insertBefore(calc, tras ? tras.nextSibling : null);
  }
  calc.setAttribute('fullCalcOnLoad', '1');
  F[this.rutaLibro] = escribirXml(wbDoc);
  if (F['xl/calcChain.xml']){
    delete F['xl/calcChain.xml'];
    const rr = relsDe(this.rutaLibro);
    if (F[rr]){
      const rdoc = leerXml(F[rr]);
      for (const el of hijos(rdoc.documentElement, 'Relationship')) if (/calcChain$/.test(el.getAttribute('Type') || '')) rdoc.documentElement.removeChild(el);
      F[rr] = escribirXml(rdoc);
    }
    const ct = leerXml(F['[Content_Types].xml']);
    for (const el of hijos(ct.documentElement, 'Override')) if (/calcChain\.xml$/.test(el.getAttribute('PartName') || '')) ct.documentElement.removeChild(el);
    F['[Content_Types].xml'] = escribirXml(ct);
  }
  const salida = D.fflate.zipSync(F, { level: 6 });
  // a partir de aquí, lo guardado es el nuevo punto de partida
  this.hojas.forEach(function(h){
    h.cambios.clear(); h.resultados.clear();
    for (const k in h.ws) if (k[0] !== '!' && h.ws[k].ponerFecha) delete h.ws[k].ponerFecha;
    h.original = JSON.parse(JSON.stringify(h.ws));
  });
  libro.historial = []; libro.hayCambios = false;
  return salida;
};

/* =====================================================================
   CSV: texto separado por ; o por , (lo que use el fichero)
===================================================================== */
const CP1252 = { 0x20AC:0x80, 0x201A:0x82, 0x0192:0x83, 0x201E:0x84, 0x2026:0x85, 0x2020:0x86, 0x2021:0x87, 0x02C6:0x88,
  0x2030:0x89, 0x0160:0x8A, 0x2039:0x8B, 0x0152:0x8C, 0x017D:0x8E, 0x2018:0x91, 0x2019:0x92, 0x201C:0x93, 0x201D:0x94,
  0x2022:0x95, 0x2013:0x96, 0x2014:0x97, 0x02DC:0x98, 0x2122:0x99, 0x0161:0x9A, 0x203A:0x9B, 0x0153:0x9C, 0x017E:0x9E, 0x0178:0x9F };
function leerCsv(bytes){
  let bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
  let texto, codif = 'utf-8';
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(bom ? bytes.subarray(3) : bytes); }
  catch (e){ texto = new TextDecoder('windows-1252').decode(bytes); codif = 'windows-1252'; bom = false; }
  const fin = /\r\n/.test(texto) ? '\r\n' : '\n';
  const primera = texto.split(/\r?\n/)[0] || '';
  const contar = function(ch){ let n = 0, dentro = false; for (const x of primera){ if (x === '"') dentro = !dentro; else if (x === ch && !dentro) n++; } return n; };
  const sep = [';', ',', '\t'].sort(function(a, b){ return contar(b) - contar(a); })[0];
  const filas = []; let fila = [], campo = '', dentro = false, i = 0;
  while (i < texto.length){
    const ch = texto[i];
    if (dentro){
      if (ch === '"'){ if (texto[i+1] === '"'){ campo += '"'; i += 2; continue; } dentro = false; i++; continue; }
      campo += ch; i++; continue;
    }
    if (ch === '"'){ dentro = true; i++; continue; }
    if (ch === sep){ fila.push(campo); campo = ''; i++; continue; }
    if (ch === '\r' && texto[i+1] === '\n'){ i++; continue; }
    if (ch === '\n'){ fila.push(campo); filas.push(fila); fila = []; campo = ''; i++; continue; }
    campo += ch; i++;
  }
  const terminaEnSalto = /\n$/.test(texto);
  if (campo !== '' || fila.length || !terminaEnSalto && texto.length) { fila.push(campo); filas.push(fila); }
  return { filas: filas, sep: sep, fin: fin, bom: bom, codif: codif, terminaEnSalto: terminaEnSalto };
}
Libro.prototype.guardarCsv = function(){
  const ws = this.hojas[0].ws, csv = this.csv;
  const rango = ws['!ref'] ? D.XLSX.utils.decode_range(ws['!ref']) : { e: { r: -1, c: -1 } };
  const lineas = [];
  for (let r = 0; r <= rango.e.r; r++){
    let ultima = -1; const campos = [];
    for (let c = 0; c <= rango.e.c; c++){
      const cel = ws[D.XLSX.utils.encode_cell({ r: r, c: c })];
      const v = cel ? (cel.crudo !== undefined ? cel.crudo : (cel.t === 'n' ? editableDe(cel) : String(cel.v == null ? '' : cel.v))) : '';
      if (v !== '') ultima = c;
      campos.push(v);
    }
    const anchura = Math.max(ultima + 1, (csv.anchos[r] || 0));
    lineas.push(campos.slice(0, anchura).map(function(v){
      return /["\r\n]/.test(v) || v.indexOf(csv.sep) >= 0 ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(csv.sep));
  }
  const texto = lineas.join(csv.fin) + (csv.terminaEnSalto ? csv.fin : '');
  let bytes;
  if (csv.codif === 'windows-1252'){
    bytes = new Uint8Array(texto.length);
    for (let i = 0; i < texto.length; i++){ const k = texto.charCodeAt(i); bytes[i] = k < 256 ? k : (CP1252[k] || 0x3F); }
  } else {
    const cuerpo = ENC.encode(texto);
    bytes = csv.bom ? new Uint8Array(cuerpo.length + 3) : cuerpo;
    if (csv.bom){ bytes.set([0xEF, 0xBB, 0xBF]); bytes.set(cuerpo, 3); }
  }
  this.hojas[0].cambios.clear(); this.historial = []; this.hayCambios = false;
  return bytes;
};

/* =====================================================================
   ABRIR
===================================================================== */
function preparar(dep){ D = dep; }

function abrir(bytes, tipo){
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const libro = new Libro();
  libro.tipo = tipo; libro.historial = []; libro.hayCambios = false; libro.editable = true;

  if (tipo === 'csv'){
    const csv = leerCsv(bytes);
    csv.anchos = csv.filas.map(function(f){ return f.length; });
    libro.csv = csv;
    const ws = {}; let maxC = 0;
    csv.filas.forEach(function(f, r){
      f.forEach(function(v, c){
        if (v === '') return;
        maxC = Math.max(maxC, c);
        // en un CSV todo es texto; los números se reconocen para alinearlos y que se puedan calcular
        const p = interpretar(v);
        ws[D.XLSX.utils.encode_cell({ r: r, c: c })] = (p.t === 'n' && !p.fecha && /^[-+]?[\d.,]+$/.test(v.trim())) ? { t: 'n', v: p.v, crudo: v } : { t: 's', v: v };
      });
    });
    if (csv.filas.length) ws['!ref'] = D.XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: csv.filas.length - 1, c: maxC } });
    libro.hojas = [{ nombre: 'Hoja1', ws: ws, cambios: new Set(), resultados: new Set(), tablas: [], fusiones: [], columnas: [] }];
    libro.xfs = null;
    return libro;
  }

  const wb = D.XLSX.read(bytes, { type: 'array', cellFormula: true, cellNF: true, cellStyles: true, cellDates: false, sheetStubs: false });
  libro.nombres = (wb.Workbook && wb.Workbook.Names || []).filter(function(n){ return n.Name && n.Ref && !/^_xlnm\./.test(n.Name); });
  const visibles = (wb.Workbook && wb.Workbook.Sheets) || [];

  libro.hojas = wb.SheetNames.map(function(nombre, i){
    const ws = wb.Sheets[nombre] || {};
    for (const k in ws){ if (k[0] !== '!' && ws[k].t === 's' && ws[k].f){ ws[k].t = 'str'; } }
    return { nombre: nombre, ws: ws, cambios: new Set(), resultados: new Set(), tablas: [],
             oculta: visibles[i] && visibles[i].Hidden ? visibles[i].Hidden : 0,
             fusiones: ws['!merges'] || [],
             columnas: (ws['!cols'] || []).map(function(c){ return c ? { px: c.wpx || (c.wch ? Math.round(c.wch * 7 + 5) : (c.width ? Math.round(c.width * 7 + 5) : 0)), oculta: !!c.hidden } : null; }),
             filasOcultas: (ws['!rows'] || []).map(function(r){ return !!(r && r.hidden); }) };
  });

  if (tipo === 'xls'){
    libro.editable = false;
    libro.motivoSoloVer = 'Los Excel antiguos (.xls) se pueden ver aquí, pero para cambiarlos hay que descargarlos, editarlos en Excel y volver a subirlos.';
    libro.xfs = null;
    return libro;
  }

  /* .xlsx / .xlsm: se guarda el fichero tal cual, abierto, para poder cambiar solo lo necesario */
  const F = D.fflate.unzipSync(bytes);
  libro.ficheros = F;
  const ct = DEC.decode(F['[Content_Types].xml'] || new Uint8Array());
  const m = /PartName="\/([^"]+)"[^>]*ContentType="application\/vnd\.(?:ms-excel\.sheet\.macroEnabled|openxmlformats-officedocument\.spreadsheetml\.sheet)\.main\+xml"/.exec(ct)
         || /ContentType="application\/vnd\.(?:ms-excel\.sheet\.macroEnabled|openxmlformats-officedocument\.spreadsheetml\.sheet)\.main\+xml"[^>]*PartName="\/([^"]+)"/.exec(ct);
  libro.rutaLibro = m ? m[1] : 'xl/workbook.xml';
  const rels = leerRels(F, libro.rutaLibro);
  const wbDoc = leerXml(F[libro.rutaLibro]);
  const hojasXml = hijos(hijo(wbDoc.documentElement, 'sheets'), 'sheet');
  hojasXml.forEach(function(el, i){
    const hoja = libro.hojas[i]; if (!hoja) return;
    const rid = el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || el.getAttribute('r:id');
    const rel = rels[rid];
    if (!rel || !F[rel.destino]){ hoja.soloVer = true; return; }
    hoja.ruta = rel.destino;
    const xml = DEC.decode(F[rel.destino]);
    if (!/<(?:\w+:)?sheetData\b/.test(xml)){ hoja.soloVer = true; return; }      // hoja de gráfico u otra cosa
    hoja.protegida = /<(?:\w+:)?sheetProtection\b[^>]*\bsheet="(?:1|true)"/.test(xml);
    // el estilo de cada celda (negrita, colores...) para pintarla parecida a Excel
    const est = new Map();
    const re = /<(?:\w+:)?c\b([^>]*)>|<(?:\w+:)?c\b([^>]*)\/>/g; let x;
    while ((x = re.exec(xml))){
      const at = x[1] || x[2] || '';
      const s = /\bs="(\d+)"/.exec(at), r = /\br="([A-Z]+\d+)"/.exec(at);
      if (s && r && s[1] !== '0') est.set(r[1], Number(s[1]));
    }
    hoja.estilos = est;
    // tablas de Excel de esta hoja
    const hr = leerRels(F, rel.destino);
    for (const k in hr){
      if (!/\/table$/.test(hr[k].tipo) || !F[hr[k].destino]) continue;
      const t = leerXml(F[hr[k].destino]).documentElement;
      hoja.tablas.push({ ruta: hr[k].destino, rango: D.XLSX.utils.decode_range(t.getAttribute('ref')),
                         cabecera: t.getAttribute('headerRowCount') !== '0' });
    }
    hoja.original = JSON.parse(JSON.stringify(hoja.ws));
  });
  libro.hojas.forEach(function(h){ if (!h.ruta) h.soloVer = true; });
  libro.xfs = leerEstilos(F);
  libro.calcularPendientes();
  return libro;
}

const MotorExcel = { preparar: preparar, abrir: abrir, aEspanol: aEspanol, aIngles: aIngles, interpretar: interpretar };
if (typeof module !== 'undefined' && module.exports) module.exports = MotorExcel; else raiz.MotorExcel = MotorExcel;
})(typeof self !== 'undefined' ? self : this);
