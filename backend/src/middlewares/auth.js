const prisma = require("../config/prisma");

function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({ data: null, error: "Não autenticado" });
  }
  next();
}

async function loadUsuario(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return next();
  }
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.session.usuarioId },
      include: { gerente: true },
    });
    if (usuario) {
      req.usuario = usuario;
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, loadUsuario };
