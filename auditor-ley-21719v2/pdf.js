// Generador de PDF mínimo (texto, fuentes Helvetica estándar). Sin librerías ni red.
(function (root) {
  const W = 595.28, H = 841.89, M = 48, BOTTOM = 56;
  const HW = { 32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191, 40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
    58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556, 64: 1015, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556, 96: 333, 123: 334, 124: 260, 125: 334, 126: 584 };
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => HW[65 + i] = [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611][i]);
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c, i) => HW[97 + i] = [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500][i]);
  for (let i = 48; i <= 57; i++) HW[i] = 556;

  const latin = s => String(s == null ? '' : s)
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D\u00AB\u00BB]/g, '"').replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...').replace(/[\u2022\u00B7]/g, '-').replace(/\u2192/g, '->').replace(/\u00A0/g, ' ')
    .replace(/[^\u0020-\u007E\u00A1-\u00FF]/g, ' ');
  const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const width = (s, size, bold) => {
    let w = 0;
    for (const ch of s) { const b = ch.normalize('NFD')[0]; w += HW[b.charCodeAt(0)] || 556; }
    return w * size / 1000 * (bold ? 1.07 : 1);
  };
  const COLOR = { fail: [0.706, 0.137, 0.173], warn: [0.541, 0.353, 0.043], ok: [0.106, 0.498, 0.361], na: [0.29, 0.33, 0.4], ink: [0.08, 0.13, 0.24], gray: [0.35, 0.38, 0.45] };

  function makePdf(report) {
    const pages = []; let ops = []; let y = H - M;
    const newPage = () => { ops = []; pages.push(ops); y = H - M; };
    newPage();

    const wrap = (text, size, bold, maxW) => {
      const lines = [];
      String(latin(text)).split('\n').forEach(par => {
        let line = '';
        par.split(/\s+/).filter(Boolean).forEach(word => {
          // Palabras muy largas (URL, selectores) se cortan.
          while (width(word, size, bold) > maxW) {
            let cut = word.length; while (cut > 1 && width(word.slice(0, cut), size, bold) > maxW) cut--;
            if (line) { lines.push(line); line = ''; }
            lines.push(word.slice(0, cut)); word = word.slice(cut);
          }
          const t = line ? line + ' ' + word : word;
          if (width(t, size, bold) <= maxW) line = t; else { lines.push(line); line = word; }
        });
        lines.push(line);
      });
      return lines;
    };

    function para(text, o = {}) {
      const size = o.size || 10, lh = o.lh || size * 1.4, indent = o.indent || 0, bold = !!o.bold, col = COLOR[o.color || 'ink'];
      const lines = wrap(text, size, bold, W - 2 * M - indent);
      lines.forEach((ln, i) => {
        if (y - lh < BOTTOM) newPage();
        y -= lh;
        const bullet = o.bullet && i === 0 ? '-' : '';
        if (bullet) ops.push(`BT /F1 ${size} Tf ${col.join(' ')} rg ${M + indent - 9} ${y.toFixed(2)} Td (${esc(bullet)}) Tj ET`);
        if (ln) ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${col.join(' ')} rg ${M + indent} ${y.toFixed(2)} Td (${esc(ln)}) Tj ET`);
      });
      y -= o.gap == null ? 3 : o.gap;
    }
    const rule = () => { if (y - 8 < BOTTOM) newPage(); y -= 4; ops.push(`0.8 0.84 0.9 RG 0.6 w ${M} ${y.toFixed(2)} m ${W - M} ${y.toFixed(2)} l S`); y -= 6; };

    // ---- Contenido ----
    const { count, meta, results } = report;
    para('Informe de auditoría - Ley 21.719', { size: 18, bold: true, gap: 2 });
    para('Protección de datos personales (Chile). Revisión automática de un sitio web.', { size: 10, color: 'gray', gap: 8 });
    para(`Sitio: ${report.url}`, { size: 10, gap: 1 });
    para(`Fecha del análisis: ${report.fecha}`, { size: 10, gap: 1 });
    para(`Herramienta: Auditor Ley 21.719 v${report.version || ''}. Criterios verificados contra el texto oficial el ${meta.verificadoEl}.`, { size: 9, color: 'gray', gap: 8 });
    para(`Resumen: ${count.fail} alerta(s), ${count.warn} por revisar, ${count.ok} sin hallazgos, ${count.na} no aplica.`, { size: 12, bold: true, gap: 6 });
    para(meta.nota, { size: 9, color: 'gray', gap: 6 });
    para(`Fuente legal: ${meta.fuenteLegal.texto}. ${meta.fuenteLegal.bcn}`, { size: 8, color: 'gray', gap: 4 });
    rule();

    const label = { fail: 'ALERTA', warn: 'POR REVISAR', ok: 'SIN HALLAZGOS', na: 'NO APLICA' };
    const ord = ['fail', 'warn', 'ok', 'na'];
    const areas = [...new Set(results.map(r => r.area))];
    areas.forEach(area => {
      para(area, { size: 12, bold: true, gap: 4 });
      results.filter(r => r.area === area).sort((a, b) => ord.indexOf(a.status) - ord.indexOf(b.status)).forEach(r => {
        if (y - 90 < BOTTOM) newPage(); // evita títulos huérfanos al final de página
        para(`[${label[r.status]}] ${r.title}`, { size: 10.5, bold: true, color: r.status, gap: 1 });
        para(`Ley 21.719 -> ${r.ref}`, { size: 8.5, color: 'gray', gap: 2 });
        para(r.detail, { size: 9.5, gap: 2 });
        if (r.locations.length) {
          para('Dónde se genera:', { size: 9, bold: true, gap: 1 });
          r.locations.forEach(l => {
            para(`${l.donde}${l.nota ? ': ' + l.nota : ''}`, { size: 9, indent: 14, bullet: true, gap: 0 });
            if (l.selector) para(`Selector CSS: ${l.selector}`, { size: 8, indent: 14, color: 'gray', gap: 1 });
          });
          y -= 2;
        }
        if (r.solutions.length) {
          para('Posibles soluciones:', { size: 9, bold: true, gap: 1 });
          r.solutions.forEach(s => para(s, { size: 9, indent: 14, bullet: true, gap: 0 }));
        }
        y -= 7;
      });
      rule();
    });

    para('Verificación manual: puntos que no se pueden ver desde el navegador', { size: 12, bold: true, gap: 4 });
    para('Son obligaciones de la ley que dependen de procesos internos, contratos o sistemas. Revísalas con tu equipo legal o de cumplimiento.', { size: 9, color: 'gray', gap: 4 });
    report.manual.forEach(m => {
      para(`${m.title} (${m.ref})`, { size: 10, bold: true, gap: 1 });
      para(`Qué exige: ${m.que}`, { size: 9, indent: 14, gap: 0 });
      para(`Cómo revisarlo: ${m.como}`, { size: 9, indent: 14, gap: 6 });
    });
    rule();
    para('Aviso: esta herramienta analiza solo lo visible en la página (enlaces, formularios, rastreadores, cookies, texto de la política). No ve la base de licitud, los contratos, los sistemas internos ni los registros, y no certifica cumplimiento legal.', { size: 8.5, color: 'gray' });

    // ---- Armado del archivo ----
    // Objetos: 1 catálogo, 2 páginas, 3 y 4 fuentes, 5 info; luego, por página i: contenido (6+2i) y página (7+2i).
    const n = pages.length;
    let out = '%PDF-1.4\n'; const offs = [];
    const add = body => { offs.push(out.length); out += `${offs.length} 0 obj\n${body}\nendobj\n`; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${7 + 2 * i} 0 R`).join(' ')}] >>`);
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    add('<< /Producer (Auditor Ley 21.719) >>');
    pages.forEach((p, i) => {
      const foot = `BT /F1 8 Tf 0.35 0.38 0.45 rg ${M} 30 Td (${esc(latin(`Auditor Ley 21.719 - revisión automática, no es certificación legal - Página ${i + 1} de ${n}`))}) Tj ET`;
      const stream = p.concat(foot).join('\n');
      add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${6 + 2 * i} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`);
    });
    const xrefPos = out.length, total = offs.length + 1;
    out += `xref\n0 ${total}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${total} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }

  root.AuditorPdf = { makePdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AuditorPdf;
})(typeof window !== 'undefined' ? window : globalThis);
