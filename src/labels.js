// Shelf labels as a printable A4 PDF (no libraries): 2.375" x 1.25" tags with cut marks,
// 12 per page, for a metal gondola price channel. Same look as the first Seagram's sheet:
// store + date line, product name, big price, price per oz, green size badge, UPC barcode.
// Owner asks on Telegram ("🏷 Labels" → type a brand) and gets the PDF back.

const WIDTHS = {
  'Helvetica': [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  'Helvetica-Bold': [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,761,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
};
const PT = 72;                       // points per inch
const MM = PT / 25.4;
const PAGE_W = 595.28, PAGE_H = 841.89;  // A4
const LW = 2.375 * PT, LH = 1.25 * PT;    // label size
const COLS = 2, ROWS = 6, PER_PAGE = COLS * ROWS;
const GREEN = '0 0.53 0.33';

// ---------- text helpers ----------
const ascii = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '');
export function textWidth(s, font, size) {
  const w = WIDTHS[font]; let t = 0;
  for (const ch of ascii(s)) { const c = ch.charCodeAt(0); t += (c >= 32 && c < 256 ? w[c - 32] : 556); }
  return t * size / 1000;
}
const pdfStr = (s) => '(' + ascii(s).replace(/[\\()]/g, (m) => '\\' + m).replace(/[^\x20-\x7e]/g, (c) => {
  const code = c.charCodeAt(0); return code < 256 ? '\\' + code.toString(8).padStart(3, '0') : '?';
}) + ')';
function fitSize(s, font, size, maxW, min = 5) {
  while (size > min && textWidth(s, font, size) > maxW) size -= 0.25;
  return size;
}

// ---------- UPC-A ----------
export function upc12(u) {
  u = String(u || '').replace(/\D/g, '');
  if (u.length === 11) {           // stored without the check digit? (or without the leading 0)
    const withZero = '0' + u;
    if (checkDigit(withZero.slice(0, 11)) === +withZero[11]) return withZero;
    return u + checkDigit(u);
  }
  if (u.length !== 12) return null;
  return checkDigit(u.slice(0, 11)) === +u[11] ? u : null;
}
function checkDigit(d11) {
  const d = [...d11].map(Number);
  return (10 - ((d[0] + d[2] + d[4] + d[6] + d[8] + d[10]) * 3 + d[1] + d[3] + d[5] + d[7] + d[9]) % 10) % 10;
}
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
export function upcModules(u12) {
  const R = L.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).join(''));
  return '101' + [...u12.slice(0, 6)].map((d) => L[d]).join('') + '01010' + [...u12.slice(6)].map((d) => R[d]).join('') + '101';
}

