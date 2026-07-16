const express = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");

const router = express.Router();

function aplicarSnapshotSolicitante(item) {
  const solicitanteNome = item.solicitacao.solicitante?.nome || item.solicitacao.solicitanteNomeSnapshot || "Não informado";
  return {
    ...item,
    solicitacao: {
      ...item.solicitacao,
      solicitante: { ...(item.solicitacao.solicitante || {}), nome: solicitanteNome },
    },
  };
}

function limitesMes(mes, ano) {
  if (!mes || !ano) return {};
  const anoNum = Number(ano);
  const mesNum = Number(mes);
  const inicio = new Date(Date.UTC(anoNum, mesNum - 1, 1));
  const fim = new Date(Date.UTC(anoNum, mesNum, 1));
  return { gte: inicio, lt: fim };
}

// Tela intermediaria: resumo por gerente antes de entrar na fila de itens.
// Agrupa por gerente os itens que batem com o status/periodo informados.
router.get("/resumo-gerencias", requirePerfil("APROVADOR", "ADMIN"), async (req, res, next) => {
  try {
    const { mes, ano, status = "PENDENTE_APROVACAO" } = req.query;
    const dataHe = limitesMes(mes, ano);

    const itens = await prisma.solicitacaoItem.findMany({
      where: {
        status: status || undefined,
        dataHe: Object.keys(dataHe).length ? dataHe : undefined,
      },
      include: { solicitacao: { include: { gerente: true } } },
    });

    const porGerente = new Map();
    for (const item of itens) {
      const g = item.solicitacao.gerente;
      if (!porGerente.has(g.id)) {
        porGerente.set(g.id, {
          gerenteId: g.id,
          gerente: g.nome,
          protocolos: new Set(),
          totalHoras: 0,
          valorTotal: 0,
        });
      }
      const reg = porGerente.get(g.id);
      reg.protocolos.add(item.solicitacaoId);
      reg.totalHoras += Number(item.horas);
      reg.valorTotal += Number(item.valorCalculado);
    }

    const linhas = [...porGerente.values()]
      .map((r) => ({
        gerenteId: r.gerenteId,
        gerente: r.gerente,
        quantidadeSolicitacoes: r.protocolos.size,
        totalHoras: r.totalHoras,
        valorTotal: Number(r.valorTotal.toFixed(2)),
      }))
      .sort((a, b) => b.valorTotal - a.valorTotal);

    res.json({ data: linhas, error: null });
  } catch (err) {
    next(err);
  }
});

