const XLSX = require("xlsx");

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeHeader(h) {
  return String(h)
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "") // remove acentos (marcas diacriticas apos NFD)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

// Le a primeira planilha de um buffer e retorna { headers, rows } onde rows
// e um array de objetos indexado pelo header normalizado (sem acento, upper).
function parseSheet(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

  if (raw.length === 0) return { headers: [], rows: [] };

  const originalHeaders = Object.keys(raw[0]);
  const headerMap = {};
  originalHeaders.forEach((h) => {
    headerMap[normalizeHeader(h)] = h;
  });

  const rows = raw.map((r) => {
    const normalized = {};
    Object.entries(r).forEach(([k, v]) => {
      normalized[normalizeHeader(k)] = v;
    });
    return normalized;
  });

  return { headers: Object.keys(headerMap), rows };
}

// Converte o valor de uma celula de data para um objeto Date confiavel.
// A planilha pode trazer a data de tres formas: um objeto Date (quando o
// Excel formata a celula como data e o XLSX consegue reconhecer isso), um
// numero serial do Excel (dias desde 1899-12-30, quando a celula esta
// formatada como numero/geral) ou uma string "DD/MM/AAAA". Usar `new
// Date(valor)` direto quebra no caso do serial numerico: o JS interpreta o
// numero como milissegundos desde 1970, resultando em datas como
// "1970-01-01".
function parseDataCelula(valor) {
  if (valor == null || valor === "") return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === "number") {
    const info = XLSX.SSF.parse_date_code(valor);
    if (!info) return null;
    return new Date(Date.UTC(info.y, info.m - 1, info.d, info.H || 0, info.M || 0, Math.round(info.S || 0)));
  }
  const s = String(valor).trim();
  const brasileiro = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (brasileiro) {
    const [, d, m, a] = brasileiro;
    const ano = a.length === 2 ? Number(`20${a}`) : Number(a);
    return new Date(Date.UTC(ano, Number(m) - 1, Number(d)));
  }
  const isoOuOutro = new Date(s);
  return Number.isNaN(isoOuOutro.getTime()) ? null : isoOuOutro;
}

module.exports = { parseSheet, normalizeHeader, parseDataCelula };
