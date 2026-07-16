const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");
const { importarUsuarios } = require("./usuarios.import");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

router.get("/modelo", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    // Usa um gerente de verdade já cadastrado como exemplo (em vez de um texto
    // solto tipo "nome do gerente aqui"), para que o modelo baixado já possa
    // ser importado sem erro, se o admin só quiser testar o fluxo.
    const gerenteExemplo = await prisma.gerente.findFirst({ orderBy: { nome: "asc" } });
    const nomeGerente = gerenteExemplo?.nome || "";

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Usuarios");
    ws.columns = [
      { header: "USERNAME", key: "username", width: 24 },
      { header: "NOME", key: "nome", width: 32 },
      { header: "EMAIL", key: "email", width: 30 },
      { header: "PERFIL", key: "perfil", width: 16 },
      { header: "GERENTE", key: "gerente", width: 28 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.addRow({ username: "joao.silva", nome: "João da Silva", email: "joao.silva@empresa.com", perfil: "SOLICITADOR", gerente: nomeGerente });
    ws.addRow({ username: "maria.souza", nome: "Maria Souza", email: "maria.souza@empresa.com", perfil: "APROVADOR", gerente: "" });
    ws.addRow({ username: "carlos.lima", nome: "Carlos Lima", email: "carlos.lima@empresa.com", perfil: "FOCAL", gerente: nomeGerente });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=modelo_usuarios.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

router.post("/importar", requirePerfil("ADMIN"), upload.single("arquivo"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ data: null, error: "Arquivo não enviado" });
    }
    const commit = req.query.commit === "true";
    const resultado = await importarUsuarios(req.file.buffer, req.file.originalname, req.usuario.id, commit);
    if (commit) {
      await registrarAuditoria({
        ...auditContext(req),
        acao: "IMPORTAR_USUARIOS",
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
