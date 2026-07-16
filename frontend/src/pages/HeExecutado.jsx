import React, { useEffect, useState } from "react";
import { Card, Modal, Upload, Button, Alert, Space, Table, Statistic, Row, Col, message, Select, Input, Tooltip } from "antd";
import { UploadOutlined, UpOutlined, DownOutlined, ClockCircleOutlined, DollarOutlined, TeamOutlined } from "@ant-design/icons";
import api from "../services/api";
import PageTitle from "../components/PageTitle";
import { formatadorMoeda } from "../constants";
import RotuloComDica from "../components/RotuloComDica";
import { useTema } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const anoAtual = new Date().getFullYear();
const ANOS = [anoAtual - 1, anoAtual, anoAtual + 1];

const STATUS_LABEL = {
  OK: { label: "OK", color: "green" },
  EXECUTADO_A_MAIS: { label: "Executado a mais", color: "orange" },
  EXECUTADO_A_MENOS: { label: "Executado a menos", color: "blue" },
  EXECUTADO_SEM_APROVACAO: { label: "Executado sem aprovação", color: "red" },
};

const CINZA_ZERO = "#bfbfbf";

function celulaNumero(v, exibicao) {
  if (!v) return <span style={{ color: CINZA_ZERO }}>{exibicao}</span>;
  return exibicao;
}

function celulaDiferenca(v) {
  if (v > 0) return <span style={{ color: "#d46b08" }}>+{v}</span>;
  if (v < 0) return <span style={{ color: "#1677ff" }}>{v}</span>;
  return <span style={{ color: CINZA_ZERO }}>{v}</span>;
}

