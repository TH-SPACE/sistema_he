import React from "react";
import { Card, Tag, Empty, Tooltip, Space, Progress } from "antd";
import { QuestionCircleOutlined, HistoryOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const formatador = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const tituloComDica = (
  <Space size={4}>
    <span>Resumo de Limite</span>
    <Tooltip title="Mostra quanto do limite mensal do gerente já foi usado. Ultrapassar o limite não bloqueia o envio da solicitação, apenas gera um aviso.">
      <QuestionCircleOutlined style={{ color: "var(--he-text-muted)", cursor: "help" }} />
    </Tooltip>
  </Space>
);

function Linha({ label, valor, cor, forte }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0" }}>
      <span style={{ fontSize: 12, color: "var(--he-text-muted)" }}>{label}</span>
      <span style={{ fontSize: forte ? 15 : 13, fontWeight: forte ? 700 : 500, color: cor || "var(--he-text-strong)" }}>
        {valor}
      </span>
    </div>
  );
}

export default function ResumoLimite({ resumo, totalItens }) {
  if (!resumo) {
    return (
      <Card title={tituloComDica} size="small">
        <Empty description="Selecione o gerente para ver o resumo" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const pctUsado = resumo.valorLimite > 0 ? (resumo.valorAposSolicitar / resumo.valorLimite) * 100 : 0;

  return (
    <Card title={tituloComDica} size="small" bodyStyle={{ padding: "10px 14px" }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{resumo.gerenteNome}</div>
      <Linha label="Limite mensal" valor={formatador.format(resumo.valorLimite)} />
      <Linha label={`Já aprovado (${resumo.competencia})`} valor={formatador.format(resumo.valorAprovado)} cor="#3f8600" />
      <Linha label="Pendente de aprovação" valor={formatador.format(resumo.valorPendente)} cor="#d48806" />
      <Linha label="Esta solicitação" valor={formatador.format(resumo.valorDestaSolicitacao)} />
      <Linha
        label={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span>{`HE executado (${resumo.competencia})`}</span>
            <Tooltip title="Total de horas já batidas no ponto pela gerência inteira nesta competência, segundo a base de HE Executado. Vem de importação manual e pode estar desatualizado.">
              <QuestionCircleOutlined style={{ cursor: "help" }} />
            </Tooltip>
          </span>
        }
        valor={`${resumo.horasExecutadas}h — ${formatador.format(resumo.valorExecutado)}`}
      />
      {resumo.executadoAtualizadoEm && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--he-text-muted)", marginTop: -1 }}>
          <HistoryOutlined />
          <span>Base atualizada em {dayjs(resumo.executadoAtualizadoEm).format("DD/MM/YYYY")}</span>
        </div>
      )}

      <Progress
        percent={Math.min(pctUsado, 100)}
        showInfo={false}
        size="small"
        strokeColor={pctUsado > 100 ? "#cf1322" : pctUsado > 80 ? "#d48806" : "#3f8600"}
        trailColor="var(--he-border)"
        style={{ margin: "6px 0 2px" }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <Linha label="Após solicitar" valor={formatador.format(resumo.valorAposSolicitar)} cor={resumo.acimaDoLimite ? "#cf1322" : "#3f8600"} forte />
      </div>
      <Space size={8} style={{ marginTop: 2 }}>
        <Tag color={resumo.acimaDoLimite ? "red" : "green"} style={{ marginInlineEnd: 0 }}>
          {resumo.acimaDoLimite ? "Acima do limite" : "Dentro do limite"}
        </Tag>
        <span style={{ fontSize: 12, color: "var(--he-text-muted)" }}>{totalItens} item(ns) a gerar</span>
      </Space>
    </Card>
  );
}