// ---------- size / unit price ----------
export function parseSize(p) {
  const s = `${p.size || ''} ${p.name || ''}`.toLowerCase();
  let m = s.match(/(\d+(?:\.\d+)?)\s*(ml|l|lt|liter|litre|oz|fl\.?\s*oz)\b/);
  if (m) {
    const n = parseFloat(m[1]), u = m[2].replace(/\s|\./g, '');
    if (u === 'ml') return { num: String(n), unit: 'ML', oz: n / 29.5735 };
    if (/^(l|lt|liter|litre)$/.test(u)) return { num: String(n), unit: 'L', oz: n * 1000 / 29.5735 };
    return { num: String(n), unit: 'OZ', oz: n };
  }
  m = s.match(/(\d+)\s*(pk|pack|ct|count)\b/);
  if (m) return { num: m[1], unit: m[2].startsWith('p') ? 'PK' : 'CT', oz: null };
  return null;
}
function cleanName(p) {
  let n = ascii(p.clean_name || p.name || '')
    .replace(/\b\d+(?:\.\d+)?\s*(ml|m|l|lt|liter|oz|fl\.?\s*oz|pk|pack|ct)\b/gi, '')   // sizes
    .replace(/\b(pint|pet|bt|btl|12b|sb)\b/gi, '')                                     // POS shorthand
    .replace(/\b(50|100|200|375|750|1000|1750)\s*$/g, '')                              // size left at the end
    .replace(/\bREPASADO\b/gi, 'REPOSADO').replace(/\bTEQ\b/gi, 'TEQUILA').replace(/\bSLVR\b/gi, 'SILVER')
    .replace(/[:;,]+\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  return n.toUpperCase();
}

// ---------- PDF drawing ----------
function drawLabel(ops, x, y, it, store, date) {
  const pad = 2.2 * MM;
  const t = (s, font, size, tx, ty, color = '0 0 0') => ops.push(`BT ${color} rg /${font === 'Helvetica' ? 'F1' : 'F2'} ${size.toFixed(2)} Tf ${tx.toFixed(2)} ${ty.toFixed(2)} Td ${pdfStr(s)} Tj ET`);
  const tr = (s, font, size, rx, ty, color) => t(s, font, size, rx - textWidth(s, font, size), ty, color);
  const tc = (s, font, size, cx, ty, color) => t(s, font, size, cx - textWidth(s, font, size) / 2, ty, color);
  // border
  ops.push(`0.75 0.75 0.75 RG 0.4 w ${x.toFixed(2)} ${y.toFixed(2)} ${LW.toFixed(2)} ${LH.toFixed(2)} re S`);
  // top line
  const top = [it.code, it.cat, date].filter(Boolean).join('   ');
  t(top, 'Helvetica', 5, x + pad, y + LH - 3.2 * MM, '0.25 0.25 0.25');
  tr(store, 'Helvetica', 5, x + LW - pad, y + LH - 3.2 * MM, '0.25 0.25 0.25');
  // name
  const ns = fitSize(it.name, 'Helvetica-Bold', 8.5, LW - 2 * pad);
  t(it.name, 'Helvetica-Bold', ns, x + pad, y + LH - 7.0 * MM);
  // price
  const price = Number(it.price).toFixed(2);
  const py = y + 11.6 * MM;
  const badgeW = it.size ? 11 * MM : 0;
  const ps = fitSize(price, 'Helvetica-Bold', 30, LW - 2 * pad - badgeW - 14 * MM, 18);
  t(price, 'Helvetica-Bold', ps, x + pad, py);
  const pw = textWidth(price, 'Helvetica-Bold', ps);
  if (it.size?.oz) {
    const c = (it.price / it.size.oz) * 100;
    const per = c >= 100 ? '$' + (c / 100).toFixed(2) : c.toFixed(1) + '¢';
    t(per, 'Helvetica-Bold', 9, x + pad + pw + 1.5 * MM, py + 5.2 * MM);
    t('PER OZ', 'Helvetica', 5.5, x + pad + pw + 1.5 * MM, py + 2.6 * MM);
  }
  // size badge (rounded green box)
  if (it.size) {
    const bw = 11 * MM, bh = 8.5 * MM, bx = x + LW - pad - bw, by = py, r = 1.2 * MM, k = 0.5523 * r;
    ops.push(`${GREEN} rg ${(bx + r).toFixed(2)} ${by.toFixed(2)} m ${(bx + bw - r).toFixed(2)} ${by.toFixed(2)} l `
      + `${(bx + bw - r + k).toFixed(2)} ${by.toFixed(2)} ${(bx + bw).toFixed(2)} ${(by + r - k).toFixed(2)} ${(bx + bw).toFixed(2)} ${(by + r).toFixed(2)} c `
      + `${(bx + bw).toFixed(2)} ${(by + bh - r).toFixed(2)} l ${(bx + bw).toFixed(2)} ${(by + bh - r + k).toFixed(2)} ${(bx + bw - r + k).toFixed(2)} ${(by + bh).toFixed(2)} ${(bx + bw - r).toFixed(2)} ${(by + bh).toFixed(2)} c `
      + `${(bx + r).toFixed(2)} ${(by + bh).toFixed(2)} l ${(bx + r - k).toFixed(2)} ${(by + bh).toFixed(2)} ${bx.toFixed(2)} ${(by + bh - r + k).toFixed(2)} ${bx.toFixed(2)} ${(by + bh - r).toFixed(2)} c `
      + `${bx.toFixed(2)} ${(by + r).toFixed(2)} l ${bx.toFixed(2)} ${(by + r - k).toFixed(2)} ${(bx + r - k).toFixed(2)} ${by.toFixed(2)} ${(bx + r).toFixed(2)} ${by.toFixed(2)} c f`);
    const nsz = fitSize(it.size.num, 'Helvetica-Bold', 10, bw - 1.5 * MM, 6);
    tc(it.size.num, 'Helvetica-Bold', nsz, bx + bw / 2, by + 3.8 * MM, '1 1 1');
    tc(it.size.unit, 'Helvetica-Bold', 6, bx + bw / 2, by + 1.3 * MM, '1 1 1');
  }
  // UPC text + size
  const u = it.upc;
  t(u ? `${u[0]} ${u.slice(1, 6)}-${u.slice(6, 11)} ${u[11]}` : 'UPC: add after first scan', 'Helvetica', 6, x + pad, y + 6.3 * MM);
  if (it.size) tr(`${it.size.num} ${it.size.unit}`, 'Helvetica', 6, x + LW - pad, y + 6.3 * MM);
  // barcode
  if (u) {
    const mods = upcModules(u), mw = 0.62, bh = 4.2 * MM, bx = x + pad, by = y + 1.4 * MM;
    const bars = [];
    for (let i = 0; i < mods.length; ) {
      if (mods[i] === '1') { let j = i; while (mods[j] === '1') j++; bars.push(`${(bx + i * mw).toFixed(3)} ${by.toFixed(2)} ${((j - i) * mw).toFixed(3)} ${bh.toFixed(2)} re`); i = j; }
      else i++;
    }
    ops.push('0 0 0 rg ' + bars.join(' ') + ' f');
  }
}
function cropMarks(ops, x, y) {
  const len = 3 * MM, g = 1 * MM, seg = [];
  for (const [cx, sx] of [[x, -1], [x + LW, 1]]) for (const [cy, sy] of [[y, -1], [y + LH, 1]]) {
    seg.push(`${(cx + sx * g).toFixed(2)} ${cy.toFixed(2)} m ${(cx + sx * (g + len)).toFixed(2)} ${cy.toFixed(2)} l`);
    seg.push(`${cx.toFixed(2)} ${(cy + sy * g).toFixed(2)} m ${cx.toFixed(2)} ${(cy + sy * (g + len)).toFixed(2)} l`);
  }
  ops.push('0 0 0 RG 0.3 w ' + seg.join(' ') + ' S');
}

// items: [{ name, price, size:{num,unit,oz}|null, upc:'012345678905'|null, code, cat }]
export function labelPdf(items, { store = 'DISCOUNT LIQUOR', date = '', title = 'Shelf labels' } = {}) {
  const pages = [];
  for (let p = 0; p < Math.max(1, Math.ceil(items.length / PER_PAGE)); p++) {
    const ops = [];
    const gapX = 12 * MM, gapY = 9 * MM;
    const gx = (PAGE_W - (COLS * LW + (COLS - 1) * gapX)) / 2;
    const top = PAGE_H - 30 * MM;
    ops.push(`BT 0 0 0 rg /F2 11 Tf ${(20 * MM).toFixed(2)} ${(PAGE_H - 16 * MM).toFixed(2)} Td ${pdfStr(title + (pages.length || items.length > PER_PAGE ? `  (page ${p + 1})` : ''))} Tj ET`);
    ops.push(`BT 0 0 0 rg /F1 8 Tf ${(20 * MM).toFixed(2)} ${(PAGE_H - 21 * MM).toFixed(2)} Td ${pdfStr('Print at 100% / "Actual size", not "Fit to page". Each label is 2.375 x 1.25 in (60.3 x 31.8 mm). The ruler should measure 100 mm.')} Tj ET`);
    const ry = PAGE_H - 25 * MM, ticks = [`${(20 * MM).toFixed(2)} ${ry.toFixed(2)} m ${(120 * MM).toFixed(2)} ${ry.toFixed(2)} l`];
    for (let tk = 0; tk <= 100; tk += 10) ticks.push(`${((20 + tk) * MM).toFixed(2)} ${ry.toFixed(2)} m ${((20 + tk) * MM).toFixed(2)} ${(ry + 1.5 * MM).toFixed(2)} l`);
    ops.push('0 0 0 RG 0.5 w ' + ticks.join(' ') + ' S');
    items.slice(p * PER_PAGE, (p + 1) * PER_PAGE).forEach((it, i) => {
      const r = Math.floor(i / COLS), k = i % COLS;
      const x = gx + k * (LW + gapX), y = top - (r + 1) * LH - r * gapY;
      drawLabel(ops, x, y, it, store, date); cropMarks(ops, x, y);
    });
    pages.push(ops.join('\n'));
  }
  // assemble the PDF
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(null), pagesObj = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const content of pages) {
    const bytes = new TextEncoder().encode(content);
    const c = add(`<< /Length ${bytes.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);   // content is ASCII only, so string length == byte length
}

// ---------- finding the items ----------
// Products whose name matches every word typed (size like "375" narrows). Returns label-ready items.
export async function findLabelItems(db, query, limit = 36) {
  const q = ascii(query).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9.\s]/g, ' ').trim();
  if (!q) return [];
  const sizeWord = (q.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|oz)?\b/) || [])[0];
  const words = q.split(/\s+/).filter((w) => w && !/^\d+(\.\d+)?(ml|l|oz)?$/.test(w) && !['ml', 'oz', 'the', 'of', 'label', 'labels', 'for'].includes(w));
  if (!words.length) return [];
  const where = words.map(() => "lower(replace(name, '''', '')) LIKE ?").join(' AND ');
  let rows = (await db.prepare(`SELECT p.*, (SELECT upc FROM product_upcs u WHERE u.product_id = p.id LIMIT 1) AS upc
    FROM products p WHERE ${where} AND active = 1 ORDER BY name LIMIT 200`).bind(...words.map((w) => `%${w.replace(/'/g, '')}%`)).all()).results;
  // whole words only: "gin" must not match "ginger"; plurals and long prefixes are fine
  const tokens = (name) => ascii(name).toLowerCase().replace(/'/g, '').split(/[^a-z0-9.]+/);
  const hit = (w, toks) => toks.some((t) => t === w || t === w + 's' || (w.length >= 5 && t.startsWith(w)));
  rows = rows.filter((r) => { const toks = tokens(r.name); return words.every((w) => hit(w, toks)); });
  if (sizeWord) {
    const n = parseFloat(sizeWord);
    const sized = rows.filter((r) => { const s = parseSize(r); return s && parseFloat(s.num) === n; });
    if (sized.length) rows = sized;
  }
  const items = rows.map(toLabelItem);
  // biggest bottle first within each product, like a shelf left to right
  items.sort((a, b) => a.name.localeCompare(b.name) || (b.size?.oz || 0) - (a.size?.oz || 0));
  return items.slice(0, limit);
}

// A products row (with an optional upc column) -> a label item
export function toLabelItem(r) {
  return {
    id: r.id,
    name: cleanName(r),
    raw: r.name,
    price: r.price,
    priceSource: r.price_source,
    size: parseSize(r),
    upc: upc12(r.upc),
    code: String(r.id).padStart(4, '0'),
    cat: String(r.sub_category || r.category || '').toUpperCase(),
  };
}

export function labelDate(today) {           // 2026-11-20 -> 11/20/26
  const [y, m, d] = String(today).split('-');
  return `${m}/${d}/${String(y).slice(2)}`;
}
