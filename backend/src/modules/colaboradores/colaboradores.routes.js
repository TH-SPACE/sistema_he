const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");
const { importarColaboradores } = require("./colaboradores.import");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", async (req, res, next) => {
  try {
    const { q, gerenteId, cargoId, ativo, page = "1", pageSize = "50" } = req.query;
    const where = {
      ativo: ativo != null ? ativo === "true" : undefined,
      gerenteId: gerenteId ? Number(gerenteId) : undefined,
      cargoId: cargoId ? Number(cargoId) : undefined,
      ...(q ? { OR: [{ nome: { contains: q } }, { matricula: { contains: q } }] } : {}),
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [itens, total] = await Promise.all([
      prisma.colaborador.findMany({
        where,
        include: { cargo: true, gerente: true },
        orderBy: { nome: "asc" },
        skip,
        take: Number(pageSize),
      }),
      prisma.colaborador.count({ where }),
    ]);
    res.json({ data: { itens, total }, error: null });
  } catch (err) {
    next(err);
  }
});

// usado pelo Select pesquisável na tela de Nova Solicitação
router.get("/lookup", async (req, res, next) => {
  try {
    const { gerenteId, q } = req.query;
    const colaboradores = await prisma.colaborador.findMany({
      where: {
        ativo: true,
        gerenteId: gerenteId ? Number(gerenteId) : undefined,
        ...(q ? { OR: [{ nome: { contains: q } }, { matricula: { contains: q } }] } : {}),
      },
      include: { cargo: true },
      orderBy: { nome: "asc" },
      take: 50,
    });
    res.json({ data: colaboradores, error: null });
  } catch (err) {
    next(err);
  }
});

const schema = z.object({
  matricula: z.string().min(1),
  nome: z.string().min(1),
  cargoId: z.number().int(),
  gerenteId: z.number().int(),
  gerencia: z.string().optional().nullable(),
  regional: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  gestorDireto: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.post("/", requirePerfil("FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const colaborador = await prisma.colaborador.create({ data: dados });
    await registrarAuditoria({ ...auditContext(req), acao: "CRIAR_COLABORADOR", entidade: "Colaborador", entidadeId: colaborador.id, dadosDepois: colaborador });
    res.status(201).json({ data: colaborador, error: null });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requirePerfil("FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const dados = schema.partial().parse(req.body);
    const antes = await prisma.colaborador.findUnique({ where: { id } });
    const colaborador = await prisma.colaborador.update({ where: { id }, data: dados });
    await registrarAuditoria({ ...auditContext(req), acao: "EDITAR_COLABORADOR", entidade: "Colaborador", entidadeId: id, dadosAntes: antes, dadosDepois: colaborador });
    res.json({ data: colaborador, error: null });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePerfil("FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const antes = await prisma.colaborador.findUnique({ where: { id } });
    const colaborador = await prisma.colaborador.update({ where: { id }, data: { ativo: false } });
    await registrarAuditoria({ ...auditContext(req), acao: "DESATIVAR_COLABORADOR", entidade: "Colaborador", entidadeId: id, dadosAntes: antes, dadosDepois: colaborador });
    res.json({ data: colaborador, error: null });
  } catch (err) {
    next(err);
  }
});

// Exclusão definitiva (só ADMIN): diferente do DELETE acima, que apenas
// desativa. SolicitacaoItem.colaboradorId é ON DELETE SET NULL, então itens
// de HE já solicitados para este colaborador continuam no banco (com
// colaboradorNomeSnapshot preservando o nome) mesmo depois de excluído — só
// perde o vínculo com o cadastro, não o histórico.
router.delete("/:id/permanente", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const antes = await prisma.colaborador.findUnique({ where: { id } });
    if (!antes) {
      return res.status(404).json({ data: null, error: "Colaborador não encontrado" });
    }

    try {
      await prisma.colaborador.delete({ where: { id } });
    } catch (err) {
      if (err.code === "P2003") {
        return res.status(409).json({ data: null, error: "Não é possível excluir: este colaborador possui vínculos que impedem a exclusão." });
      }
      throw err;
    }

    await registrarAuditoria({ ...auditContext(req), acao: "EXCLUIR_COLABORADOR", entidade: "Colaborador", entidadeId: id, dadosAntes: antes });
    res.json({ data: true, error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/importar", requirePerfil("FOCAL", "ADMIN"), upload.single("arquivo"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ data: null, error: "Arquivo não enviado" });
    }
    const commit = req.query.commit === "true";
    const resultado = await importarColaboradores(req.file.buffer, req.file.originalname, req.usuario.id, commit);
    if (commit) {
      await registrarAuditoria({
        ...auditContext(req),
        acao: "IMPORTAR_COLABORADORES",
        entidade: "LoteImportacao",
        entidadeId: resultado.loteId,
        dadosDepois: { totalLinhas: resultado.totalLinhas, inseridos: resultado.inseridos, erros: resultado.erros },
      });
    }
    res.json({ data: resultado, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
