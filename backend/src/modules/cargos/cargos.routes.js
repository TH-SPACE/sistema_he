const express = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { q, ativo } = req.query;
    const cargos = await prisma.cargo.findMany({
      where: {
        ativo: ativo != null ? ativo === "true" : undefined,
        ...(q ? { nome: { contains: q } } : {}),
      },
      orderBy: { nome: "asc" },
    });
    res.json({ data: cargos, error: null });
  } catch (err) {
    next(err);
  }
});

const schema = z.object({
  nome: z.string().min(1),
  valorHora50: z.coerce.number().positive(),
  valorHora100: z.coerce.number().positive(),
  ativo: z.boolean().optional(),
});

router.post("/", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const cargo = await prisma.cargo.create({ data: dados });
    await registrarAuditoria({ ...auditContext(req), acao: "CRIAR_CARGO", entidade: "Cargo", entidadeId: cargo.id, dadosDepois: cargo });
    res.status(201).json({ data: cargo, error: null });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const dados = schema.partial().parse(req.body);
    const antes = await prisma.cargo.findUnique({ where: { id } });
    const cargo = await prisma.cargo.update({ where: { id }, data: dados });
    await registrarAuditoria({ ...auditContext(req), acao: "EDITAR_CARGO", entidade: "Cargo", entidadeId: id, dadosAntes: antes, dadosDepois: cargo });
    res.json({ data: cargo, error: null });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const antes = await prisma.cargo.findUnique({ where: { id } });
    const cargo = await prisma.cargo.update({ where: { id }, data: { ativo: false } });
    await registrarAuditoria({ ...auditContext(req), acao: "DESATIVAR_CARGO", entidade: "Cargo", entidadeId: id, dadosAntes: antes, dadosDepois: cargo });
    res.json({ data: cargo, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