function ImportarModal({ open, onClose, onImportado }) {
  const [arquivo, setArquivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [processandoPreview, setProcessandoPreview] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  function fechar() {
    setArquivo(null);
    setResultado(null);
    onClose();
  }

  async function preview() {
    if (!arquivo) return message.warning("Selecione um arquivo");
    setProcessandoPreview(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const { data } = await api.post("/he-executado/importar?commit=false", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setResultado(data.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setProcessandoPreview(false);
    }
  }

  async function confirmar() {
    setConfirmando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const { data } = await api.post("/he-executado/importar?commit=true", formData, { headers: { "Content-Type": "multipart/form-data" } });
      message.success(`Importação concluída: ${data.data.inseridos} registros`);
      fechar();
      onImportado();
    } catch (err) {
      message.error(err.message);
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <Modal title="Importar base de HE executado" open={open} onCancel={fechar} footer={null} width={640}>
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
        Envie a planilha com as horas realmente realizadas em campo (extraída do sistema de ponto). Apenas as linhas cujo
        EVENTO seja "Hora Extra 50%" ou "Horas Extras 100%" são importadas — as demais (ajuste de ponto, banco de horas etc.)
        são ignoradas automaticamente.
      </div>
      <Upload beforeUpload={(file) => { setArquivo(file); setResultado(null); return false; }} maxCount={1}>
        <Button icon={<UploadOutlined />}>Selecionar base_he_executado.xlsx</Button>
      </Upload>
      <Space style={{ marginTop: 12 }}>
        <Button type="primary" onClick={preview} disabled={!arquivo} loading={processandoPreview}>Pré-visualizar</Button>
        {resultado && <Button onClick={confirmar} loading={confirmando}>Confirmar importação</Button>}
      </Space>
      {resultado && (
        <>
          <Alert
            style={{ marginTop: 16 }}
            type={resultado.erros > 0 ? "warning" : "success"}
            message={`${resultado.totalLinhas} linhas — ${resultado.inseridos} de HE (50%/100%) — ${resultado.ignorados || 0} ignoradas (outros eventos) — ${resultado.erros} com erro`}
          />
          {resultado.detalheErros?.length > 0 && (
            <div style={{ maxHeight: 200, overflow: "auto", fontSize: 12, marginTop: 8 }}>
              <strong>Erros:</strong>
              {resultado.detalheErros.map((e, i) => (
                <div key={i}>Linha {e.linha}: {e.erro}</div>
              ))}
            </div>
          )}
          {resultado.detalheIgnorados?.length > 0 && (
            <div style={{ maxHeight: 200, overflow: "auto", fontSize: 12, marginTop: 8, color: "var(--he-text-muted)" }}>
              <strong>Linhas ignoradas (evento diferente de HE 50%/100%):</strong>
              {resultado.detalheIgnorados.slice(0, 50).map((e, i) => (
                <div key={i}>Linha {e.linha}: {e.evento || "(evento vazio)"}</div>
              ))}
              {resultado.detalheIgnorados.length > 50 && <div>... e mais {resultado.detalheIgnorados.length - 50} linha(s)</div>}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

const TIPO_LABEL = { PCT_50: "50%", PCT_100: "100%" };

function DetalheCelulaModal({ detalhe, competencia, onClose }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!detalhe) return;
    let ativo = true;
    setCarregando(true);
    setDados(null);
    api
      .get("/he-executado/reconciliacao/gerencias/detalhe", { params: { competencia, gerenteId: detalhe.gerenteId ?? "sem-gerencia", coluna: detalhe.coluna } })
      .then(({ data }) => { if (ativo) setDados(data.data); })
      .catch((err) => message.error(err.message))
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [detalhe, competencia]);

  const colunasAutorizado = [
    { title: "Colaborador", dataIndex: "nome" },
    { title: "Data", dataIndex: "data", render: (v) => new Date(v).toLocaleDateString("pt-BR") },
    { title: "Tipo", dataIndex: "tipo", align: "center", render: (v) => TIPO_LABEL[v] },
    { title: "Horas", dataIndex: "horas", align: "center", render: (v) => v.toFixed(2) },
    { title: "Valor", dataIndex: "valor", align: "center", render: (v) => formatadorMoeda.format(v) },
    { title: "Solicitante", dataIndex: "solicitante" },
    { title: "Protocolo", dataIndex: "protocolo" },
  ];

  const colunasExecutado = [
    { title: "Colaborador", dataIndex: "nome" },
    { title: "Data", dataIndex: "data", render: (v) => new Date(v).toLocaleDateString("pt-BR") },
    { title: "Tipo", dataIndex: "tipo", align: "center", render: (v) => TIPO_LABEL[v] },
    { title: "Horas", dataIndex: "horas", align: "center", render: (v) => v.toFixed(2) },
    { title: "Valor", dataIndex: "valor", align: "center", render: (v) => formatadorMoeda.format(v) },
    { title: "Evento (planilha)", dataIndex: "evento" },
  ];

  const colunasNaoAutorizado = [
    { title: "Colaborador", dataIndex: "nome" },
    { title: "Tipo", dataIndex: "tipo", align: "center", render: (v) => TIPO_LABEL[v] },
    { title: "Autorizado (h)", dataIndex: "autorizadoHoras", align: "center" },
    { title: "Executado (h)", dataIndex: "executadoHoras", align: "center" },
    { title: "Excedente (h)", dataIndex: "excedenteHoras", align: "center", render: (v) => <strong style={{ color: "#cf1322" }}>{v.toFixed(2)}</strong> },
    { title: "Excedente (R$)", dataIndex: "excedenteValor", align: "center", render: (v) => formatadorMoeda.format(v) },
  ];

  const colunasPorGrupo = { autorizado: colunasAutorizado, executado: colunasExecutado, naoAutorizado: colunasNaoAutorizado };
  const colunas = dados ? colunasPorGrupo[dados.grupo] : [];

  return (
    <Modal
      title={detalhe ? `${detalhe.titulo} — ${detalhe.gerenteNome}` : ""}
      open={!!detalhe}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      {dados?.grupo === "naoAutorizado" && (
        <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
          Não é um registro isolado da planilha: é o excedente de horas executadas por colaborador acima do que foi
          autorizado no mês (executado − autorizado, quando positivo).
        </div>
      )}
      <Table
        className="tabela-app tabela-compacta"
        size="small"
        rowKey={(r) => `${r.nome}-${r.tipo}-${r.data || ""}-${r.horas || r.excedenteHoras || ""}`}
        dataSource={dados?.linhas || []}
        columns={colunas}
        loading={carregando}
        pagination={{ pageSize: 10 }}
        scroll={{ x: "max-content" }}
      />
    </Modal>
  );
}

function ReconciliacaoGerencia({ competencia, recarregarChave }) {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [detalhado, setDetalhado] = useState(false);
  const [modo, setModo] = useState("horas"); // "horas" | "valores"
  const [detalheCelula, setDetalheCelula] = useState(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api
      .get("/he-executado/reconciliacao/gerencias", { params: { competencia } })
      .then(({ data }) => { if (ativo) setDados(data.data.linhas); })
      .catch((err) => message.error(err.message))
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [competencia, recarregarChave]);

  const suf = modo === "valores" ? "Valor" : "Horas";
  const formatar = (v) => (modo === "valores" ? formatadorMoeda.format(v) : v.toFixed(2));
  const col = (title, campo, dica) => ({
    title: dica ? <RotuloComDica dica={dica}>{title}</RotuloComDica> : title,
    dataIndex: `${campo}${suf}`,
    align: "center",
    onCell: (row) => (row.isGrupo ? { colSpan: 0 } : {}),
    render: (v, row) => {
      if (row.isGrupo) return null;
      return v > 0 ? (
        <span
          className="celula-clicavel"
          onClick={() => setDetalheCelula({ gerenteId: row.gerenteId, gerenteNome: row.gerenteNome, coluna: campo, titulo: title })}
        >
          {formatar(v)}
        </span>
      ) : (
        celulaNumero(v, formatar(v))
      );
    },
  });

  const colunaGerencia = {
    title: "Gerência",
    dataIndex: "gerenteNome",
    onCell: (row) => (row.isGrupo ? { colSpan: colunas.length } : {}),
    render: (v, row) => {
      if (row.isGrupo) {
        return (
          <Space size={8}>
            <TeamOutlined />
            <strong>{row.gerenciaSr}</strong>
          </Space>
        );
      }
      return v;
    },
  };

  const dicaAutorizado = "Horas solicitadas no Portal HE e aprovadas pelo aprovador, neste mês.";
  const dicaNaoAutorizado = "Horas executadas (batidas de ponto) acima do que foi aprovado para o colaborador no mês — ou seja, HE feita sem solicitação/aprovação correspondente.";
  const dicaExecutado = "Horas realmente batidas no ponto, importadas da base de HE executado.";

  const colunasDetalhadas = [
    colunaGerencia,
    col("Autorizado 50%", "autorizado50"),
    col("Autorizado 100%", "autorizado100"),
    col("Não Autorizado 50%", "naoAutorizado50"),
    col("Não Autorizado 100%", "naoAutorizado100"),
    col("Total Autorizado", "totalAutorizado", dicaAutorizado),
    col("Total Não Autorizado", "totalNaoAutorizado", dicaNaoAutorizado),
    col("Executado 50%", "executado50"),
    col("Executado 100%", "executado100"),
    col("Total Executado", "totalExecutado", dicaExecutado),
  ];

  const colunasResumidas = [
    colunaGerencia,
    col("Total Autorizado", "totalAutorizado", dicaAutorizado),
    col("Total Não Autorizado", "totalNaoAutorizado", dicaNaoAutorizado),
    col("Total Executado", "totalExecutado", dicaExecutado),
  ];

  const colunas = detalhado ? colunasDetalhadas : colunasResumidas;

  const totalizar = (campo) => dados.reduce((acc, l) => acc + l[`${campo}${suf}`], 0);

  const dadosAgrupados = [];
  const grupos = new Map();
  dados.forEach((l) => {
    const chave = l.gerenciaSr || "Sem Gerência Sr definida";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(l);
  });
  [...grupos.keys()].sort((a, b) => a.localeCompare(b)).forEach((gerenciaSr) => {
    dadosAgrupados.push({ isGrupo: true, gerenciaSr, gerenteNome: `grupo-${gerenciaSr}` });
    grupos.get(gerenciaSr).forEach((l) => dadosAgrupados.push(l));
  });

  return (
    <Card style={{ marginBottom: 16 }}>
      <Row justify="space-between" align="middle" wrap gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col>
          <Tooltip title="Mostra ou esconde a quebra por 50%/100% de cada coluna. Os totais aparecem sempre.">
            <Button shape="round" icon={detalhado ? <UpOutlined /> : <DownOutlined />} onClick={() => setDetalhado((v) => !v)}>
              {detalhado ? "Recolher Detalhes" : "Expandir Detalhes"}
            </Button>
          </Tooltip>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Ver os valores da tabela em quantidade de horas">
              <Button
                shape="round"
                type={modo === "horas" ? "primary" : "default"}
                icon={<ClockCircleOutlined />}
                onClick={() => setModo("horas")}
              >
                Horas
              </Button>
            </Tooltip>
            <Tooltip title="Ver os valores da tabela em R$ (calculado com o valor de hora do cargo de cada colaborador)">
              <Button
                shape="round"
                icon={<DollarOutlined />}
                onClick={() => setModo("valores")}
                style={modo === "valores" ? { background: "#52c41a", borderColor: "#52c41a", color: "#fff" } : undefined}
              >
                Valores
              </Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
        Compara, por gerência, as horas solicitadas (autorizadas ou não) com as horas realmente executadas no mês. O
        cruzamento entre as duas bases é feito pelo nome do colaborador. Clique em um número para ver os registros que
        compõem aquela célula.
      </div>
      <Table
        className="tabela-gerencia-sr tabela-compacta"
        size="small"
        rowKey="gerenteNome"
        rowClassName={(row) => (row.isGrupo ? "linha-grupo-sr" : "")}
        dataSource={dadosAgrupados}
        columns={colunas}
        loading={carregando}
        pagination={false}
        scroll={{ x: "max-content" }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}><strong>Total Geral</strong></Table.Summary.Cell>
            {colunas.slice(1).map((c, i) => (
              <Table.Summary.Cell key={c.dataIndex} index={i + 1} align="center">
                <strong>{formatar(totalizar(c.dataIndex.replace(suf, "")))}</strong>
              </Table.Summary.Cell>
            ))}
          </Table.Summary.Row>
        )}
      />
      <DetalheCelulaModal detalhe={detalheCelula} competencia={competencia} onClose={() => setDetalheCelula(null)} />
    </Card>
  );
}

function ReconciliacaoColaborador({ competencia, recarregarChave }) {
  const [gerenteId, setGerenteId] = useState(undefined);
  const [nome, setNome] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [gerentes, setGerentes] = useState([]);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    api.get("/gerentes").then(({ data }) => setGerentes(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api
      .get("/he-executado/reconciliacao", { params: { competencia, gerenteId, nome, status } })
      .then(({ data }) => { if (ativo) setDados(data.data); })
      .catch((err) => message.error(err.message))
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [competencia, gerenteId, nome, status, recarregarChave]);

  const colunas = [
    { title: "Nome", dataIndex: "nome" },
    { title: "Gerência", dataIndex: "gerenteNome" },
    { title: "Horas Aprovadas", dataIndex: "horasAprovadas", align: "center", render: (v) => celulaNumero(v, v.toFixed(2)) },
    { title: "Horas Executadas", dataIndex: "horasExecutadas", align: "center", render: (v) => celulaNumero(v, v.toFixed(2)) },
    { title: "Diferença", dataIndex: "diferenca", align: "center", render: celulaDiferenca },
    { title: "Status", dataIndex: "status", align: "center", render: (v) => <span style={{ color: STATUS_LABEL[v]?.color }}>{STATUS_LABEL[v]?.label}</span> },
  ];

  return (
    <Card title="Executado x Aprovado — Colaborador">
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
        Compara, por colaborador, as horas aprovadas com as horas realmente executadas no mês. O cruzamento entre as duas
        bases é feito pelo nome do colaborador (não pela matrícula).
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          showSearch
          placeholder="Gerência"
          style={{ width: 200 }}
          optionFilterProp="label"
          options={gerentes.map((g) => ({ value: g.id, label: g.nome }))}
          value={gerenteId}
          onChange={setGerenteId}
        />
        <Input.Search placeholder="Buscar por nome" allowClear style={{ width: 200 }} onSearch={(v) => setNome(v || undefined)} />
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 220 }}
          value={status}
          onChange={setStatus}
          options={Object.entries(STATUS_LABEL).map(([value, { label }]) => ({ value, label }))}
        />
      </Space>
      {dados && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Statistic title="Aderência" value={dados.kpis.aderenciaPct} suffix="%" /></Col>
          <Col span={6}><Statistic title="Total Aprovado" value={dados.kpis.totalAprovado} suffix="h" /></Col>
          <Col span={6}><Statistic title="Total Executado" value={dados.kpis.totalExecutado} suffix="h" /></Col>
          <Col span={6}><Statistic title="Executado sem aprovação" value={dados.kpis.totalExecutadoSemAprovacao} suffix="h" /></Col>
        </Row>
      )}
      <Table
        className="tabela-app tabela-compacta"
        size="small"
        rowKey="nome"
        dataSource={dados?.linhas || []}
        columns={colunas}
        loading={carregando}
        pagination={{ pageSize: 20 }}
      />
    </Card>
  );
}

const COR_GRAFICO = "#660099";
const COR_GRAFICO_2 = "#2f6fed";
const ALTURA_BARRAS = 140;

function rotuloCompetencia(competencia) {
  const [anoStr, mesStr] = competencia.split("-");
  const anoRef = Number(anoStr);
  const mesRef = Number(mesStr);
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtualRef = hoje.getFullYear();
  if (mesRef === mesAtual && anoRef === anoAtualRef) return "mês atual";
  return `mês filtrado (${MESES[mesRef - 1]}/${anoRef})`;
}

function ToggleModoGrafico({ modo, onChange, compacto }) {
  return (
    <Space size={4}>
      <Tooltip title="Horas">
        <Button
          size="small"
          shape="round"
          type={modo === "horas" ? "primary" : "default"}
          icon={<ClockCircleOutlined />}
          onClick={() => onChange("horas")}
        >
          {!compacto && "Horas"}
        </Button>
      </Tooltip>
      <Tooltip title="Valores">
        <Button
          size="small"
          shape="round"
          icon={<DollarOutlined />}
          onClick={() => onChange("valores")}
          style={modo === "valores" ? { background: "#52c41a", borderColor: "#52c41a", color: "#fff" } : undefined}
        >
          {!compacto && "Valores"}
        </Button>
      </Tooltip>
    </Space>
  );
}

// Calcula um teto "redondo" para o eixo (ex.: 1, 2, 2.5, 5, 10 x potência de 10) para as linhas-guia.
function calcularEixoMax(valores) {
  const max = Math.max(0, ...valores);
  if (max <= 0) return 10;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  const passos = [1, 2, 2.5, 5, 10];
  const passo = passos.find((p) => max <= p * base * 1.0001) || 10;
  return passo * base;
}

// Gráfico de colunas simples/agrupado feito à mão: o valor de cada coluna fica sempre
// escrito acima dela (fora da barra), garantindo leitura clara em qualquer altura/cor.
// As colunas se encolhem para caber na largura disponível (sem rolagem) — em vez de
// medida fixa, cada barra usa flex para dividir o espaço do seu grupo.
function GraficoBarrasColunas({ grupos, formatar }) {
  const { modoEscuro } = useTema();
  const corTexto = modoEscuro ? "rgba(255,255,255,0.85)" : "#262626";
  const corMuted = modoEscuro ? "rgba(255,255,255,0.55)" : "#8c8c8c";
  const corGrade = modoEscuro ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

  const eixoMax = calcularEixoMax(grupos.flatMap((g) => g.barras.map((b) => b.valor)));
  const niveis = [0.25, 0.5, 0.75, 1];
  const agrupado = grupos.some((g) => g.barras.length > 1);
  const compacto = grupos.length > 3;
  const fontValor = compacto ? 9 : agrupado ? 10 : 11;

  return (
    <div>
      <div style={{ display: "flex" }}>
        <div style={{ width: 34, flexShrink: 0, height: ALTURA_BARRAS, position: "relative" }}>
          {niveis.map((n) => (
            <div key={n} style={{ position: "absolute", left: 0, right: 4, bottom: `${n * 100}%`, transform: "translateY(50%)", textAlign: "right", fontSize: 9, color: corMuted }}>
              {formatar(eixoMax * n)}
            </div>
          ))}
          <div style={{ position: "absolute", left: 0, right: 4, bottom: 0, textAlign: "right", fontSize: 9, color: corMuted }}>0</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, position: "relative", height: ALTURA_BARRAS }}>
          {niveis.map((n) => (
            <div key={n} style={{ position: "absolute", left: 0, right: 0, bottom: `${n * 100}%`, borderTop: `1px dashed ${corGrade}` }} />
          ))}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTop: `1px solid ${corGrade}` }} />
          <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${grupos.length}, minmax(0, 1fr))` }}>
            {grupos.map((g) => (
              <div key={g.rotulo} style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: agrupado ? (compacto ? 2 : 6) : 0, height: "100%", padding: "0 1px" }}>
                {g.barras.map((b, i) => {
                  const alturaPct = eixoMax > 0 ? Math.min((b.valor / eixoMax) * 100, 100) : 0;
                  return (
                    <Tooltip key={i} title={`${b.legenda ? `${b.legenda}: ` : ""}${formatar(b.valor)}`}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flex: "1 1 0", minWidth: 0, maxWidth: agrupado ? 44 : 60, height: "100%", cursor: "default" }}>
                        <div style={{ fontSize: fontValor, lineHeight: 1.1, fontWeight: 700, color: corTexto, marginBottom: 2, whiteSpace: "normal", textAlign: "center", wordBreak: "keep-all" }}>
                          {b.valor > 0 ? formatar(b.valor) : ""}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: `${b.valor > 0 ? Math.max(alturaPct, 1.5) : 0}%`,
                            background: b.cor,
                            borderRadius: "3px 3px 0 0",
                          }}
                        />
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ width: 34, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: `repeat(${grupos.length}, minmax(0, 1fr))`, marginTop: 4 }}>
          {grupos.map((g) => (
            <div key={g.rotulo} style={{ textAlign: "center", fontSize: compacto ? 9.5 : 11, fontWeight: 600, color: corTexto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 1px" }}>
              {g.rotulo}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegendaCores({ itens, invisivel }) {
  return (
    <Space size={12} style={{ marginBottom: 6, visibility: invisivel ? "hidden" : "visible" }} wrap>
      {itens.map((it) => (
        <Space key={it.label} size={4}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: it.cor, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--he-text-muted)" }}>{it.label}</span>
        </Space>
      ))}
    </Space>
  );
}

function GraficoExecutadoMensal({ competencia, recarregarChave, modo }) {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api
      .get("/he-executado/grafico-mensal", { params: { competencia } })
      .then(({ data }) => { if (ativo) setDados(data.data); })
      .catch((err) => message.error(err.message))
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [competencia, recarregarChave]);

  const campo = modo === "valores" ? "valor" : "horas";
  const formatar = (v) => (modo === "valores" ? formatadorMoeda.format(v) : `${v.toFixed(1)}h`);
  const grupos = dados.map((d) => {
    const [ano, mesNum] = d.competencia.split("-");
    return { rotulo: `${MESES[Number(mesNum) - 1].slice(0, 3)}/${ano.slice(2)}`, barras: [{ valor: d[campo], cor: COR_GRAFICO }] };
  });

  return (
    <Card
      size="small"
      style={{ height: "100%" }} styles={{ body: { padding: 12 }, header: { padding: "0 12px" } }}
      title={<PageTitle icon="horas-extras-calendario.svg" tamanhoIcone={20}><span style={{ fontSize: 13 }}>Últimos 3 Meses</span></PageTitle>}
      loading={carregando}
    >
      <LegendaCores itens={[{ cor: "transparent", label: " " }]} invisivel />
      <GraficoBarrasColunas grupos={grupos} formatar={formatar} />
    </Card>
  );
}

function GraficoTipoPosicao({ competencia, recarregarChave, modo }) {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const contextoMes = rotuloCompetencia(competencia);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api
      .get("/he-executado/grafico-tipo-posicao", { params: { competencia } })
      .then(({ data }) => { if (ativo) setDados(data.data); })
      .catch((err) => message.error(err.message))
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [competencia, recarregarChave]);

  const campo = modo === "valores" ? "valor" : "horas";
  const formatar = (v) => (modo === "valores" ? formatadorMoeda.format(v) : `${v.toFixed(1)}h`);

  const porTipo = new Map();
  dados.forEach((d) => {
    if (!porTipo.has(d.tipoPosicao2)) porTipo.set(d.tipoPosicao2, {});
    porTipo.get(d.tipoPosicao2)[d.tipo] = d[campo];
  });
  const grupos = [...porTipo.entries()].map(([tipoPosicao2, valores]) => ({
    rotulo: tipoPosicao2,
    barras: [
      { valor: valores.PCT_50 || 0, cor: COR_GRAFICO, legenda: TIPO_LABEL.PCT_50 },
      { valor: valores.PCT_100 || 0, cor: COR_GRAFICO_2, legenda: TIPO_LABEL.PCT_100 },
    ],
  }));

  return (
    <Card
      size="small"
      style={{ height: "100%" }} styles={{ body: { padding: 12 }, header: { padding: "0 12px" } }}
      title={<PageTitle icon="departamento.svg" tamanhoIcone={20}><span style={{ fontSize: 13 }}>Tipo de Posição ({contextoMes})</span></PageTitle>}
      loading={carregando}
    >
      <LegendaCores itens={[{ cor: COR_GRAFICO, label: "50%" }, { cor: COR_GRAFICO_2, label: "100%" }]} />
      <GraficoBarrasColunas grupos={grupos} formatar={formatar} />
    </Card>
  );
}

function GraficoCargoAgrupado({ competencia, recarregarChave, modo }) {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const contextoMes = rotuloCompetencia(competencia);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api
      .get("/he-executado/grafico-cargo-agrupado", { params: { competencia } })
      .then(({ data }) => { if (ativo) setDados(data.data); })
      .catch((err) => message.error(err.message))
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [competencia, recarregarChave]);

  const campo = modo === "valores" ? "valor" : "horas";
  const formatar = (v) => (modo === "valores" ? formatadorMoeda.format(v) : `${v.toFixed(1)}h`);

  const porCargo = new Map();
  dados.forEach((d) => {
    if (!porCargo.has(d.cargoAgrupado)) porCargo.set(d.cargoAgrupado, {});
    porCargo.get(d.cargoAgrupado)[d.tipo] = d[campo];
  });
  const grupos = [...porCargo.entries()].map(([cargoAgrupado, valores]) => ({
    rotulo: cargoAgrupado,
    barras: [
      { valor: valores.PCT_50 || 0, cor: COR_GRAFICO, legenda: TIPO_LABEL.PCT_50 },
      { valor: valores.PCT_100 || 0, cor: COR_GRAFICO_2, legenda: TIPO_LABEL.PCT_100 },
    ],
  }));

  return (
    <Card
      size="small"
      style={{ height: "100%" }} styles={{ body: { padding: 12 }, header: { padding: "0 12px" } }}
      title={<PageTitle icon="perfil.svg" tamanhoIcone={20}><span style={{ fontSize: 13 }}>Cargo Agrupado ({contextoMes})</span></PageTitle>}
      loading={carregando}
    >
      <LegendaCores itens={[{ cor: COR_GRAFICO, label: "50%" }, { cor: COR_GRAFICO_2, label: "100%" }]} />
      <GraficoBarrasColunas grupos={grupos} formatar={formatar} />
    </Card>
  );
}

function UltimaAtualizacaoBase({ recarregarChave }) {
  const [info, setInfo] = useState(undefined); // undefined = carregando, null = nunca importou

  useEffect(() => {
    api
      .get("/he-executado/ultima-importacao")
      .then(({ data }) => setInfo(data.data))
      .catch(() => setInfo(null));
  }, [recarregarChave]);

  if (info === undefined) return null;

  if (!info) {
    return (
      <Alert
        style={{ marginBottom: 16 }}
        type="warning"
        showIcon
        message="A base de HE executado ainda não foi importada nenhuma vez."
      />
    );
  }

  const dias = Math.floor((Date.now() - new Date(info.criadoEm).getTime()) / 86400000);
  const desatualizada = dias > 4;

  return (
    <Alert
      style={{ marginBottom: 16 }}
      type={desatualizada ? "warning" : "info"}
      showIcon
      message={
        <span>
          <strong>Última atualização da base executada:</strong> {new Date(info.criadoEm).toLocaleString("pt-BR")} por{" "}
          {info.usuario} ({info.inseridos} de {info.totalLinhas} linhas importadas)
          {desatualizada && <strong> — já se passaram {dias} dias, confira se não falta subir uma base mais recente (a fonte atualiza em D-2).</strong>}
        </span>
      }
    />
  );
}

export default function HeExecutado() {
  const { usuario } = useAuth();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [modalImportar, setModalImportar] = useState(false);
  const [recarregarChave, setRecarregarChave] = useState(0);
  const [modoGraficos, setModoGraficos] = useState("horas");
  const podeImportar = ["FOCAL", "ADMIN"].includes(usuario?.perfil);

  const competencia = `${ano}-${String(mes).padStart(2, "0")}`;

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" wrap gutter={[12, 12]}>
          <Col>
            <PageTitle icon="horas-extras-cronometro.svg">
              <span style={{ fontSize: 20, fontWeight: 600 }}>HE Executado</span>
            </PageTitle>
          </Col>
          <Col>
            <Space wrap>
              <Select value={mes} onChange={setMes} style={{ width: 140 }} options={MESES.map((nome, idx) => ({ value: idx + 1, label: nome }))} />
              <Select value={ano} onChange={setAno} style={{ width: 100 }} options={ANOS.map((a) => ({ value: a, label: String(a) }))} />
              {podeImportar && (
                <Tooltip title="Envie a planilha extraída do sistema de ponto para atualizar a base de HE executado (atualiza D-2, precisa ser feito manualmente).">
                  <Button type="primary" icon={<UploadOutlined />} onClick={() => setModalImportar(true)}>Importar base</Button>
                </Tooltip>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Row justify="end" style={{ marginBottom: 8 }}>
        <ToggleModoGrafico modo={modoGraficos} onChange={setModoGraficos} />
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <GraficoExecutadoMensal competencia={competencia} recarregarChave={recarregarChave} modo={modoGraficos} />
        </Col>
        <Col span={8}>
          <GraficoTipoPosicao competencia={competencia} recarregarChave={recarregarChave} modo={modoGraficos} />
        </Col>
        <Col span={8}>
          <GraficoCargoAgrupado competencia={competencia} recarregarChave={recarregarChave} modo={modoGraficos} />
        </Col>
      </Row>

      <UltimaAtualizacaoBase recarregarChave={recarregarChave} />

      <ReconciliacaoGerencia competencia={competencia} recarregarChave={recarregarChave} />
      <ReconciliacaoColaborador competencia={competencia} recarregarChave={recarregarChave} />

      <ImportarModal open={modalImportar} onClose={() => setModalImportar(false)} onImportado={() => setRecarregarChave((v) => v + 1)} />
    </>
  );
}
