const express = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");

const router = express.Router();

router.get("/", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const { status, perfil, q } = req.query;
    const usuarios = await prisma.usuario.findMany({
      where: {
        status: status || undefined,
        perfil: perfil || undefined,
        ...(q
          ? { OR: [{ nome: { contains: q } }, { username: { contains: q } }, { email: { contains: q } }] }
          : {}),
      },
      include: { gerente: true },
      orderBy: { criadoEm: "desc" },
    });
    res.json({ data: usuarios, error: null });
  } catch (err) {
    next(err);
  }
});

const criarSchema = z.object({
  username: z.string().min(1),
  nome: z.string().min(1),
  email: z.string().email().optional().nullable(),
  perfil: z.enum(["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"]).default("SOLICITADOR"),
  gerenteId: z.number().int().optional().nullable(),
  status: z.enum(["PENDENTE", "ATIVO", "INATIVO"]).default("ATIVO"),
});

function normalizarUsuarioEntrada(dados) {
  if (dados.perfil === "APROVADOR") {
    return { ...dados, gerenteId: null };
  }
  return dados;
}

router.post("/", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const dados = normalizarUsuarioEntrada(criarSchema.parse(req.body));
    const usuario = await prisma.usuario.create({ data: dados });
    await registrarAuditoria({
      ...auditContext(req),
      acao: "CRIAR_USUARIO",
      entidade: "Usuario",
      entidadeId: usuario.id,
      dadosDepois: usuario,
    });
    res.status(201).json({ data: usuario, error: null });
  } catch (err) {
    next(err);
  }
});

const editarSchema = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  perfil: z.enum(["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"]).optional(),
  gerenteId: z.number().int().optional().nullable(),
  status: z.enum(["PENDENTE", "ATIVO", "INATIVO"]).optional(),
});

router.put("/:id", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const dados = normalizarUsuarioEntrada(editarSchema.parse(req.body));
    const antes = await prisma.usuario.findUnique({ where: { id } });
    const usuario = await prisma.usuario.update({ where: { id }, data: dados });
    await registrarAuditoria({
      ...auditContext(req),
      acao: "EDITAR_USUARIO",
      entidade: "Usuario",
      entidadeId: id,
      dadosAntes: antes,
      dadosDepois: usuario,
    });
    res.json({ data: usuario, error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/aprovar", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const antes = await prisma.usuario.findUnique({ where: { id } });
    const usuario = await prisma.usuario.update({ where: { id }, data: { status: "ATIVO" } });
    await registrarAuditoria({
      ...auditContext(req),
      acao: "APROVAR_USUARIO",
      entidade: "Usuario",
      entidadeId: id,
      dadosAntes: antes,
      dadosDepois: usuario,
    });
    res.json({ data: usuario, error: null });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.usuario.id) {
      return res.status(400).json({ data: null, error: "Você não pode excluir seu próprio usuário" });
    }

    const antes = await prisma.usuario.findUnique({ where: { id } });
    if (!antes) {
      return res.status(404).json({ data: null, error: "Usuário não encontrado" });
    }

    await prisma.usuario.delete({ where: { id } });

    await registrarAuditoria({
      ...auditContext(req),
      acao: "EXCLUIR_USUARIO",
      entidade: "Usuario",
      entidadeId: id,
      dadosAntes: antes,
    });

    res.json({ data: true, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
