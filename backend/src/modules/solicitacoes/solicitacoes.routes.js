const express = require("express");
const { z } = require("zod");
const ExcelJS = require("exceljs");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");
const { expandirRascunho, resumoLimite, gerarProtocolo, statusGeral } = require("./solicitacoes.service");

const router = express.Router();

const TIPOS = ["PCT_50", "PCT_100"];
const JUSTIFICATIVAS = [
  "B2B_AVANCADO", "CELULA_AGENDAMENTO_REGIONAL", "IMPLANTACAO", "PROJETOS_ESPECIAIS",
  "BACKOFFICE", "REPARO", "PRODUCAO", "MANUTENCAO_DE_REDES", "MOVEL", "O_E_M",
];

const dataHorasSchema = z.object({
  data: z.string(),
  tipo: z.enum(TIPOS),
  horas: z.coerce.number().positive(),
});

const linhaSchema = z.object({
  colaboradorId: z.number().int(),
  justificativa: z.enum(JUSTIFICATIVAS),
  datas: z.array(dataHorasSchema).min(1),
});

const rascunhoSchema = z.object({
  gerenteId: z.number().int(),
  observacao: z.string().optional().nullable(),
  colaboradores: z.array(linhaSchema).min(1),
});

function deveRestringirPorGerente(req) {
  return !["ADMIN", "APROVADOR"].includes(req.usuario.perfil);
}

function gerenteVinculado(req) {
  if (!deveRestringirPorGerente(req)) return null;
  return req.usuario.gerenteId ? Number(req.usuario.gerenteId) : null;
}

function resolverGerenteFiltro(req, gerenteIdQuery) {
  const vinculado = gerenteVinculado(req);
  const gerenteQuery = gerenteIdQuery ? Number(gerenteIdQuery) : undefined;

  if (vinculado && gerenteQuery && gerenteQuery !== vinculado) {
    return { erro: "Usuário vinculado a outra gerência" };
  }

  return { gerenteId: vinculado || gerenteQuery };
}

router.post("/preview", async (req, res, next) => {
  try {
    const dados = rascunhoSchema.parse(req.body);
    const { gerenteId, erro } = resolverGerenteFiltro(req, dados.gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });

    const dadosComEscopo = { ...dados, gerenteId };
    const itens = await expandirRascunho(dadosComEscopo);
    const resumo = await resumoLimite({ gerenteId: dadosComEscopo.gerenteId, itens });
    res.json({ data: { itens, resumo }, error: null });
  } catch (err) {
    next(err);
  }
});

// Resumo do limite de um gerente sem nenhum item ainda — usado na Nova
// Solicitação para mostrar o Resumo de Limite assim que o gerente é
// selecionado, antes de qualquer colaborador/data ser preenchido.
router.get("/resumo-limite", async (req, res, next) => {
  try {
    const { gerenteId, erro } = resolverGerenteFiltro(req, req.query.gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });
    if (!gerenteId) return res.status(400).json({ data: null, error: "gerenteId é obrigatório" });
    const resumo = await resumoLimite({ gerenteId, itens: [] });
    res.json({ data: resumo, error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const dados = rascunhoSchema.parse(req.body);
    const { gerenteId, erro } = resolverGerenteFiltro(req, dados.gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });

    const dadosComEscopo = { ...dados, gerenteId };
    const itens = await expandirRascunho(dadosComEscopo);
    const protocolo = await gerarProtocolo();
    const gerenteRef = await prisma.gerente.findUnique({ where: { id: dadosComEscopo.gerenteId }, select: { nome: true } });

    const solicitacao = await prisma.solicitacao.create({
      data: {
        protocolo,
        gerenteId: dadosComEscopo.gerenteId,
        gerenteNomeSnapshot: gerenteRef?.nome || null,
        solicitanteId: req.usuario.id,
        solicitanteNomeSnapshot: req.usuario.nome || null,
        observacao: dadosComEscopo.observacao || null,
        itens: {
          create: itens.map((i) => ({
            colaboradorId: i.colaboradorId,
            colaboradorNomeSnapshot: i.colaboradorNome,
            dataHe: new Date(i.dataHe),
            tipo: i.tipo,
            horas: i.horas,
            justificativa: i.justificativa,
            valorHora: i.valorHora,
            valorCalculado: i.valorCalculado,
          })),
        },
      },
      include: { itens: true },
    });

    await registrarAuditoria({
      ...auditContext(req),
      acao: "CRIAR_SOLICITACAO",
      entidade: "Solicitacao",
      entidadeId: solicitacao.id,
      dadosDepois: { protocolo: solicitacao.protocolo, itens: solicitacao.itens.length },
    });

    res.status(201).json({ data: solicitacao, error: null });
  } catch (err) {
    next(err);
  }
});

