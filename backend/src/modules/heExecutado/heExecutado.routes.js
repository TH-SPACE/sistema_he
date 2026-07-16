const express = require("express");
const multer = require("multer");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");
const { importarHeExecutado } = require("./heExecutado.import");
const { normalizarNome } = require("../../utils/texto");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function gerenteEscopoUsuario(req) {
  if (["ADMIN", "APROVADOR"].includes(req.usuario.perfil)) return null;
  return req.usuario.gerenteId ? Number(req.usuario.gerenteId) : null;
}

function resolverGerenteFiltro(req, gerenteIdQuery) {
  const gerenteEscopo = gerenteEscopoUsuario(req);
  const semGerencia = gerenteIdQuery === "sem-gerencia";
  const gerenteQuery = gerenteIdQuery && !semGerencia ? Number(gerenteIdQuery) : undefined;

  if (gerenteEscopo && (semGerencia || (gerenteQuery && gerenteQuery !== gerenteEscopo))) {
    return { erro: "Usuário vinculado a outra gerência" };
  }

  return {
    gerenteId: gerenteEscopo || gerenteQuery,
    semGerencia: !gerenteEscopo && semGerencia,
  };
}

// Calcula o valor em R$ de cada linha de HE executado, cruzando por nome com
// o colaborador para achar o cargo/valor de hora (a base executada não traz
// valor, só horas). Usado pelos gráficos da tela.
async function comValorExecutado(execRows, gerenteIdEscopo) {
  const colaboradores = await prisma.colaborador.findMany({
    where: gerenteIdEscopo ? { gerenteId: Number(gerenteIdEscopo) } : undefined,
    include: { cargo: true },
  });
  const porNome = new Map(colaboradores.map((c) => [normalizarNome(c.nome), c]));
  return execRows
    .filter((e) => !gerenteIdEscopo || porNome.has(normalizarNome(e.nome)))
    .map((e) => {
    const colaborador = porNome.get(normalizarNome(e.nome));
    const valorHora = colaborador ? (e.tipo === "PCT_100" ? Number(colaborador.cargo.valorHora100) : Number(colaborador.cargo.valorHora50)) : 0;
    return { ...e, valor: Number(e.horas) * valorHora };
  });
}

function competenciasAnteriores(competencia, quantidade) {
  const [anoStr, mesStr] = competencia.split("-");
  let ano = Number(anoStr);
  let mes = Number(mesStr);
  const lista = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    let m = mes - i;
    let a = ano;
    while (m <= 0) {
      m += 12;
      a -= 1;
    }
    lista.push(`${a}-${String(m).padStart(2, "0")}`);
  }
  return lista;
}

// Gráfico "Executado nos últimos 3 meses": total de horas/valor executado
// por competência, terminando no mês/ano selecionado na tela.
router.get("/grafico-mensal", requirePerfil("SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const { competencia } = req.query;
    const gerenteEscopo = gerenteEscopoUsuario(req);
    if (!competencia) return res.status(400).json({ data: null, error: "competência é obrigatória (YYYY-MM)" });

    const competencias = competenciasAnteriores(competencia, 3);
    const execs = await prisma.heExecutado.findMany({ where: { competencia: { in: competencias }, tipo: { not: null } } });
    const comValor = await comValorExecutado(execs, gerenteEscopo);

    const porCompetencia = new Map(competencias.map((c) => [c, { competencia: c, horas: 0, valor: 0 }]));
    for (const e of comValor) {
      const reg = porCompetencia.get(e.competencia);
      if (!reg) continue;
      reg.horas += Number(e.horas);
      reg.valor += e.valor;
    }

    const linhas = competencias.map((c) => {
      const r = porCompetencia.get(c);
      return { competencia: c, horas: Number(r.horas.toFixed(2)), valor: Number(r.valor.toFixed(2)) };
    });
    res.json({ data: linhas, error: null });
  } catch (err) {
    next(err);
  }
});

