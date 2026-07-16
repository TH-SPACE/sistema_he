// Fonte única de verdade para o valor de um item de HE.
//
// A tabela de cargos (CARGO_VALOR.xlsx) já traz o valor de hora PRONTO por
// tipo (coluna "HE 50% (R$)" e "HE 100% (R$)"), sem multiplicador embutido.
// Por isso o cálculo aqui é uma simples multiplicação por horas.
function valorHoraPorTipo(cargo, tipo) {
  if (tipo === "PCT_50") return Number(cargo.valorHora50);
  if (tipo === "PCT_100") return Number(cargo.valorHora100);
  throw Object.assign(new Error(`Tipo de HE inválido: ${tipo}`), { status: 400, expose: true });
}

function calcularItem({ cargo, tipo, horas }) {
  const valorHora = valorHoraPorTipo(cargo, tipo);
  const valorCalculado = Number((valorHora * Number(horas)).toFixed(2));
  return { valorHora, valorCalculado };
}

function competenciaDe(data) {
  const d = new Date(data);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

module.exports = { calcularItem, valorHoraPorTipo, competenciaDe };