// Resumo de saldo/limite de um gerente especifico no periodo (mes/ano)
// informado. Mostrado em destaque na fila de itens, para o aprovador saber
// quanto ainda cabe no limite antes de aprovar.
router.get("/resumo-gerente", requirePerfil("APROVADOR", "ADMIN"), async (req, res, next) => {
  try {
    const { gerenteId, mes, ano } = req.query;
    if (!gerenteId) return res.status(400).json({ data: null, error: "gerenteId é obrigatório" });

    const gerente = await prisma.gerente.findUnique({ where: { id: Number(gerenteId) } });
    if (!gerente) return res.status(404).json({ data: null, error: "Gerente não encontrado" });

    const dataHe = limitesMes(mes, ano);
    const itens = await prisma.solicitacaoItem.findMany({
      where: {
        status: { in: ["APROVADO", "PENDENTE_APROVACAO"] },
        dataHe: Object.keys(dataHe).length ? dataHe : undefined,
        solicitacao: { gerenteId: Number(gerenteId) },
      },
      select: { status: true, valorCalculado: true },
    });

    const valorAprovado = itens.filter((i) => i.status === "APROVADO").reduce((acc, i) => acc + Number(i.valorCalculado), 0);
    const valorPendente = itens.filter((i) => i.status === "PENDENTE_APROVACAO").reduce((acc, i) => acc + Number(i.valorCalculado), 0);
    const valorLimite = Number(gerente.valorLimite);
    const saldoDisponivel = valorLimite - valorAprovado;
    const saldoAposAprovarPendentes = valorLimite - valorAprovado - valorPendente;

    res.json({
      data: {
        gerenteId: gerente.id,
        gerenteNome: gerente.nome,
        valorLimite,
        valorAprovado,
        valorPendente,
        saldoDisponivel,
        saldoAposAprovarPendentes,
        acimaDoLimiteSeAprovarTudo: saldoAposAprovarPendentes < 0,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// Lista de itens de um gerente especifico, com status/periodo flexiveis
// (usada apos o usuario escolher um gerente na tela de resumo).
router.get("/itens", requirePerfil("APROVADOR", "ADMIN"), async (req, res, next) => {
  try {
    const { gerenteId, colaboradorId, justificativa, mes, ano, status = "PENDENTE_APROVACAO", page = "1", pageSize = "50" } = req.query;
    const dataHe = limitesMes(mes, ano);
    const where = {
      status: status || undefined,
      colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
      justificativa: justificativa || undefined,
      dataHe: Object.keys(dataHe).length ? dataHe : undefined,
      solicitacao: gerenteId ? { gerenteId: Number(gerenteId) } : undefined,
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [itens, total] = await Promise.all([
      prisma.solicitacaoItem.findMany({
        where,
        include: { colaborador: true, solicitacao: { include: { gerente: true, solicitante: true } } },
        orderBy: { criadoEm: "asc" },
        skip,
        take: Number(pageSize),
      }),
      prisma.solicitacaoItem.count({ where }),
    ]);
    res.json({ data: { itens: itens.map(aplicarSnapshotSolicitante), total }, error: null });
  } catch (err) {
    next(err);
  }
});

router.get("/pendentes", requirePerfil("APROVADOR", "ADMIN"), async (req, res, next) => {
  try {
    const { gerenteId, colaboradorId, justificativa, page = "1", pageSize = "50" } = req.query;
    const where = {
      status: "PENDENTE_APROVACAO",
      colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
      justificativa: justificativa || undefined,
      solicitacao: gerenteId ? { gerenteId: Number(gerenteId) } : undefined,
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [itens, total] = await Promise.all([
      prisma.solicitacaoItem.findMany({
        where,
        include: { colaborador: true, solicitacao: { include: { gerente: true, solicitante: true } } },
        orderBy: { criadoEm: "asc" },
        skip,
        take: Number(pageSize),
      }),
      prisma.solicitacaoItem.count({ where }),
    ]);
    res.json({ data: { itens: itens.map(aplicarSnapshotSolicitante), total }, error: null });
  } catch (err) {
    next(err);
  }
});

const decisaoSchema = z.object({
  itemIds: z.array(z.number().int()).min(1),
});

router.post("/aprovar", requirePerfil("APROVADOR", "ADMIN"), async (req, res, next) => {
  try {
    const { itemIds } = decisaoSchema.parse(req.body);
    const itens = await prisma.solicitacaoItem.findMany({ where: { id: { in: itemIds } } });
    const pendentes = itens.filter((i) => i.status === "PENDENTE_APROVACAO");

    await prisma.solicitacaoItem.updateMany({
      where: { id: { in: pendentes.map((i) => i.id) } },
      data: { status: "APROVADO", aprovadorId: req.usuario.id, dataDecisao: new Date() },
    });

    for (const item of pendentes) {
      await registrarAuditoria({ ...auditContext(req), acao: "APROVAR", entidade: "SolicitacaoItem", entidadeId: item.id, dadosAntes: item, dadosDepois: { status: "APROVADO" } });
    }

    res.json({ data: { aprovados: pendentes.length }, error: null });
  } catch (err) {
    next(err);
  }
});

const recusaSchema = z.object({
  itemIds: z.array(z.number().int()).min(1),
  motivo: z.string().min(1, "Motivo da recusa é obrigatório"),
});

router.post("/recusar", requirePerfil("APROVADOR", "ADMIN"), async (req, res, next) => {
  try {
    const { itemIds, motivo } = recusaSchema.parse(req.body);
    const itens = await prisma.solicitacaoItem.findMany({ where: { id: { in: itemIds } } });
    const pendentes = itens.filter((i) => i.status === "PENDENTE_APROVACAO");

    await prisma.solicitacaoItem.updateMany({
      where: { id: { in: pendentes.map((i) => i.id) } },
      data: { status: "RECUSADO", aprovadorId: req.usuario.id, dataDecisao: new Date(), motivoRecusa: motivo },
    });

    for (const item of pendentes) {
      await registrarAuditoria({ ...auditContext(req), acao: "RECUSAR", entidade: "SolicitacaoItem", entidadeId: item.id, dadosAntes: item, dadosDepois: { status: "RECUSADO", motivoRecusa: motivo } });
    }

    res.json({ data: { recusados: pendentes.length }, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
