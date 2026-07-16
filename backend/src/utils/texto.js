const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

// Normaliza nome de pessoa para comparação entre bases diferentes (Colaboradores
// x HE Executado): remove acentos, ignora caixa e colapsa espaços extras.
function normalizarNome(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

module.exports = { normalizarNome };
