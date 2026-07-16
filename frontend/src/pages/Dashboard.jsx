import React, { useEffect, useState, useCallback } from "react";
import { Card, Row, Col, Select, Button, Modal, Table, Tag, Tooltip, Space, message } from "antd";
import { ClockCircleOutlined, CheckCircleOutlined, HourglassOutlined, CloseCircleOutlined, ReloadOutlined, ExportOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../services/api";
import PageTitle from "../components/PageTitle";
import { STATUS_ITEM } from "../constants";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const anoAtual = new Date().getFullYear();
const ANOS = [anoAtual - 1, anoAtual, anoAtual + 1];

// Sem verde/vermelho para Aprovadas/Recusadas (a pedido) — usa azul, âmbar e
// cinza-azulado para diferenciar sem recorrer à semântica "sinal de trânsito".
const COR_APROVADAS = "#2f6fed";
const COR_PENDENTES = "#d48806";
const COR_RECUSADAS = "#595959";
const COR_TOTAL = "#660099";

const CARDS = [
  { key: "totalHoras", label: "Total de Horas", icon: ClockCircleOutlined, accent: COR_TOTAL },
  { key: "aprovadas", label: "Aprovadas", icon: CheckCircleOutlined, accent: COR_APROVADAS },
  { key: "pendentes", label: "Pendentes", icon: HourglassOutlined, accent: COR_PENDENTES },
  { key: "recusadas", label: "Recusadas", icon: CloseCircleOutlined, accent: COR_RECUSADAS },
];

const COLUNA_STATUS = {
  aprovadas: "APROVADO",
  pendentes: "PENDENTE_APROVACAO",
  recusadas: "RECUSADO",
  total: undefined,
};

function valorPadrao() {
  const hoje = new Date();
  return { gerenteId: undefined, mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };
}

function celulaNumeroStyle(valor) {
  return {
    padding: "10px 12px",
    textAlign: "center",
    cursor: valor > 0 ? "pointer" : "default",
    color: valor > 0 ? "var(--he-link)" : "var(--he-text-disabled)",
  };
}

function formatarHoras(v) {
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

// Barra horizontal empilhada (Aprovadas/Pendentes/Recusadas) de uma gerência,
// com o comprimento total proporcional à maior gerência da lista — dá uma
// leitura executiva rápida de "quem tem mais volume" antes de ir para a
// tabela detalhada logo abaixo.
function BarraGerencia({ linha, maxTotal, onClicarSegmento }) {
  const pct = (v) => (maxTotal > 0 ? (v / maxTotal) * 100 : 0);
  const segmentos = [
    { valor: linha.aprovadas, cor: COR_APROVADAS, label: "Aprovadas", coluna: "aprovadas" },
    { valor: linha.pendentes, cor: COR_PENDENTES, label: "Pendentes", coluna: "pendentes" },
    { valor: linha.recusadas, cor: COR_RECUSADAS, label: "Recusadas", coluna: "recusadas" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <div
        style={{ width: 170, flexShrink: 0, fontSize: 13, color: "var(--he-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={linha.gerente}
      >
        {linha.gerente}
      </div>
      <div style={{ flex: 1, display: "flex", height: 18, borderRadius: 4, overflow: "hidden", background: "var(--he-header-bg)" }}>
        {segmentos.map(
          (s) =>
            s.valor > 0 && (
              <Tooltip key={s.coluna} title={`${s.label}: ${formatarHoras(s.valor)}h`}>
                <div
                  style={{ width: `${pct(s.valor)}%`, background: s.cor, cursor: "pointer" }}
                  onClick={() => onClicarSegmento(s.valor, linha.gerenteId, linha.gerente, s.coluna, s.label)}
                />
              </Tooltip>
            )
        )}
      </div>
      <div style={{ width: 64, flexShrink: 0, textAlign: "right", fontWeight: 600, fontSize: 13, color: "var(--he-text-strong)" }}>
        {formatarHoras(linha.total)}h
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [gerentes, setGerentes] = useState([]);
  const [filtros, setFiltros] = useState(valorPadrao());
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [detalhe, setDetalhe] = useState(null); // { titulo, itens, carregando }

  useEffect(() => {
    api.get("/gerentes", { params: { ativo: true } }).then(({ data }) => setGerentes(data.data));
  }, []);

  const gerenteFiltradoNome = gerentes.find((g) => g.id === filtros.gerenteId)?.nome || null;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/dashboard/resumo-horas", { params: filtros });
      setResumo(data.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportar() {
    setExportando(true);
    try {
      const res = await api.get("/dashboard/resumo-horas/export", { params: filtros, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "horas_por_gerencia.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.message);
    } finally {
      setExportando(false);
    }
  }

  async function abrirDetalhe(valor, gerenteId, gerenteNome, coluna, colunaLabel) {
    if (!(valor > 0)) return;
    const titulo = gerenteNome ? `${colunaLabel} — ${gerenteNome}` : `${colunaLabel} — Todas as Gerências`;
    setDetalhe({ titulo, itens: [], carregando: true });
    try {
      const { data } = await api.get("/dashboard/resumo-horas/detalhe", {
        params: { gerenteId, mes: filtros.mes, ano: filtros.ano, status: COLUNA_STATUS[coluna] },
      });
      setDetalhe({ titulo, itens: data.data, carregando: false });
    } catch (err) {
      setDetalhe({ titulo, itens: [], carregando: false });
    }
  }

  const colunasDetalhe = [
    { title: "Protocolo", dataIndex: "protocolo", width: 130 },
    { title: "Colaborador", dataIndex: "colaborador", width: 260, ellipsis: true },
    { title: "Data HE", dataIndex: "dataHe", render: (v) => dayjs(v).format("DD/MM/YYYY"), width: 100 },
    { title: "Tipo", dataIndex: "tipo", render: (v) => (v === "PCT_50" ? "50%" : "100%"), width: 70 },
    { title: "Horas", dataIndex: "horas", width: 70 },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (v) => <Tag color={STATUS_ITEM[v]?.color}>{STATUS_ITEM[v]?.label}</Tag>,
    },
    { title: "Solicitante", dataIndex: "solicitante", width: 180, ellipsis: true },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" wrap gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <PageTitle icon="horas-extras-cronometro.svg"><span style={{ fontSize: 22, fontWeight: 700 }}>Dashboard Executivo</span></PageTitle>
            <div style={{ marginLeft: 40, marginTop: 2, fontSize: 13, color: "var(--he-text-muted)" }}>
              {MESES[filtros.mes - 1]} de {filtros.ano} — {gerenteFiltradoNome || "todas as gerências"}
            </div>
          </Col>
        </Row>
        <Row gutter={12} align="bottom">
          <Col>
            <div style={{ marginBottom: 4, fontSize: 12, color: "var(--he-text-muted)" }}>Gerência</div>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Todas as Gerências"
              style={{ width: 240 }}
              value={filtros.gerenteId}
              onChange={(v) => setFiltros((f) => ({ ...f, gerenteId: v }))}
              options={gerentes.map((g) => ({ value: g.id, label: g.nome }))}
            />
          </Col>
          <Col>
            <div style={{ marginBottom: 4, fontSize: 12, color: "var(--he-text-muted)" }}>Mês</div>
            <Select
              style={{ width: 160 }}
              value={filtros.mes}
              onChange={(v) => setFiltros((f) => ({ ...f, mes: v }))}
              options={MESES.map((nome, idx) => ({ value: idx + 1, label: nome }))}
            />
          </Col>
          <Col>
            <div style={{ marginBottom: 4, fontSize: 12, color: "var(--he-text-muted)" }}>Ano</div>
            <Select
              style={{ width: 120 }}
              value={filtros.ano}
              onChange={(v) => setFiltros((f) => ({ ...f, ano: v }))}
              options={ANOS.map((a) => ({ value: a, label: String(a) }))}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => setFiltros(valorPadrao())}>
              Limpar
            </Button>
          </Col>
          <Col>
            <Button icon={<ExportOutlined />} loading={exportando} onClick={exportar}>
              Exportar
            </Button>
          </Col>
        </Row>
      </Card>

      {resumo && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          {CARDS.map(({ key, label, icon: Icon, accent }) => (
            <Col span={6} key={key}>
              <div
                className="kpi-card"
                style={{
                  background: "var(--he-card-bg)",
                  border: "1px solid var(--he-border)",
                  borderTop: `3px solid ${accent}`,
                  borderRadius: 8,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: `${accent}1a`,
                    color: accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 17,
                    flexShrink: 0,
                  }}
                >
                  <Icon />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--he-text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--he-text-strong)" }}>{formatarHoras(resumo.kpis[key])}<span style={{ fontSize: 14, fontWeight: 500, color: "var(--he-text-muted)" }}> h</span></div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {resumo && resumo.porGerente.length > 0 && (
        <Card
          style={{ marginBottom: 16 }}
          title={<PageTitle icon="gerencia.svg">Visão Geral por Gerência</PageTitle>}
          loading={carregando && !resumo}
        >
          <Space size={16} style={{ marginBottom: 16 }} wrap>
            {[
              { cor: COR_APROVADAS, label: "Aprovadas" },
              { cor: COR_PENDENTES, label: "Pendentes" },
              { cor: COR_RECUSADAS, label: "Recusadas" },
            ].map((s) => (
              <Space key={s.label} size={6}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.cor, display: "inline-block" }} />
                <span style={{ fontSize: 12, color: "var(--he-text-muted)" }}>{s.label}</span>
              </Space>
            ))}
          </Space>
          {[...resumo.porGerente]
            .sort((a, b) => b.total - a.total)
            .slice(0, 8)
            .map((linha) => (
              <BarraGerencia
                key={linha.gerenteId}
                linha={linha}
                maxTotal={Math.max(...resumo.porGerente.map((l) => l.total))}
                onClicarSegmento={abrirDetalhe}
              />
            ))}
          {resumo.porGerente.length > 8 && (
            <div style={{ fontSize: 12, color: "var(--he-text-muted)", marginTop: 4 }}>
              Mostrando as 8 maiores gerências do período. A tabela completa está logo abaixo.
            </div>
          )}
        </Card>
      )}

      <Card title={<PageTitle icon="gerencia.svg">Horas por Gerência</PageTitle>} loading={carregando && !resumo}>
        <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
          Clique em um número azul para ver a lista de solicitações correspondente.
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--he-header-bg)" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--he-border)", color: "var(--he-text-strong)" }}>Gerente</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid var(--he-border)", color: "var(--he-text-strong)" }}>Aprovadas (h)</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid var(--he-border)", color: "var(--he-text-strong)" }}>Pendentes (h)</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid var(--he-border)", color: "var(--he-text-strong)" }}>Recusadas (h)</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: "1px solid var(--he-border)", color: "var(--he-text-strong)" }}>Total (h)</th>
              </tr>
            </thead>
            <tbody>
              {resumo?.porGerente.map((linha, idx) => (
                <tr key={linha.gerenteId} style={{ background: idx % 2 === 1 ? "var(--he-row-alt-bg)" : "var(--he-card-bg)" }}>
                  <td style={{ padding: "10px 12px", color: "var(--he-text-strong)" }}>{linha.gerente}</td>
                  <td
                    style={celulaNumeroStyle(linha.aprovadas)}
                    onClick={() => abrirDetalhe(linha.aprovadas, linha.gerenteId, linha.gerente, "aprovadas", "Aprovadas")}
                  >
                    {linha.aprovadas}
                  </td>
                  <td
                    style={celulaNumeroStyle(linha.pendentes)}
                    onClick={() => abrirDetalhe(linha.pendentes, linha.gerenteId, linha.gerente, "pendentes", "Pendentes")}
                  >
                    {linha.pendentes}
                  </td>
                  <td
                    style={celulaNumeroStyle(linha.recusadas)}
                    onClick={() => abrirDetalhe(linha.recusadas, linha.gerenteId, linha.gerente, "recusadas", "Recusadas")}
                  >
                    {linha.recusadas}
                  </td>
                  <td
                    style={{ ...celulaNumeroStyle(linha.total), fontWeight: 600 }}
                    onClick={() => abrirDetalhe(linha.total, linha.gerenteId, linha.gerente, "total", "Total")}
                  >
                    {linha.total}
                  </td>
                </tr>
              ))}
              {resumo?.porGerente.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--he-text-muted)" }}>
                    Nenhum registro no período selecionado
                  </td>
                </tr>
              )}
            </tbody>
            {resumo?.porGerente.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--he-footer-bg)", borderTop: "2px solid var(--he-footer-border)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--he-text-strong)" }}>Total</td>
                  <td
                    style={{ ...celulaNumeroStyle(resumo.kpis.aprovadas), fontWeight: 700 }}
                    onClick={() => abrirDetalhe(resumo.kpis.aprovadas, filtros.gerenteId, gerenteFiltradoNome, "aprovadas", "Aprovadas")}
                  >
                    {resumo.kpis.aprovadas}
                  </td>
                  <td
                    style={{ ...celulaNumeroStyle(resumo.kpis.pendentes), fontWeight: 700 }}
                    onClick={() => abrirDetalhe(resumo.kpis.pendentes, filtros.gerenteId, gerenteFiltradoNome, "pendentes", "Pendentes")}
                  >
                    {resumo.kpis.pendentes}
                  </td>
                  <td
                    style={{ ...celulaNumeroStyle(resumo.kpis.recusadas), fontWeight: 700 }}
                    onClick={() => abrirDetalhe(resumo.kpis.recusadas, filtros.gerenteId, gerenteFiltradoNome, "recusadas", "Recusadas")}
                  >
                    {resumo.kpis.recusadas}
                  </td>
                  <td
                    style={{ ...celulaNumeroStyle(resumo.kpis.totalHoras), fontWeight: 700 }}
                    onClick={() => abrirDetalhe(resumo.kpis.totalHoras, filtros.gerenteId, gerenteFiltradoNome, "total", "Total")}
                  >
                    {resumo.kpis.totalHoras}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Modal title={detalhe?.titulo} open={!!detalhe} onCancel={() => setDetalhe(null)} footer={null} width={1100}>
        <Table
          className="tabela-app tabela-compacta"
          rowKey="id"
          size="small"
          dataSource={detalhe?.itens || []}
          columns={colunasDetalhe}
          loading={detalhe?.carregando}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 940 }}
        />
      </Modal>
    </div>
  );
}
