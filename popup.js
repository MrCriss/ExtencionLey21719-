const $ = s => document.querySelector(s);
const { LABEL, KEY, buildReport } = window.Auditor;
const ORDER = ['fail', 'warn', 'ok', 'na'];
let last = null, cfgCache = null;

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function showError(msg) {
  $('#error').textContent = msg; $('#error').hidden = false;
  $('#loading').hidden = true; $('#report').hidden = true; $('#dlpdf').hidden = true; $('#dljson').hidden = true;
}

// Se inyecta en la página para resaltar el elemento y llevar la vista hasta él.
function highlight(selector) {
  try {
    const e = document.querySelector(selector);
    if (!e) return false;
    e.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const o = e.style.outline, oo = e.style.outlineOffset;
    e.style.outline = '3px solid #e11d48'; e.style.outlineOffset = '2px';
    setTimeout(() => { e.style.outline = o; e.style.outlineOffset = oo; }, 5000);
    return true;
  } catch (err) { return false; }
}

function renderResult(r) {
  const d = el('details', r.status);
  if (r.status === 'fail') d.open = true;
  const sm = el('summary');
  sm.append(el('span', '', r.title), el('span', 'tag', LABEL[r.status]));
  const b = el('div', 'body');
  b.append(el('p', '', r.detail));
  if (r.locations.length) {
    b.append(el('h4', '', 'Dónde se genera'));
    const ul = el('ul', 'where');
    r.locations.forEach(l => {
      const li = el('li');
      const strong = el('strong', '', l.donde);
      li.append(strong);
      if (l.nota) li.append(document.createTextNode(l.nota ? ' — ' + l.nota : ''));
      if (l.selector) li.append(el('code', '', l.selector));
      if (l.selector && l.visible) {
        const btn = el('button', 'ghost', 'Ver en la página'); btn.type = 'button';
        btn.addEventListener('click', async () => {
          try {
            const [res] = await chrome.scripting.executeScript({ target: { tabId: last.tabId }, func: highlight, args: [l.selector] });
            if (!res.result) btn.textContent = 'No se encontró el elemento';
          } catch (e) { btn.textContent = 'No se pudo resaltar'; }
        });
        li.append(el('br'), btn);
      }
      ul.append(li);
    });
    b.append(ul);
  }
  if (r.solutions.length) {
    b.append(el('h4', '', 'Posibles soluciones'));
    const ul = el('ul');
    r.solutions.forEach(s => ul.append(el('li', '', s)));
    b.append(ul);
  }
  b.append(el('p', 'ref', `${last.meta.ley}: ${r.ref}`));
  d.append(sm, b);
  return d;
}

function render(report, cfg) {
  const c = report.count;
  const bar = $('#bar'); bar.replaceChildren();
  ['fail', 'warn', 'ok'].forEach(s => { if (c[s]) { const i = el('i', s); i.style.flex = c[s]; bar.append(i); } });
  $('#verdict').textContent = `${c.fail} ${c.fail === 1 ? 'alerta' : 'alertas'}, ${c.warn} por revisar, ${c.ok} sin hallazgos`;
  $('#note').textContent = cfg.meta.nota;

  const list = $('#list'); list.replaceChildren();
  cfg.areas.forEach(area => {
    const rs = ORDER.flatMap(s => report.results.filter(r => r.area === area && r.status === s));
    if (!rs.length) return;
    list.append(el('li', 'grp', area));
    rs.forEach(r => { const li = el('li'); li.append(renderResult(r)); list.append(li); });
  });

  const man = $('#manual'); man.replaceChildren();
  report.manual.forEach(m => {
    const li = el('li'), d = el('details'), sm = el('summary');
    sm.append(el('span', '', m.title), el('span', 'tag', 'Manual'));
    const b = el('div', 'body');
    b.append(el('p', '', `Qué exige: ${m.que}`), el('p', '', `Cómo revisarlo: ${m.como}`), el('p', 'ref', `${cfg.meta.ley}: ${m.ref}`));
    d.append(sm, b); li.append(d); man.append(li);
  });

  $('#error').hidden = true; $('#loading').hidden = true; $('#report').hidden = false;
  $('#dlpdf').hidden = false; $('#dljson').hidden = false;
}

async function run() {
  $('#error').hidden = true; $('#report').hidden = true; $('#loading').hidden = false;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || '')) return showError('Abre un sitio web (http o https) y vuelve a analizar.');
  $('#site').textContent = new URL(tab.url).hostname;
  let facts;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scanner.js'] });
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__auditorScan() });
    facts = r.result;
  } catch (e) {
    return showError('Chrome no permite analizar esta página (por ejemplo, la Chrome Web Store). Prueba con otro sitio.');
  }
  if (!facts) return showError('No se pudo leer la página. Recárgala y vuelve a intentar.');
  cfgCache = cfgCache || await (await fetch('rules.json')).json();
  const report = buildReport(cfgCache, facts, { version: chrome.runtime.getManifest().version });
  last = { ...report, tabId: tab.id };
  render(last, cfgCache);
}

function download(bytes, type, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

function jsonReport() {
  const r = last;
  return {
    herramienta: { nombre: 'Auditor Ley 21.719', version: r.version },
    fecha: r.fecha, url: r.url,
    ley: { nombre: r.meta.ley, descripcion: r.meta.descripcion, fuenteLegal: r.meta.fuenteLegal, verificadoEl: r.meta.verificadoEl, vigenciaPrevista: r.meta.vigenciaPrevista, nota: r.meta.nota },
    resumen: { alertas: r.count.fail, porRevisar: r.count.warn, sinHallazgos: r.count.ok, noAplica: r.count.na },
    resultados: r.results.map(x => ({
      id: x.id, area: x.area, titulo: x.title, estado: KEY[x.status], estadoEtiqueta: LABEL[x.status],
      referenciaLegal: `${r.meta.ley}: ${x.ref}`, detalle: x.detail,
      ubicaciones: x.locations.map(l => ({ donde: l.donde, nota: l.nota, selectorCss: l.selector })),
      posiblesSoluciones: x.solutions
    })),
    verificacionManual: r.manual.map(m => ({ id: m.id, titulo: m.title, referenciaLegal: `${r.meta.ley}: ${m.ref}`, queExige: m.que, comoRevisarlo: m.como })),
    datosTecnicos: r.facts,
    aviso: 'Revisión automática de lo visible en la página. No certifica cumplimiento legal.'
  };
}

$('#rescan').addEventListener('click', run);
$('#dlpdf').addEventListener('click', () => download(window.AuditorPdf.makePdf(last), 'application/pdf', `auditoria-${last.host || 'sitio'}-${stamp()}.pdf`));
$('#dljson').addEventListener('click', () => download(JSON.stringify(jsonReport(), null, 2), 'application/json', `auditoria-${last.host || 'sitio'}-${stamp()}.json`));
run();