// Gráfico "Executado por Tipo de Posição": total de horas/valor executado no
// mês selecionado, agrupado pela coluna TIPO POSICAO 2 da planilha.
router.get("/grafico-tipo-posicao", requirePerfil("SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const { competencia } = req.query;
    const gerenteEscopo = gerenteEscopoUsuario(req);
    if (!competencia) return res.status(400).json({ data: null, error: "competência é obrigatória (YYYY-MM)" });

    const execs = await prisma.heExecutado.findMany({ where: { competencia, tipo: { not: null } } });
    const comValor = await comValorExecutado(execs, gerenteEscopo);

    // Agrupado por TIPO POSICAO 2 e quebrado por 50%/100%, para o gráfico
    // mostrar as duas colunas lado a lado dentro de cada categoria.
    const porTipoEPct = new Map();
    const totalPorTipo = new Map();
    for (const e of comValor) {
      const chave = e.tipoPosicao2 || "Não informado";
      const chaveCompleta = `${chave}|${e.tipo}`;
      if (!porTipoEPct.has(chaveCompleta)) porTipoEPct.set(chaveCompleta, { tipoPosicao2: chave, tipo: e.tipo, horas: 0, valor: 0 });
      const reg = porTipoEPct.get(chaveCompleta);
      reg.horas += Number(e.horas);
      reg.valor += e.valor;

      totalPorTipo.set(chave, (totalPorTipo.get(chave) || 0) + Number(e.horas));
    }

    const ordemTipoPosicao = [...totalPorTipo.entries()].sort((a, b) => b[1] - a[1]).map(([chave]) => chave);
    const linhas = [...porTipoEPct.values()]
      .map((r) => ({ ...r, horas: Number(r.horas.toFixed(2)), valor: Number(r.valor.toFixed(2)) }))
      .sort((a, b) => {
        const diff = ordemTipoPosicao.indexOf(a.tipoPosicao2) - ordemTipoPosicao.indexOf(b.tipoPosicao2);
        return diff !== 0 ? diff : a.tipo.localeCompare(b.tipo);
      });
    res.json({ data: linhas, error: null });
  } catch (err) {
    next(err);
  }
});