function escopoPorPerfil(req) {
  const escopo = {};

  if (req.usuario.perfil === "SOLICITADOR") {
    escopo.solicitanteId = req.usuario.id;
  }

  const vinculado = gerenteVinculado(req);
  if (vinculado) {
    escopo.gerenteId = vinculado;
  }

  return escopo;
}

function aplicarSnapshotsSolicitacao(s) {
  return {
    ...s,
    gerente: { ...(s.gerente || {}), nome: s.gerenteNomeSnapshot || s.gerente?.nome || "Não informado" },
    solicitante: { ...(s.solicitante || {}), nome: s.solicitanteNomeSnapshot || s.solicitante?.nome || "Não informado" },
    itens: (s.itens || []).map((item) => ({
      ...item,
      colaborador: { ...(item.colaborador || {}), nome: item.colaboradorNomeSnapshot || item.colaborador?.nome || "Não informado" },
    })),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { status, gerenteId, colaboradorId, justificativa, solicitanteId, protocolo, dataInicio, dataFim, page = "1", pageSize = "50" } = req.query;
    const escopo = escopoPorPerfil(req);
    const { gerenteId: gerenteFiltro, erro } = resolverGerenteFiltro(req, gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });

    const where = {
      ...escopo,
      gerenteId: gerenteFiltro,
      solicitanteId: solicitanteId ? Number(solicitanteId) : undefined,
      protocolo: protocolo ? { contains: protocolo } : undefined,
      itens: {
        some: {
          status: status || undefined,
          colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
          justificativa: justificativa || undefined,
          dataHe: dataInicio || dataFim ? { gte: dataInicio ? new Date(dataInicio) : undefined, lte: dataFim ? new Date(dataFim) : undefined } : undefined,
        },
      },
    };

    const skip = (Number(page) - 1) * Number(pageSize);
    const [solicitacoes, total] = await Promise.all([
      prisma.solicitacao.findMany({
        where,
        include: { gerente: true, solicitante: true, itens: { include: { colaborador: true } } },
        orderBy: { criadoEm: "desc" },
        skip,
        take: Number(pageSize),
      }),
      prisma.solicitacao.count({ where }),
    ]);

    const comStatus = solicitacoes.map((s) => {
      const comSnapshot = aplicarSnapshotsSolicitacao(s);
      return { ...comSnapshot, statusGeral: statusGeral(comSnapshot.itens) };
    });
    res.json({ data: { itens: comStatus, total }, error: null });
  } catch (err) {
    next(err);
  }
});

// Lista de usuários que já criaram alguma solicitação, para o filtro
// "Solicitante" da fila. Só id e nome — sem dados sensíveis, então não
// precisa ser restrito a ADMIN como o /usuarios.
router.get("/solicitantes", async (req, res, next) => {
  try {
    const { gerenteId: gerenteFiltro } = resolverGerenteFiltro(req, undefined);
    const where = gerenteFiltro ? { gerenteId: gerenteFiltro } : undefined;
    const grupos = await prisma.solicitacao.groupBy({ by: ["solicitanteId"], where });
    const solicitanteIds = grupos.map((g) => g.solicitanteId).filter((id) => id != null);
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: solicitanteIds } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    res.json({ data: usuarios, error: null });
  } catch (err) {
    next(err);
  }
});

