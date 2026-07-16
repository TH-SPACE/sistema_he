const prisma = require("../../config/prisma");
const { calcularItem, competenciaDe } = require("../../utils/calculoHe");

// Expande o rascunho (gerente + lista de colaboradores, cada um com várias
// datas, cada uma com seu próprio tipo e quantidade de horas) no produto
// cartesiano colaborador x data, calculando valorHora e valorCalculado
// (snapshot) para cada item.
async function expandirRascunho({ gerenteId, colaboradores }) {
  const colaboradorIds = colaboradores.map((c) => c.colaboradorId);
  const registros = await prisma.colaborador.findMany({
    where: { id: { in: colaboradorIds } },
    include: { cargo: true },
  });
  const porId = new Map(registros.map((c) => [c.id, c]));

  const itens = [];
  for (const linha of colaboradores) {
    const colaborador = porId.get(linha.colaboradorId);
    if (!colaborador) {
      throw Object.assign(new Error(`Colaborador ${linha.colaboradorId} não encontrado`), { status: 400, expose: true });
    }
    for (const { data: dataHe, tipo, horas } of linha.datas) {
      const { valorHora, valorCalculado } = calcularItem({ cargo: colaborador.cargo, tipo, horas });
      itens.push({
        colaboradorId: colaborador.id,
        colaboradorNome: colaborador.nome,
        dataHe,
        tipo,
        horas,
        justificativa: linha.justificativa,
        valorHora,
        valorCalculado,
      });
    }
  }
  return itens;
}

// Resumo de limite (§8.2): considera itens PENDENTE_APROVACAO + APROVADO
// do gerente na competência atual, mais o total desta solicitação (rascunho).
async function resumoLimite({ gerenteId, itens }) {
  const gerente = await prisma.gerente.findUnique({ where: { id: gerenteId } });
  if (!gerente) {
    throw Object.assign(new Error("Gerente não encontrado"), { status: 400, expose: true });
  }

  const competenciaAtual = competenciaDe(new Date());
  const inicioMes = new Date(`${competenciaAtual}-01T00:00:00.000Z`);
  const fimMes = new Date(inicioMes);
  fimMes.setUTCMonth(fimMes.getUTCMonth() + 1);

  const jaSolicitados = await prisma.solicitacaoItem.findMany({
    where: {
      status: { in: ["PENDENTE_APROVACAO", "APROVADO"] },
      dataHe: { gte: inicioMes, lt: fimMes },
      solicitacao: { gerenteId },
    },
    select: { valorCalculado: true, status: true },
  });

  const valorAprovado = jaSolicitados.filter((i) => i.status === "APROVADO").reduce((acc, i) => acc + Number(i.valorCalculado), 0);
  const valorPendente = jaSolicitados.filter((i) => i.status === "PENDENTE_APROVACAO").reduce((acc, i) => acc + Number(i.valorCalculado), 0);
  const valorJaSolicitado = valorAprovado + valorPendente;
  const valorDestaSolicitacao = itens.reduce((acc, i) => acc + Number(i.valorCalculado), 0);
  const valorAposSolicitar = valorJaSolicitado + valorDestaSolicitacao;

  return {
    gerenteId,
    gerenteNome: gerente.nome,
    competencia: competenciaAtual,
    valorLimite: Number(gerente.valorLimite),
    valorAprovado,
    valorPendente,
    valorJaSolicitado,
    valorDestaSolicitacao,
    valorAposSolicitar,
    acimaDoLimite: valorAposSolicitar > Number(gerente.valorLimite),
  };
}

async function gerarProtocolo() {
  const ano = new Date().getFullYear();
  const prefixo = `HE-${ano}-`;
  const ultimo = await prisma.solicitacao.findFirst({
    where: { protocolo: { startsWith: prefixo } },
    orderBy: { protocolo: "desc" },
  });
  const proximo = ultimo ? Number(ultimo.protocolo.replace(prefixo, "")) + 1 : 1;
  return `${prefixo}${String(proximo).padStart(6, "0")}`;
}

function statusGeral(itens) {
  const statuses = new Set(itens.map((i) => i.status));
  if (statuses.size === 1) {
    const unico = [...statuses][0];
    if (unico === "APROVADO") return "APROVADO";
    if (unico === "RECUSADO") return "RECUSADO";
    return "PENDENTE";
  }
  if (statuses.has("PENDENTE_APROVACAO")) return "PENDENTE";
  return "CONCLUIDO_PARCIAL";
}

module.exports = { expandirRascunho, resumoLimite, gerarProtocolo, statusGeral };
