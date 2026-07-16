const prisma = require("../../config/prisma");
const env = require("../../config/env");
const logger = require("../../config/logger");

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.status = 401;
    this.expose = true;
  }
}

// Um usuário de teste por perfil, para exercitar a matriz de permissões em
// desenvolvimento sem depender do AD. DEV_USER/DEV_PASSWORD/DEV_PERFIL
// continuam válidos (compatibilidade com o .env original).
const DEV_USERS = [
  { username: env.DEV_USER, password: env.DEV_PASSWORD, perfil: env.DEV_PERFIL, nome: "Administrador (DEV)" },
  { username: env.DEV_USER_SOLICITADOR, password: env.DEV_PASSWORD_SOLICITADOR, perfil: "SOLICITADOR", nome: "Solicitador (DEV)" },
  { username: env.DEV_USER_APROVADOR, password: env.DEV_PASSWORD_APROVADOR, perfil: "APROVADOR", nome: "Aprovador (DEV)" },
  { username: env.DEV_USER_FOCAL, password: env.DEV_PASSWORD_FOCAL, perfil: "FOCAL", nome: "Focal (DEV)" },
  { username: env.DEV_USER_ADMIN, password: env.DEV_PASSWORD_ADMIN, perfil: "ADMIN", nome: "Administrador (DEV)" },
].filter((u) => u.username && u.password);

// Em producao, somente o admin local pode fazer bypass de LDAP.
const DEV_ADMIN_USERS = DEV_USERS.filter((u) => u.perfil === "ADMIN");

function normalizarUsername(username) {
  return String(username || "").trim();
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function candidatosBuscaAd(identificador) {
  const valor = String(identificador || "").trim();
  if (!valor) return [];
  const local = valor.includes("@") ? valor.split("@")[0] : valor;

  return [...new Set([
    valor,
    local,
    `${local}@${env.LDAP_DOMAIN}`,
  ])];
}

async function buscarUsuarioAd(identificador) {
  const ad = require("../../config/ldap");
  const tentativas = candidatosBuscaAd(identificador);

  for (const tentativa of tentativas) {
    const adUser = await new Promise((resolve, reject) => {
      ad.findUser(tentativa, (err, user) => {
        if (err) return reject(err);
        resolve(user || null);
      });
    });
    if (adUser) return adUser;
  }

  return null;
}

async function loginDev(username, password) {
  const encontrado = DEV_USERS.find((u) => u.username === username && u.password === password);
  if (!encontrado) {
    throw new AuthError("Credenciais inválidas");
  }

  const usuario = await prisma.usuario.upsert({
    where: { username },
    update: { status: "ATIVO" },
    create: {
      username,
      nome: encontrado.nome,
      email: username.includes("@") ? username : null,
      perfil: encontrado.perfil,
      status: "ATIVO",
    },
  });

  return usuario;
}

async function loginLdap(username, password) {
  // config/ldap.js exporta um singleton configurado com a conta de serviço
  // (LDAP_USER/LDAP_PASS) usada para buscas (findUser/isUserMemberOf).
  // authenticate() faz bind direto com as credenciais do próprio usuário,
  // independente da conta de serviço configurada.
  const ad = require("../../config/ldap");

  const usernameNormalizado = normalizarUsername(username);
  const userPrincipal = usernameNormalizado.includes("@") ? usernameNormalizado : `${usernameNormalizado}@${env.LDAP_DOMAIN}`;

  await new Promise((resolve, reject) => {
    ad.authenticate(userPrincipal, password, (err, auth) => {
      if (err) return reject(new AuthError("Credenciais inválidas"));
      if (!auth) return reject(new AuthError("Credenciais inválidas"));
      resolve();
    });
  });

  if (env.LDAP_GRUPO_ACESSO) {
    const isMember = await new Promise((resolve, reject) => {
      ad.isUserMemberOf(userPrincipal, env.LDAP_GRUPO_ACESSO, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    if (!isMember) {
      throw new AuthError("Usuário não pertence ao grupo de acesso ao sistema");
    }
  }

  let adUser = await buscarUsuarioAd(userPrincipal);

  if (!adUser) {
    logger.warn({ userPrincipal }, "LDAP autenticou, mas findUser não localizou o usuário; aplicando fallback");
    adUser = {
      displayName: usernameNormalizado,
      mail: usernameNormalizado.includes("@") ? usernameNormalizado : null,
    };
  }

  let usuario = await prisma.usuario.findUnique({ where: { username: usernameNormalizado } });

  if (!usuario) {
    usuario = await prisma.usuario.create({
      data: {
        username: usernameNormalizado,
        nome: adUser.displayName || adUser.cn || usernameNormalizado,
        email: adUser.mail || null,
        status: "PENDENTE",
      },
    });
  }

  if (usuario.status === "PENDENTE") {
    throw new AuthError("Cadastro aguardando aprovação do administrador");
  }
  if (usuario.status === "INATIVO") {
    throw new AuthError("Acesso desativado");
  }

  return usuario;
}

async function solicitarAcesso(email) {
  const emailNormalizado = normalizarEmail(email);
  if (!emailNormalizado.endsWith("@telefonica.com")) {
    throw new AuthError("Informe um e-mail corporativo @telefonica.com");
  }

  const adUser = await buscarUsuarioAd(emailNormalizado);
  if (!adUser) {
    throw new AuthError("Usuário não encontrado no AD");
  }

  const nome = adUser.displayName || adUser.cn || emailNormalizado;
  const cargoSolicitante = adUser.title || adUser.description || null;

  const existente = await prisma.usuario.findFirst({
    where: {
      OR: [
        { username: emailNormalizado },
        { email: emailNormalizado },
      ],
    },
  });

  if (existente) {
    const statusAtual = existente.status === "ATIVO" ? "ATIVO" : "PENDENTE";
    const usuario = await prisma.usuario.update({
      where: { id: existente.id },
      data: {
        nome,
        email: emailNormalizado,
        cargoSolicitante,
        status: statusAtual,
      },
    });

    return {
      usuario,
      situacao: statusAtual === "ATIVO" ? "JA_ATIVO" : "PENDENTE",
    };
  }

  const usuario = await prisma.usuario.create({
    data: {
      username: emailNormalizado,
      nome,
      email: emailNormalizado,
      cargoSolicitante,
      perfil: "SOLICITADOR",
      status: "PENDENTE",
    },
  });

  return { usuario, situacao: "CRIADO_PENDENTE" };
}

async function login(username, password) {
  try {
    const usernameNormalizado = normalizarUsername(username);

    if (env.NODE_ENV === "development") {
      return await loginDev(usernameNormalizado, password);
    }

    const adminLocal = DEV_ADMIN_USERS.find((u) => u.username === usernameNormalizado && u.password === password);
    if (adminLocal) {
      return await loginDev(usernameNormalizado, password);
    }

    return await loginLdap(usernameNormalizado, password);
  } catch (err) {
    if (err instanceof AuthError) throw err;
    logger.error({ err }, "Falha no login");
    throw new AuthError("Falha ao autenticar. Tente novamente.");
  }
}

module.exports = { login, solicitarAcesso, AuthError };