router.get("/export", async (req, res, next) => {
  try {
    const { status, gerenteId, colaboradorId, justificativa } = req.query;
    const escopo = escopoPorPerfil(req);
    const { gerenteId: gerenteFiltro, erro } = resolverGerenteFiltro(req, gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });

    const where = {
      ...escopo,
      gerenteId: gerenteFiltro,
      itens: { some: { status: status || undefined, colaboradorId: colaboradorId ? Number(colaboradorId) : undefined, justificativa: justificativa || undefined } },
    };
    const solicitacoes = await prisma.solicitacao.findMany({
      where,
      include: { gerente: true, solicitante: true, itens: { include: { colaborador: true } } },
      orderBy: { criadoEm: "desc" },
    });

    const solicitacoesComSnapshot = solicitacoes.map(aplicarSnapshotsSolicitacao);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Solicitações");
    ws.columns = [
      { header: "Protocolo", key: "protocolo", width: 18 },
      { header: "Data Solicitação", key: "dataSolicitacao", width: 16 },
      { header: "Gerente", key: "gerente", width: 28 },
      { header: "Colaborador", key: "colaborador", width: 28 },
      { header: "Data HE", key: "dataHe", width: 12 },
      { header: "Tipo", key: "tipo", width: 10 },
      { header: "Horas", key: "horas", width: 8 },
      { header: "Valor", key: "valor", width: 12, style: { numFmt: '"R$" #,##0.00' } },
      { header: "Justificativa", key: "justificativa", width: 24 },
      { header: "Status", key: "status", width: 18 },
      { header: "Solicitante", key: "solicitante", width: 24 },
    ];
    for (const s of solicitacoesComSnapshot) {
      for (const item of s.itens) {
        ws.addRow({
          protocolo: s.protocolo,
          dataSolicitacao: s.criadoEm,
          gerente: s.gerente.nome,
          colaborador: item.colaborador.nome,
          dataHe: item.dataHe,
          tipo: item.tipo,
          horas: Number(item.horas),
          valor: Number(item.valorCalculado),
          justificativa: item.justificativa,
          status: item.status,
          solicitante: s.solicitante.nome,
        });
      }
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=solicitacoes.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
      include: { gerente: true, solicitante: true, itens: { include: { colaborador: true, aprovador: true } } },
    });
    if (!solicitacao) return res.status(404).json({ data: null, error: "Solicitação não encontrada" });
    const solicitacaoComSnapshot = aplicarSnapshotsSolicitacao(solicitacao);
    const vinculado = gerenteVinculado(req);
    if (vinculado && solicitacaoComSnapshot.gerenteId !== vinculado) {
      return res.status(403).json({ data: null, error: "Sem permissão para ver solicitações de outra gerência" });
    }
    if (req.usuario.perfil === "SOLICITADOR" && solicitacaoComSnapshot.solicitanteId !== req.usuario.id) {
      return res.status(403).json({ data: null, error: "Sem permissão para ver esta solicitação" });
    }
    res.json({ data: { ...solicitacaoComSnapshot, statusGeral: statusGeral(solicitacaoComSnapshot.itens) }, error: null });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id }, include: { itens: true } });
    if (!solicitacao) return res.status(404).json({ data: null, error: "Solicitação não encontrada" });
    const isAdmin = req.usuario.perfil === "ADMIN";
    if (!isAdmin && solicitacao.solicitanteId !== req.usuario.id) {
      return res.status(403).json({ data: null, error: "Apenas o autor pode editar" });
    }
    if (!isAdmin && solicitacao.itens.some((i) => i.status === "APROVADO")) {
      return res.status(409).json({ data: null, error: "Solicitação possui itens aprovados e não pode ser editada" });
    }

    const { observacao } = z.object({ observacao: z.string().optional().nullable() }).parse(req.body);
    const atualizada = await prisma.solicitacao.update({ where: { id }, data: { observacao } });

    await registrarAuditoria({ ...auditContext(req), acao: "EDITAR_SOLICITACAO", entidade: "Solicitacao", entidadeId: id, dadosAntes: solicitacao, dadosDepois: atualizada });
    res.json({ data: atualizada, error: null });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id }, include: { itens: true } });
    if (!solicitacao) return res.status(404).json({ data: null, error: "Solicitação não encontrada" });
    if (solicitacao.solicitanteId !== req.usuario.id) {
      return res.status(403).json({ data: null, error: "Apenas o autor pode excluir" });
    }
    if (solicitacao.itens.some((i) => i.status === "APROVADO")) {
      return res.status(409).json({ data: null, error: "Solicitação possui itens aprovados; exclua apenas os itens não aprovados" });
    }

    await prisma.solicitacao.delete({ where: { id } });
    await registrarAuditoria({ ...auditContext(req), acao: "EXCLUIR_SOLICITACAO", entidade: "Solicitacao", entidadeId: id, dadosAntes: solicitacao });
    res.json({ data: true, error: null });
  } catch (err) {
    next(err);
  }
});

