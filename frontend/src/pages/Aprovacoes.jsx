import React, { useCallback, useEffect, useState } from "react";
import { Card, Table, Button, Space, Modal, Input, Select, Row, Col, message, Tooltip, Progress } from "antd";
import {
  TeamOutlined,
  ArrowLeftOutlined,
  RightOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  HourglassOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../services/api";
import { formatadorMoeda } from "../constants";
import PageTitle from "../components/PageTitle";
import EmptyState from "../components/EmptyState";
import IconImg from "../components/IconImg";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const anoAtual = new Date().getFullYear();
const ANOS = [anoAtual - 1, anoAtual, anoAtual + 1];

const STATUS_OPCOES = [
  { value: "PENDENTE_APROVACAO", label: "Pendente" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "RECUSADO", label: "Recusado" },
  { value: "", label: "Todos" },
];

function filtrosPadrao() {
  const hoje = new Date();
  return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear(), status: "PENDENTE_APROVACAO" };
}

// Tela 1: resumo por gerente (quantas solicitações, horas e valor no
// status/período escolhido). Clicar em um gerente abre a fila de itens dele.
function ResumoGerencias({ filtros, setFiltros, onSelecionarGerente }) {
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/aprovacoes/resumo-gerencias", { params: filtros });
      setLinhas(data.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Card title={<PageTitle icon="gerencia.svg">Selecione a Gerência</PageTitle>} loading={carregando}>
      <div style={{ marginBottom: 16, color: "var(--he-text-muted)" }}>
        Escolha a gerência que deseja gerenciar as solicitações de horas extras:
      </div>
      <Row gutter={12} align="bottom" style={{ marginBottom: 16 }}>
        <Col>
          <div style={{ fontSize: 12, color: "var(--he-text-muted)", marginBottom: 4 }}>Mês de Referência</div>
          <Select
            allowClear
            placeholder="Todos os meses"
            style={{ width: 160 }}
            value={filtros.mes}
            onChange={(v) => setFiltros((f) => ({ ...f, mes: v }))}
            options={MESES.map((nome, idx) => ({ value: idx + 1, label: nome }))}
          />
        </Col>
        <Col>
          <div style={{ fontSize: 12, color: "var(--he-text-muted)", marginBottom: 4 }}>Ano de Referência</div>
          <Select
            allowClear
            placeholder="Todos os anos"
            style={{ width: 120 }}
            value={filtros.ano}
            onChange={(v) => setFiltros((f) => ({ ...f, ano: v }))}
            options={ANOS.map((a) => ({ value: a, label: String(a) }))}
          />
        </Col>
        <Col>
          <div style={{ fontSize: 12, color: "var(--he-text-muted)", marginBottom: 4 }}>Status</div>
          <Select style={{ width: 140 }} value={filtros.status} onChange={(v) => setFiltros((f) => ({ ...f, status: v }))} options={STATUS_OPCOES} />
        </Col>
        <Col>
          <Button onClick={() => setFiltros(filtrosPadrao())}>Limpar</Button>
        </Col>
      </Row>

      {linhas.length === 0 && !carregando && <EmptyState description="Nenhuma solicitação encontrada para os filtros selecionados" />}

      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        {linhas.map((linha) => (
          <div
            key={linha.gerenteId}
            className="kpi-card"
            onClick={() => onSelecionarGerente(linha.gerenteId, linha.gerente)}
            style={{
              cursor: "pointer",
              border: "1px solid var(--he-border)",
              borderRadius: 8,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(107, 92, 224, 0.12)",
                color: "#6b5ce0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              <TeamOutlined />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: "var(--he-text-strong)" }}>{linha.gerente}</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 90 }}>
              <div style={{ fontWeight: 700, color: "var(--he-text-strong)" }}>{linha.quantidadeSolicitacoes}</div>
              <div style={{ fontSize: 12, color: "var(--he-text-muted)" }}>Solicitações</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 90 }}>
              <div style={{ fontWeight: 700, color: "var(--he-text-strong)" }}>{linha.totalHoras}h</div>
              <div style={{ fontSize: 12, color: "var(--he-text-muted)" }}>Total Horas</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 130 }}>
              <div style={{ fontWeight: 700, color: "var(--he-text-strong)" }}>{formatadorMoeda.format(linha.valorTotal)}</div>
              <div style={{ fontSize: 12, color: "var(--he-text-muted)" }}>Valor Total</div>
            </div>
            <RightOutlined style={{ color: "var(--he-text-muted)" }} />
          </div>
        ))}
      </Space>
    </Card>
  );
}

