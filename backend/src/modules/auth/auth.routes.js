const express = require("express");
const { z } = require("zod");
const authService = require("./auth.service");
const { requireAuth, loadUsuario } = require("../../middlewares/auth");
const { registrarAuditoria } = require("../../middlewares/audit");

const router = express.Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const solicitarAcessoSchema = z.object({
  email: z.string().email(),
});

router.post("/solicitar-acesso", async (req, res, next) => {
  try {
    const { email } = solicitarAcessoSchema.parse(req.body);
    const { usuario, situacao } = await authService.solicitarAcesso(email);

    const mensagem =
      situacao === "JA_ATIVO"
        ? "Seu usuário já está ativo. Você pode fazer login normalmente."
        : "Solicitação registrada com sucesso. Aguarde aprovação do administrador.";

    res.json({
      data: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cargoSolicitante: usuario.cargoSolicitante,
        status: usuario.status,
        mensagem,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const usuario = await authService.login(username, password);

    req.session.usuarioId = usuario.id;
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "LOGIN",
      entidade: "Usuario",
      entidadeId: usuario.id,
      ip: req.ip,
    });

    res.json({ data: { id: usuario.id, username: usuario.username, nome: usuario.nome, perfil: usuario.perfil }, error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const usuarioId = req.session.usuarioId;
    req.session.destroy(() => {});
    await registrarAuditoria({ usuarioId, acao: "LOGOUT", entidade: "Usuario", entidadeId: usuarioId, ip: req.ip });
    res.json({ data: true, error: null });
  } catch (err) {
    next(err);
  }
});

router.get("/me", loadUsuario, requireAuth, (req, res) => {
  const u = req.usuario;
  res.json({
    data: {
      id: u.id,
      username: u.username,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      status: u.status,
      gerente: u.gerente ? { id: u.gerente.id, nome: u.gerente.nome } : null,
    },
    error: null,
  });
});

module.exports = router;
