function requirePerfil(...perfis) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ data: null, error: "Não autenticado" });
    }
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ data: null, error: "Sem permissão para esta ação" });
    }
    next();
  };
}

module.exports = { requirePerfil };
