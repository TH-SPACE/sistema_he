const express = require("express");
const ExcelJS = require("exceljs");
const prisma = require("../../config/prisma");

const router = express.Router();

function deveRestringirPorGerente(req) {
  return !["ADMIN", "APROVADOR"].includes(req.usuario.perfil);
}

function resolverGerenteFiltro(req, gerenteIdQuery) {
  const gerenteVinculado = deveRestringirPorGerente(req) && req.usuario.gerenteId ? Number(req.usuario.gerenteId) : null;
  const gerenteQuery = gerenteIdQuery ? Number(gerenteIdQuery) : undefined;

  if (gerenteVinculado && gerenteQuery && gerenteQuery !== gerenteVinculado) {
    return { erro: "Usuário vinculado a outra gerência" };
  }

  return { gerenteId: gerenteVinculado || gerenteQuery };
}

function limitesMes(mes, ano) {
  const anoNum = ano ? Number(ano) : new Date().getFullYear();
  const mesNum = mes ? Number(mes) : new Date().getMonth() + 1;
  const inicio = new Date(Date.UTC(anoNum, mesNum - 1, 1));
  const fim = new Date(Date.UTC(anoNum, mesNum, 1));
  return { inicio, fim };
}

async function buscarResumoHoras({ gerenteId, mes, ano }) {
  const { inicio, fim } = limitesMes(mes, ano);

  const itens = await prisma.solicitacaoItem.findMany({
    where: {
      dataHe: { gte: inicio, lt: fim },
      solicitacao: gerenteId ? { gerenteId: Number(gerenteId) } : undefined,
    },
    include: { solicitacao: { include: { gerente: true } } },
  });

  const porGerente = new Map();
  const kpis = { totalHoras: 0, aprovadas: 0, pendentes: 0, recusadas: 0 };

  for (const item of itens) {
    const horas = Number(item.horas);
    const g = item.solicitacao.gerente;
    if (!porGerente.has(g.id)) {
      porGerente.set(g.id, { gerenteId: g.id, gerente: g.nome, aprovadas: 0, pendentes: 0, recusadas: 0, total: 0 });
    }
    const reg = porGerente.get(g.id);

    kpis.totalHoras += horas;
    reg.total += horas;

    if (item.status === "APROVADO") {
      kpis.aprovadas += horas;
      reg.aprovadas += horas;
    } else if (item.status === "PENDENTE_APROVACAO") {
      kpis.pendentes += horas;
      reg.pendentes += horas;
    } else if (item.status === "RECUSADO") {
      kpis.recusadas += horas;
      reg.recusadas += horas;
    }
  }

  const linhas = [...porGerente.values()].sort((a, b) => a.gerente.localeCompare(b.gerente));
  return { kpis, porGerente: linhas };
}

router.get("/resumo-horas", async (req, res, next) => {
  try {
    const { gerenteId, mes, ano } = req.query;
    const { gerenteId: gerenteFiltro, erro } = resolverGerenteFiltro(req, gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });

    const resultado = await buscarResumoHoras({ gerenteId: gerenteFiltro, mes, ano });
    res.json({ data: resultado, error: null });
  } catch (err) {
    next(err);
  }
});

// Detalhe (drill-down) das solicitacoes por tras de um numero da tabela
// "Horas por Gerencia": filtra por gerente + periodo e, opcionalmente, status
// (APROVADO | PENDENTE_APROVACAO | RECUSADO). Sem status = todos (coluna Total).
router.get("/resumo-horas/detalhe", async (req, res, next) => {
  try {
    const { gerenteId, mes, ano, status } = req.query;
    const { gerenteId: gerenteFiltro, erro } = resolverGerenteFiltro(req, gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });

    const { inicio, fim } = limitesMes(mes, ano);

    const itens = await prisma.solicitacaoItem.findMany({
      where: {
        dataHe: { gte: inicio, lt: fim },
        status: status || undefined,
        solicitacao: gerenteFiltro ? { gerenteId: Number(gerenteFiltro) } : undefined,
      },
      include: { colaborador: true, solicitacao: { include: { gerente: true, solicitante: true } } },
      orderBy: { dataHe: "desc" },
    });

    const linhas = itens.map((item) => ({
      id: item.id,
      protocolo: item.solicitacao.protocolo,
      gerente: item.solicitacao.gerente.nome,
      colaborador: item.colaboradorNomeSnapshot || item.colaborador?.nome || "Não informado",
      dataHe: item.dataHe,
      tipo: item.tipo,
      horas: Number(item.horas),
      status: item.status,
      solicitante: item.solicitacao.solicitante?.nome || item.solicitacao.solicitanteNomeSnapshot || "Não informado",
    }));

    res.json({ data: linhas, error: null });
  } catch (err) {
    next(err);
  }
});

router.get("/resumo-horas/export", async (req, res, next) => {
  try {
    const { gerenteId, mes, ano } = req.query;
    const { gerenteId: gerenteFiltro, erro } = resolverGerenteFiltro(req, gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });

    const { porGerente } = await buscarResumoHoras({ gerenteId: gerenteFiltro, mes, ano });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Horas por Gerencia");
    ws.columns = [
      { header: "Gerente", key: "gerente", width: 32 },
      { header: "Aprovadas (h)", key: "aprovadas", width: 16 },
      { header: "Pendentes (h)", key: "pendentes", width: 16 },
      { header: "Recusadas (h)", key: "recusadas", width: 16 },
      { header: "Total (h)", key: "total", width: 14 },
    ];
    porGerente.forEach((linha) => ws.addRow(linha));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=horas_por_gerencia.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