// Gráfico "Executado por Cargo Agrupado": mesma lógica do gráfico por Tipo de
// Posição, mas agrupado pela coluna CARGO AGRUPADO da planilha.
router.get("/grafico-cargo-agrupado", requirePerfil("SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const { competencia } = req.query;
    const gerenteEscopo = gerenteEscopoUsuario(req);
    if (!competencia) return res.status(400).json({ data: null, error: "competência é obrigatória (YYYY-MM)" });

    const execs = await prisma.heExecutado.findMany({ where: { competencia, tipo: { not: null } } });
    const comValor = await comValorExecutado(execs, gerenteEscopo);

    const porCargoEPct = new Map();
    const totalPorCargo = new Map();
    for (const e of comValor) {
      const chave = e.cargoAgrupado || "Não informado";
      const chaveCompleta = `${chave}|${e.tipo}`;
      if (!porCargoEPct.has(chaveCompleta)) porCargoEPct.set(chaveCompleta, { cargoAgrupado: chave, tipo: e.tipo, horas: 0, valor: 0 });
      const reg = porCargoEPct.get(chaveCompleta);
      reg.horas += Number(e.horas);
      reg.valor += e.valor;

      totalPorCargo.set(chave, (totalPorCargo.get(chave) || 0) + Number(e.horas));
    }

    const ordemCargo = [...totalPorCargo.entries()].sort((a, b) => b[1] - a[1]).map(([chave]) => chave);
    const linhas = [...porCargoEPct.values()]
      .map((r) => ({ ...r, horas: Number(r.horas.toFixed(2)), valor: Number(r.valor.toFixed(2)) }))
      .sort((a, b) => {
        const diff = ordemCargo.indexOf(a.cargoAgrupado) - ordemCargo.indexOf(b.cargoAgrupado);
        return diff !== 0 ? diff : a.tipo.localeCompare(b.tipo);
      });
    res.json({ data: linhas, error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/importar", requirePerfil("FOCAL", "ADMIN"), upload.single("arquivo"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: "Arquivo não enviado" });
    const commit = req.query.commit === "true";
    const resultado = await importarHeExecutado(req.file.buffer, req.file.originalname, req.usuario.id, commit);
    if (commit) {
      await registrarAuditoria({
        ...auditContext(req),
        acao: "IMPORTAR_HE_EXECUTADO",
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

// Última importação da base de HE executado — a fonte é externa e atualiza
// em D-2, dependendo sempre de alguém subir o arquivo manualmente, então é
// importante deixar visível quando foi a última vez que isso aconteceu.
router.get("/ultima-importacao", requirePerfil("SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const lote = await prisma.loteImportacao.findFirst({
      where: { tipo: "HE_EXECUTADO" },
      orderBy: { criadoEm: "desc" },
      include: { usuario: true },
    });
    if (!lote) return res.json({ data: null, error: null });
    res.json({
      data: {
        criadoEm: lote.criadoEm,
        usuario: lote.usuario?.nome || "Usuário removido",
        arquivoNome: lote.arquivoNome,
        totalLinhas: lote.totalLinhas,
        inseridos: lote.inseridos,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// Reconciliação Solicitado x Executado (§11.3). Granularidade: por NOME do
// colaborador + competência (mês) — o cruzamento é por nome, não por
// matrícula, porque a base de executado pode trazer matrícula diferente da
// cadastrada (reaproveitada, formatada diferente etc.), enquanto o nome é
// mais estável entre as duas bases. Casamento por dia exato também não é
// confiável, pois a base executada registra ajustes de ponto, não
// necessariamente no mesmo dia da HE solicitada.
async function montarRegistrosReconciliacao(competencia, gerenteIdEscopo) {
  const inicioMes = new Date(`${competencia}-01T00:00:00.000Z`);
  const fimMes = new Date(inicioMes);
  fimMes.setUTCMonth(fimMes.getUTCMonth() + 1);

  const [itensAprovados, executados, colaboradores] = await Promise.all([
    prisma.solicitacaoItem.findMany({
      where: {
        status: "APROVADO",
        dataHe: { gte: inicioMes, lt: fimMes },
        colaborador: gerenteIdEscopo ? { gerenteId: Number(gerenteIdEscopo) } : undefined,
      },
      include: { colaborador: { include: { gerente: true } } },
    }),
    prisma.heExecutado.findMany({ where: { competencia, tipo: { not: null } } }),
    prisma.colaborador.findMany({
      where: gerenteIdEscopo ? { gerenteId: Number(gerenteIdEscopo) } : undefined,
      include: { gerente: true },
    }),
  ]);

  const porNomeColaborador = new Map();
  colaboradores.forEach((c) => porNomeColaborador.set(normalizarNome(c.nome), c));

  const registros = new Map();
  const registrar = (chave, nomeExibicao, gerenteId, gerenteNome) => {
    if (!registros.has(chave)) {
      registros.set(chave, {
        nome: nomeExibicao,
        gerenteId: gerenteId ?? null,
        gerenteNome: gerenteNome || "Não localizado",
        horasAprovadas: 0,
        horasExecutadas: 0,
      });
    }
    return registros.get(chave);
  };

  for (const item of itensAprovados) {
    const chave = normalizarNome(item.colaborador.nome);
    const reg = registrar(chave, item.colaborador.nome, item.colaborador.gerenteId, item.colaborador.gerente.nome);
    reg.horasAprovadas += Number(item.horas);
  }
  for (const exec of executados) {
    const chave = normalizarNome(exec.nome);
    const colaborador = porNomeColaborador.get(chave);
    if (gerenteIdEscopo && !colaborador) continue;
    const reg = registrar(chave, colaborador?.nome || exec.nome, colaborador?.gerenteId, colaborador?.gerente?.nome);
    reg.horasExecutadas += Number(exec.horas);
  }

  return [...registros.values()].map((r) => {
    const diferenca = Number((r.horasExecutadas - r.horasAprovadas).toFixed(2));
    let status = "OK";
    if (r.horasAprovadas === 0 && r.horasExecutadas > 0) status = "EXECUTADO_SEM_APROVACAO";
    else if (diferenca > 0.01) status = "EXECUTADO_A_MAIS";
    else if (diferenca < -0.01) status = "EXECUTADO_A_MENOS";
    return { ...r, diferenca, status };
  });
}

// Visão por colaborador, com filtros de gerência, nome e status.
router.get("/reconciliacao", requirePerfil("SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const { gerenteId, competencia, nome, status } = req.query;
    const { gerenteId: gerenteFiltro, erro } = resolverGerenteFiltro(req, gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });
    if (!competencia) return res.status(400).json({ data: null, error: "competência é obrigatória (YYYY-MM)" });

    let linhas = await montarRegistrosReconciliacao(competencia, gerenteFiltro);

    if (gerenteFiltro) linhas = linhas.filter((l) => l.gerenteId === Number(gerenteFiltro));
    if (nome) {
      const chaveBusca = normalizarNome(nome);
      linhas = linhas.filter((l) => normalizarNome(l.nome).includes(chaveBusca));
    }
    if (status) linhas = linhas.filter((l) => l.status === status);

    linhas.sort((a, b) => a.nome.localeCompare(b.nome));

    const arredondar = (v) => Number(v.toFixed(2));
    const totalAprovado = linhas.reduce((acc, l) => acc + l.horasAprovadas, 0);
    const totalExecutado = linhas.reduce((acc, l) => acc + l.horasExecutadas, 0);
    const dentroDoAprovado = linhas.filter((l) => l.status !== "EXECUTADO_A_MAIS" && l.status !== "EXECUTADO_SEM_APROVACAO").reduce((acc, l) => acc + Math.min(l.horasAprovadas, l.horasExecutadas), 0);

    res.json({
      data: {
        linhas,
        kpis: {
          aderenciaPct: totalAprovado > 0 ? Number(((dentroDoAprovado / totalAprovado) * 100).toFixed(1)) : 0,
          totalExecutadoSemAprovacao: arredondar(linhas.filter((l) => l.status === "EXECUTADO_SEM_APROVACAO").reduce((acc, l) => acc + l.horasExecutadas, 0)),
          totalAprovadoNaoExecutado: arredondar(linhas.filter((l) => l.status === "EXECUTADO_A_MENOS").reduce((acc, l) => acc + (l.horasAprovadas - l.horasExecutadas), 0)),
          totalAprovado: arredondar(totalAprovado),
          totalExecutado: arredondar(totalExecutado),
        },
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// Visão agregada por gerência, com quebra por tipo (50%/100%). "Autorizado"
// é o que foi solicitado e aprovado. "Não Autorizado" é o que foi executado
// SEM ter sido solicitado/aprovado — ou seja, o excedente de horas
// executadas acima do que aquele colaborador teve aprovado no mês. Esse
// excedente é calculado por pessoa (cruzando por nome) antes de somar por
// gerência, para o excesso de um colaborador não ser "compensado" pela
// folga de outro. Traz tanto horas quanto valor em R$ — o valor do
// autorizado usa o valorCalculado já gravado no item; o valor do executado
// (e do não autorizado, seu excedente) é recalculado com o valor de hora
// atual do cargo do colaborador, pois a base executada não traz valor.
router.get("/reconciliacao/gerencias", requirePerfil("SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const { competencia } = req.query;
    const gerenteEscopo = gerenteEscopoUsuario(req);
    if (!competencia) return res.status(400).json({ data: null, error: "competência é obrigatória (YYYY-MM)" });

    const inicioMes = new Date(`${competencia}-01T00:00:00.000Z`);
    const fimMes = new Date(inicioMes);
    fimMes.setUTCMonth(fimMes.getUTCMonth() + 1);

    const [itensAprovados, executados, colaboradores] = await Promise.all([
      prisma.solicitacaoItem.findMany({
        where: {
          status: "APROVADO",
          dataHe: { gte: inicioMes, lt: fimMes },
          colaborador: gerenteEscopo ? { gerenteId: Number(gerenteEscopo) } : undefined,
        },
        include: { colaborador: { include: { gerente: true } } },
      }),
      prisma.heExecutado.findMany({ where: { competencia, tipo: { not: null } } }),
      prisma.colaborador.findMany({
        where: gerenteEscopo ? { gerenteId: Number(gerenteEscopo) } : undefined,
        include: { gerente: true, cargo: true },
      }),
    ]);

    const porNomeColaborador = new Map();
    colaboradores.forEach((c) => porNomeColaborador.set(normalizarNome(c.nome), c));

    const vazioPessoa = () => ({
      gerenteId: null, gerenteNome: null, gerenciaSr: null,
      autorizado50Horas: 0, autorizado100Horas: 0, autorizado50Valor: 0, autorizado100Valor: 0,
      executado50Horas: 0, executado100Horas: 0, executado50Valor: 0, executado100Valor: 0,
    });

    const porNome = new Map();
    const registrarPessoa = (chave, gerenteId, gerenteNome, gerenciaSr) => {
      if (!porNome.has(chave)) porNome.set(chave, vazioPessoa());
      const reg = porNome.get(chave);
      if (gerenteId != null && reg.gerenteId == null) {
        reg.gerenteId = gerenteId;
        reg.gerenteNome = gerenteNome;
        reg.gerenciaSr = gerenciaSr;
      }
      return reg;
    };

    for (const item of itensAprovados) {
      const chave = normalizarNome(item.colaborador.nome);
      const reg = registrarPessoa(chave, item.colaborador.gerenteId, item.colaborador.gerente.nome, item.colaborador.gerente.gerenciaSr);
      const sufixo = item.tipo === "PCT_100" ? "100" : "50";
      reg[`autorizado${sufixo}Horas`] += Number(item.horas);
      reg[`autorizado${sufixo}Valor`] += Number(item.valorCalculado);
    }
    for (const exec of executados) {
      const chave = normalizarNome(exec.nome);
      const colaborador = porNomeColaborador.get(chave);
      if (gerenteEscopo && !colaborador) continue;
      const reg = registrarPessoa(chave, colaborador?.gerenteId, colaborador?.gerente?.nome, colaborador?.gerente?.gerenciaSr);
      const sufixo = exec.tipo === "PCT_100" ? "100" : "50";
      reg[`executado${sufixo}Horas`] += Number(exec.horas);
      if (colaborador?.cargo) {
        const valorHora = sufixo === "100" ? Number(colaborador.cargo.valorHora100) : Number(colaborador.cargo.valorHora50);
        reg[`executado${sufixo}Valor`] += Number(exec.horas) * valorHora;
      }
    }

    const vazioGerencia = () => ({
      autorizado50Horas: 0, autorizado100Horas: 0, autorizado50Valor: 0, autorizado100Valor: 0,
      naoAutorizado50Horas: 0, naoAutorizado100Horas: 0, naoAutorizado50Valor: 0, naoAutorizado100Valor: 0,
      executado50Horas: 0, executado100Horas: 0, executado50Valor: 0, executado100Valor: 0,
    });
    const porGerencia = new Map();
    const registrarGerencia = (gerenteId, gerenteNome, gerenciaSr) => {
      const chave = gerenteId ?? "SEM_GERENCIA";
      if (!porGerencia.has(chave)) {
        porGerencia.set(chave, { gerenteId: gerenteId ?? null, gerenteNome: gerenteNome || "Não localizado", gerenciaSr: gerenciaSr || null, ...vazioGerencia() });
      }
      return porGerencia.get(chave);
    };

    for (const p of porNome.values()) {
      const g = registrarGerencia(p.gerenteId, p.gerenteNome, p.gerenciaSr);
      g.autorizado50Horas += p.autorizado50Horas;
      g.autorizado100Horas += p.autorizado100Horas;
      g.autorizado50Valor += p.autorizado50Valor;
      g.autorizado100Valor += p.autorizado100Valor;
      g.executado50Horas += p.executado50Horas;
      g.executado100Horas += p.executado100Horas;
      g.executado50Valor += p.executado50Valor;
      g.executado100Valor += p.executado100Valor;

      const excedente50 = Math.max(0, p.executado50Horas - p.autorizado50Horas);
      const excedente100 = Math.max(0, p.executado100Horas - p.autorizado100Horas);
      g.naoAutorizado50Horas += excedente50;
      g.naoAutorizado100Horas += excedente100;
      if (p.executado50Horas > 0) g.naoAutorizado50Valor += excedente50 * (p.executado50Valor / p.executado50Horas);
      if (p.executado100Horas > 0) g.naoAutorizado100Valor += excedente100 * (p.executado100Valor / p.executado100Horas);
    }

    const arredondar = (v) => Number(v.toFixed(2));
    const linhas = [...porGerencia.values()]
      .map((r) => ({
        gerenteId: r.gerenteId,
        gerenteNome: r.gerenteNome,
        gerenciaSr: r.gerenciaSr || "Sem Gerência Sr definida",
        autorizado50Horas: arredondar(r.autorizado50Horas),
        autorizado100Horas: arredondar(r.autorizado100Horas),
        naoAutorizado50Horas: arredondar(r.naoAutorizado50Horas),
        naoAutorizado100Horas: arredondar(r.naoAutorizado100Horas),
        executado50Horas: arredondar(r.executado50Horas),
        executado100Horas: arredondar(r.executado100Horas),
        totalAutorizadoHoras: arredondar(r.autorizado50Horas + r.autorizado100Horas),
        totalNaoAutorizadoHoras: arredondar(r.naoAutorizado50Horas + r.naoAutorizado100Horas),
        totalExecutadoHoras: arredondar(r.executado50Horas + r.executado100Horas),
        autorizado50Valor: arredondar(r.autorizado50Valor),
        autorizado100Valor: arredondar(r.autorizado100Valor),
        naoAutorizado50Valor: arredondar(r.naoAutorizado50Valor),
        naoAutorizado100Valor: arredondar(r.naoAutorizado100Valor),
        executado50Valor: arredondar(r.executado50Valor),
        executado100Valor: arredondar(r.executado100Valor),
        totalAutorizadoValor: arredondar(r.autorizado50Valor + r.autorizado100Valor),
        totalNaoAutorizadoValor: arredondar(r.naoAutorizado50Valor + r.naoAutorizado100Valor),
        totalExecutadoValor: arredondar(r.executado50Valor + r.executado100Valor),
      }))
      .sort((a, b) => a.gerenteNome.localeCompare(b.gerenteNome));

    res.json({ data: { linhas }, error: null });
  } catch (err) {
    next(err);
  }
});

const COLUNAS_DETALHE = {
  autorizado50: { grupo: "autorizado", tipos: ["PCT_50"] },
  autorizado100: { grupo: "autorizado", tipos: ["PCT_100"] },
  totalAutorizado: { grupo: "autorizado", tipos: ["PCT_50", "PCT_100"] },
  naoAutorizado50: { grupo: "naoAutorizado", tipos: ["PCT_50"] },
  naoAutorizado100: { grupo: "naoAutorizado", tipos: ["PCT_100"] },
  totalNaoAutorizado: { grupo: "naoAutorizado", tipos: ["PCT_50", "PCT_100"] },
  executado50: { grupo: "executado", tipos: ["PCT_50"] },
  executado100: { grupo: "executado", tipos: ["PCT_100"] },
  totalExecutado: { grupo: "executado", tipos: ["PCT_50", "PCT_100"] },
};

// Drill-down: lista os registros que compõem uma célula da tabela por
// gerência. Para Autorizado/Executado, são os registros brutos (item de
// solicitação aprovado / linha da base executada). Para Não Autorizado, não
// existe um "registro" único — é um cálculo (excedente do executado sobre o
// autorizado por pessoa) — então mostramos o comparativo por colaborador.
router.get("/reconciliacao/gerencias/detalhe", requirePerfil("SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const { competencia, coluna } = req.query;
    if (!competencia || !coluna) {
      return res.status(400).json({ data: null, error: "competência e coluna são obrigatórios" });
    }
    const config = COLUNAS_DETALHE[coluna];
    if (!config) return res.status(400).json({ data: null, error: "coluna inválida" });

    // gerenteId ausente/"sem-gerencia" = bucket de executados cujo nome não bate
    // com nenhum colaborador cadastrado (não há como saber a gerência).
    const { gerenteId, semGerencia, erro } = resolverGerenteFiltro(req, req.query.gerenteId);
    if (erro) return res.status(403).json({ data: null, error: erro });

    const inicioMes = new Date(`${competencia}-01T00:00:00.000Z`);
    const fimMes = new Date(inicioMes);
    fimMes.setUTCMonth(fimMes.getUTCMonth() + 1);

    if (config.grupo === "autorizado") {
      if (semGerencia) return res.json({ data: { grupo: "autorizado", linhas: [] }, error: null });
      const itens = await prisma.solicitacaoItem.findMany({
        where: {
          status: "APROVADO",
          tipo: { in: config.tipos },
          dataHe: { gte: inicioMes, lt: fimMes },
          colaborador: { gerenteId },
        },
        include: { colaborador: true, solicitacao: { include: { solicitante: true } } },
        orderBy: { dataHe: "asc" },
      });
      const linhas = itens.map((i) => ({
        nome: i.colaborador.nome,
        data: i.dataHe,
        tipo: i.tipo,
        horas: Number(i.horas),
        valor: Number(i.valorCalculado),
        solicitante: i.solicitacao.solicitante.nome,
        protocolo: i.solicitacao.protocolo,
      }));
      return res.json({ data: { grupo: "autorizado", linhas }, error: null });
    }

    if (config.grupo === "executado") {
      const [executados, colaboradores] = await Promise.all([
        prisma.heExecutado.findMany({ where: { competencia, tipo: { in: config.tipos } } }),
        prisma.colaborador.findMany({ where: semGerencia ? undefined : { gerenteId: Number(gerenteId) }, include: { cargo: true } }),
      ]);
      const porNomeColaborador = new Map(colaboradores.map((c) => [normalizarNome(c.nome), c]));
      const linhas = executados
        .filter((e) => (semGerencia ? !porNomeColaborador.has(normalizarNome(e.nome)) : porNomeColaborador.has(normalizarNome(e.nome))))
        .map((e) => {
          const c = porNomeColaborador.get(normalizarNome(e.nome));
          const valorHora = c ? (e.tipo === "PCT_100" ? Number(c.cargo.valorHora100) : Number(c.cargo.valorHora50)) : 0;
          return {
            nome: c?.nome || e.nome,
            data: e.dataHe,
            tipo: e.tipo,
            horas: Number(e.horas),
            valor: Number(e.horas) * valorHora,
            evento: e.eventoOriginal,
          };
        })
        .sort((a, b) => new Date(a.data) - new Date(b.data));
      return res.json({ data: { grupo: "executado", linhas }, error: null });
    }

    // naoAutorizado quando "sem gerência": são nomes executados que não batem com
    // nenhum colaborador cadastrado — nunca têm autorizado, então o excedente é o
    // próprio total executado (e não há valor de hora para calcular o R$).
    if (semGerencia) {
      if (gerenteEscopoUsuario(req)) {
        return res.json({ data: { grupo: "naoAutorizado", linhas: [] }, error: null });
      }
      const [executados, todosColaboradores] = await Promise.all([
        prisma.heExecutado.findMany({ where: { competencia, tipo: { not: null } } }),
        prisma.colaborador.findMany({ select: { nome: true } }),
      ]);
      const nomesConhecidos = new Set(todosColaboradores.map((c) => normalizarNome(c.nome)));
      const porNomeSemGerencia = new Map();
      for (const exec of executados) {
        const chave = normalizarNome(exec.nome);
        if (nomesConhecidos.has(chave)) continue;
        if (!porNomeSemGerencia.has(chave)) porNomeSemGerencia.set(chave, { nome: exec.nome, executado50: 0, executado100: 0 });
        const reg = porNomeSemGerencia.get(chave);
        reg[exec.tipo === "PCT_100" ? "executado100" : "executado50"] += Number(exec.horas);
      }
      const linhasSemGerencia = [];
      for (const p of porNomeSemGerencia.values()) {
        for (const tipo of config.tipos) {
          const sufixo = tipo === "PCT_100" ? "100" : "50";
          const excedente = p[`executado${sufixo}`];
          if (excedente > 0.001) {
            linhasSemGerencia.push({
              nome: p.nome,
              tipo,
              autorizadoHoras: 0,
              executadoHoras: Number(excedente.toFixed(2)),
              excedenteHoras: Number(excedente.toFixed(2)),
              excedenteValor: 0,
            });
          }
        }
      }
      linhasSemGerencia.sort((a, b) => a.nome.localeCompare(b.nome));
      return res.json({ data: { grupo: "naoAutorizado", linhas: linhasSemGerencia }, error: null });
    }

    // caso normal: recalcula o excedente por pessoa, só para colaboradores desta gerência
    const [itensAprovados, executados, colaboradores] = await Promise.all([
      prisma.solicitacaoItem.findMany({
        where: { status: "APROVADO", dataHe: { gte: inicioMes, lt: fimMes }, colaborador: { gerenteId: Number(gerenteId) } },
        include: { colaborador: true },
      }),
      prisma.heExecutado.findMany({ where: { competencia, tipo: { not: null } } }),
      prisma.colaborador.findMany({ where: { gerenteId: Number(gerenteId) }, include: { cargo: true } }),
    ]);
    const porNomeColaborador = new Map(colaboradores.map((c) => [normalizarNome(c.nome), c]));

    const porNome = new Map();
    const registrar = (chave, nomeExibicao) => {
      if (!porNome.has(chave)) {
        porNome.set(chave, { nome: nomeExibicao, autorizado50: 0, autorizado100: 0, executado50: 0, executado100: 0, executado50Valor: 0, executado100Valor: 0 });
      }
      return porNome.get(chave);
    };

    for (const item of itensAprovados) {
      const chave = normalizarNome(item.colaborador.nome);
      const reg = registrar(chave, item.colaborador.nome);
      reg[item.tipo === "PCT_100" ? "autorizado100" : "autorizado50"] += Number(item.horas);
    }
    for (const exec of executados) {
      const chave = normalizarNome(exec.nome);
      const colaborador = porNomeColaborador.get(chave);
      if (!colaborador) continue;
      const reg = registrar(chave, colaborador.nome);
      const sufixo = exec.tipo === "PCT_100" ? "100" : "50";
      reg[`executado${sufixo}`] += Number(exec.horas);
      const valorHora = sufixo === "100" ? Number(colaborador.cargo.valorHora100) : Number(colaborador.cargo.valorHora50);
      reg[`executado${sufixo}Valor`] += Number(exec.horas) * valorHora;
    }

    const linhas = [];
    for (const p of porNome.values()) {
      for (const tipo of config.tipos) {
        const sufixo = tipo === "PCT_100" ? "100" : "50";
        const excedente = Math.max(0, p[`executado${sufixo}`] - p[`autorizado${sufixo}`]);
        if (excedente > 0.001) {
          const valorHora = p[`executado${sufixo}`] > 0 ? p[`executado${sufixo}Valor`] / p[`executado${sufixo}`] : 0;
          linhas.push({
            nome: p.nome,
            tipo,
            autorizadoHoras: Number(p[`autorizado${sufixo}`].toFixed(2)),
            executadoHoras: Number(p[`executado${sufixo}`].toFixed(2)),
            excedenteHoras: Number(excedente.toFixed(2)),
            excedenteValor: Number((excedente * valorHora).toFixed(2)),
          });
        }
      }
    }
    linhas.sort((a, b) => a.nome.localeCompare(b.nome));
    res.json({ data: { grupo: "naoAutorizado", linhas }, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
