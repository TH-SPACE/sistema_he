const express = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");

const router = express.Router();

function filtroGerentePorUsuario(req) {
  if (["ADMIN", "APROVADOR"].includes(req.usuario.perfil)) return {};
  if (req.usuario.gerenteId) return { id: Number(req.usuario.gerenteId) };
  return {};
}

router.get("/", async (req, res, next) => {
  try {
    const { q, ativo } = req.query;
    const filtroEscopo = filtroGerentePorUsuario(req);
    const gerentes = await prisma.gerente.findMany({
      where: {
        ...filtroEscopo,
        ativo: ativo != null ? ativo === "true" : undefined,
        ...(q ? { nome: { contains: q } } : {}),
      },
      orderBy: { nome: "asc" },
    });
    res.json({ data: gerentes, error: null });
  } catch (err) {
    next(err);
  }
});

const schema = z.object({
  nome: z.string().min(1),
  valorLimite: z.coerce.number().positive(),
  gerenciaSr: z.string().trim().min(1).optional().nullable(),
  ativo: z.boolean().optional(),
});

router.post("/", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const gerente = await prisma.gerente.create({ data: dados });
    await registrarAuditoria({ ...auditContext(req), acao: "CRIAR_GERENTE", entidade: "Gerente", entidadeId: gerente.id, dadosDepois: gerente });
    res.status(201).json({ data: gerente, error: null });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const dados = schema.partial().parse(req.body);
    const antes = await prisma.gerente.findUnique({ where: { id } });
    const gerente = await prisma.gerente.update({ where: { id }, data: dados });
    await registrarAuditoria({ ...auditContext(req), acao: "EDITAR_GERENTE", entidade: "Gerente", entidadeId: id, dadosAntes: antes, dadosDepois: gerente });
    res.json({ data: gerente, error: null });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const antes = await prisma.gerente.findUnique({ where: { id } });
    const gerente = await prisma.gerente.update({ where: { id }, data: { ativo: false } });
    await registrarAuditoria({ ...auditContext(req), acao: "DESATIVAR_GERENTE", entidade: "Gerente", entidadeId: id, dadosAntes: antes, dadosDepois: gerente });
    res.json({ data: gerente, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