// Tela 2: fila de itens de um gerente específico (a antiga tela única de
// aprovações), com ações de aprovar/recusar quando o status filtrado for Pendente.
const RESUMO_CARDS = [
  { key: "valorLimite", label: "Limite Mensal", icon: WalletOutlined, accent: "#6b5ce0" },
  { key: "valorAprovado", label: "Já Aprovado", icon: CheckCircleOutlined, accent: "#5b8def" },
  { key: "valorPendente", label: "Pendente de Aprovação", icon: HourglassOutlined, accent: "#d48806" },
];

function ItemResumo({ label, valor, icon: Icon, accent, destaque }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {Icon && (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: `${accent}1a`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          <Icon />
        </div>
      )}
      <div>
        <div style={{ fontSize: 11, color: "var(--he-text-muted)", lineHeight: 1.3 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: destaque || "var(--he-text-strong)", lineHeight: 1.3 }}>
          {formatadorMoeda.format(valor)}
        </div>
      </div>
    </div>
  );
}

function ResumoGerenteDestaque({ resumo }) {
  if (!resumo) return null;

  const pctUsado = resumo.valorLimite > 0 ? ((resumo.valorAprovado + resumo.valorPendente) / resumo.valorLimite) * 100 : 0;
  const saldoNegativo = resumo.saldoAposAprovarPendentes < 0;
  const corSaldo = saldoNegativo ? "#cf1322" : "#3f8600";

  return (
    <div
      style={{
        border: `1px solid ${saldoNegativo ? "#ffccc7" : "var(--he-border)"}`,
        background: saldoNegativo ? "#fff1f0" : "var(--he-card-bg)",
        borderRadius: 8,
        padding: "10px 16px",
        marginBottom: 16,
      }}
    >
      <Row align="middle" gutter={24}>
        {RESUMO_CARDS.map(({ key, label, icon, accent }) => (
          <Col key={key}>
            <ItemResumo label={label} valor={resumo[key]} icon={icon} accent={accent} />
          </Col>
        ))}
        <Col>
          <ItemResumo label="Saldo Disponível" valor={resumo.saldoDisponivel} />
        </Col>
        <Col>
          <ItemResumo label="Saldo Após Aprovar Pendentes" valor={resumo.saldoAposAprovarPendentes} destaque={corSaldo} />
        </Col>
        <Col flex="auto" style={{ minWidth: 140 }}>
          <div style={{ fontSize: 11, color: "var(--he-text-muted)", marginBottom: 3 }}>
            {Math.min(pctUsado, 999).toFixed(0)}% do limite {pctUsado > 100 ? "(estourado)" : "usado"}
          </div>
          <Progress
            percent={Math.min(pctUsado, 100)}
            showInfo={false}
            size="small"
            strokeColor={pctUsado > 100 ? "#cf1322" : pctUsado > 80 ? "#d48806" : "#52c41a"}
            trailColor="var(--he-border)"
          />
        </Col>
      </Row>
      {resumo.acimaDoLimiteSeAprovarTudo && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#cf1322" }}>
          <ExclamationCircleOutlined style={{ marginRight: 6 }} />
          Aprovar todos os itens pendentes deste gerente vai ultrapassar o limite mensal.
        </div>
      )}
    </div>
  );
}