const editarItemSchema = z.object({
  dataHe: z.string().optional(),
  tipo: z.enum(TIPOS).optional(),
  horas: z.coerce.number().positive().optional(),
  justificativa: z.enum(JUSTIFICATIVAS).optional(),
});

router.put("/itens/:itemId", async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const item = await prisma.solicitacaoItem.findUnique({
      where: { id: itemId },
      include: { solicitacao: true, colaborador: { include: { cargo: true } } },
    });
    if (!item) return res.status(404).json({ data: null, error: "Item não encontrado" });
    const isAdmin = req.usuario.perfil === "ADMIN";
    if (!isAdmin && item.solicitacao.solicitanteId !== req.usuario.id) {
      return res.status(403).json({ data: null, error: "Apenas o autor pode editar" });
    }
    if (!isAdmin && item.status === "APROVADO") {
      return res.status(409).json({ data: null, error: "Item aprovado não pode ser editado" });
    }

    const dados = editarItemSchema.parse(req.body);
    const tipo = dados.tipo || item.tipo;
    const horas = dados.horas ?? Number(item.horas);
    const { calcularItem } = require("../../utils/calculoHe");
    const { valorHora, valorCalculado } = calcularItem({ cargo: item.colaborador.cargo, tipo, horas });

    const atualizado = await prisma.solicitacaoItem.update({
      where: { id: itemId },
      data: {
        dataHe: dados.dataHe ? new Date(dados.dataHe) : undefined,
        tipo,
        horas,
        justificativa: dados.justificativa,
        valorHora,
        valorCalculado,
        status: "PENDENTE_APROVACAO",
      },
    });

    await registrarAuditoria({ ...auditContext(req), acao: "EDITAR_ITEM_SOLICITACAO", entidade: "SolicitacaoItem", entidadeId: itemId, dadosAntes: item, dadosDepois: atualizado });
    res.json({ data: atualizado, error: null });
  } catch (err) {
    next(err);
  }
});

router.delete("/itens/:itemId", async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const item = await prisma.solicitacaoItem.findUnique({ where: { id: itemId }, include: { solicitacao: true } });
    if (!item) return res.status(404).json({ data: null, error: "Item não encontrado" });
    if (item.solicitacao.solicitanteId !== req.usuario.id) {
      return res.status(403).json({ data: null, error: "Apenas o autor pode excluir" });
    }
    if (item.status === "APROVADO") {
      return res.status(409).json({ data: null, error: "Item aprovado não pode ser excluído" });
    }

    await prisma.solicitacaoItem.delete({ where: { id: itemId } });
    await registrarAuditoria({ ...auditContext(req), acao: "EXCLUIR_ITEM_SOLICITACAO", entidade: "SolicitacaoItem", entidadeId: itemId, dadosAntes: item });
    res.json({ data: true, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