function FilaGerente({ gerente, filtros, onVoltar }) {
  const [dados, setDados] = useState({ itens: [], total: 0 });
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [motivoModal, setMotivoModal] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [resumo, setResumo] = useState(null);
  const [processandoIds, setProcessandoIds] = useState([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [recusando, setRecusando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/aprovacoes/itens", { params: { ...filtros, gerenteId: gerente.id, pageSize: 100 } });
      setDados(data.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setCarregando(false);
    }
  }, [filtros, gerente.id]);

  const carregarResumo = useCallback(async () => {
    try {
      const { data } = await api.get("/aprovacoes/resumo-gerente", {
        params: { gerenteId: gerente.id, mes: filtros.mes, ano: filtros.ano },
      });
      setResumo(data.data);
    } catch (err) {
      message.error(err.message);
    }
  }, [filtros.mes, filtros.ano, gerente.id]);

  useEffect(() => {
    carregar();
    carregarResumo();
  }, [carregar, carregarResumo]);

  const podeDecidir = filtros.status === "PENDENTE_APROVACAO";

  async function aprovar(itemIds) {
    const emLote = itemIds.length > 1;
    if (emLote) setProcessandoLote(true);
    else setProcessandoIds((atual) => [...atual, ...itemIds]);
    try {
      await api.post("/aprovacoes/aprovar", { itemIds });
      message.success("Itens aprovados");
      setSelecionados([]);
      await Promise.all([carregar(), carregarResumo()]);
    } catch (err) {
      message.error(err.message);
    } finally {
      if (emLote) setProcessandoLote(false);
      else setProcessandoIds((atual) => atual.filter((id) => !itemIds.includes(id)));
    }
  }

  async function confirmarRecusa() {
    if (!motivo.trim()) {
      message.warning("Informe o motivo da recusa");
      return;
    }
    setRecusando(true);
    try {
      await api.post("/aprovacoes/recusar", { itemIds: selecionados, motivo });
      message.success("Itens recusados");
      setSelecionados([]);
      setMotivo("");
      setMotivoModal(false);
      await Promise.all([carregar(), carregarResumo()]);
    } catch (err) {
      message.error(err.message);
    } finally {
      setRecusando(false);
    }
  }

  const colunas = [
    { title: "Protocolo", dataIndex: ["solicitacao", "protocolo"], width: 110, ellipsis: true },
    { title: "Colaborador", dataIndex: ["colaborador", "nome"], width: 190, ellipsis: true },
    { title: "Data HE", dataIndex: "dataHe", render: (v) => dayjs(v).format("DD/MM/YY"), width: 85, align: "center" },
    { title: "Tipo", dataIndex: "tipo", render: (v) => (v === "PCT_50" ? "50%" : "100%"), width: 55, align: "center" },
    { title: "Horas", dataIndex: "horas", width: 55, align: "center" },
    { title: "Valor", dataIndex: "valorCalculado", render: (v) => formatadorMoeda.format(Number(v)), width: 95, align: "center" },
    { title: "Solicitante", dataIndex: ["solicitacao", "solicitante", "nome"], width: 140, ellipsis: true },
    ...(podeDecidir
      ? [
          {
            title: "Ações",
            width: 110,
            render: (_, row) => {
              const processandoEste = processandoIds.includes(row.id);
              return (
                <Space size={8}>
                  <Tooltip title="Aprovar">
                    <Button
                      shape="circle"
                      loading={processandoEste}
                      disabled={processandoLote}
                      icon={processandoEste ? undefined : <IconImg icon="aprovar.svg" size={15} />}
                      style={{ color: "#389e0d", borderColor: "#b7eb8f" }}
                      onClick={() => aprovar([row.id])}
                    />
                  </Tooltip>
                  <Tooltip title="Recusar">
                    <Button
                      shape="circle"
                      danger
                      disabled={processandoEste || processandoLote}
                      icon={<IconImg icon="reprovar.svg" size={15} />}
                      onClick={() => {
                        setSelecionados([row.id]);
                        setMotivoModal(true);
                      }}
                    />
                  </Tooltip>
                </Space>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <Card
      title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onVoltar} />
          <PageTitle icon="horas-extras-ampulheta.svg">{gerente.nome}</PageTitle>
        </Space>
      }
      extra={
        podeDecidir && (
          <Space>
            <Button
              type="primary"
              disabled={selecionados.length === 0}
              loading={processandoLote}
              icon={processandoLote ? undefined : <IconImg icon="aprovar.svg" />}
              onClick={() => aprovar(selecionados)}
            >
              Aprovar selecionados ({selecionados.length})
            </Button>
            <Button
              danger
              disabled={selecionados.length === 0 || processandoLote}
              icon={<IconImg icon="reprovar.svg" />}
              onClick={() => setMotivoModal(true)}
            >
              Recusar selecionados
            </Button>
          </Space>
        )
      }
    >
      <ResumoGerenteDestaque resumo={resumo} />
      <Table
        className="tabela-app tabela-compacta"
        size="small"
        rowKey="id"
        dataSource={dados.itens}
        columns={colunas}
        loading={carregando}
        locale={{ emptyText: <EmptyState description="Nenhum item encontrado" /> }}
        rowSelection={podeDecidir ? { selectedRowKeys: selecionados, onChange: setSelecionados } : undefined}
        pagination={{ pageSize: 20, showTotal: (total) => `${total} itens` }}
      />
      <Modal
        title="Motivo da recusa"
        open={motivoModal}
        onOk={confirmarRecusa}
        onCancel={() => setMotivoModal(false)}
        confirmLoading={recusando}
        okText="Recusar"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo da recusa" />
      </Modal>
    </Card>
  );
}

export default function Aprovacoes() {
  const [filtros, setFiltros] = useState(filtrosPadrao());
  const [gerente, setGerente] = useState(null); // { id, nome }

  return gerente ? (
    <FilaGerente gerente={gerente} filtros={filtros} onVoltar={() => setGerente(null)} />
  ) : (
    <ResumoGerencias
      filtros={filtros}
      setFiltros={setFiltros}
      onSelecionarGerente={(id, nome) => setGerente({ id, nome })}
    />
  );
}
