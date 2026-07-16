import React, { useEffect, useState, useCallback } from "react";
import { Card, Table, Tag, Space, Button, Select, Input, InputNumber, Radio, DatePicker, Modal, Popconfirm, Tooltip, message } from "antd";
import { DownloadOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { STATUS_ITEM, JUSTIFICATIVAS, formatadorMoeda } from "../constants";
import PageTitle from "../components/PageTitle";
import EmptyState from "../components/EmptyState";

export default function FilaSolicitacoes() {
  const { usuario } = useAuth();
  // SOLICITADOR só enxerga as próprias solicitações (o backend força isso),
  // então o filtro de solicitante só aparece para os demais perfis — e já
  // inicia filtrando pelo próprio usuário, com a opção de limpar para ver tudo.
  const podeFiltrarSolicitante = usuario.perfil !== "SOLICITADOR";
  const [dados, setDados] = useState({ itens: [], total: 0 });
  const [carregando, setCarregando] = useState(false);
  const [gerentes, setGerentes] = useState([]);
  const [solicitantes, setSolicitantes] = useState([]);
  const [filtros, setFiltros] = useState({
    status: undefined,
    gerenteId: undefined,
    protocolo: undefined,
    solicitanteId: podeFiltrarSolicitante ? usuario.id : undefined,
  });
  const [pagina, setPagina] = useState(1);
  const [edicao, setEdicao] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    api.get("/gerentes").then(({ data }) => setGerentes(data.data));
    if (podeFiltrarSolicitante) {
      api.get("/solicitacoes/solicitantes").then(({ data }) => setSolicitantes(data.data)).catch(() => {});
    }
  }, [podeFiltrarSolicitante]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/solicitacoes", {
        params: { ...filtros, page: pagina, pageSize: 20 },
      });
      setDados(data.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setCarregando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(id) {
    setExcluindoId(id);
    try {
      await api.delete(`/solicitacoes/${id}`);
      message.success("Solicitação excluída");
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setExcluindoId(null);
    }
  }

  function abrirEdicao(row) {
    setEdicao({
      itemId: row.key,
      tipo: row.tipo,
      horas: row.horas,
      justificativa: row.justificativa,
      dataHe: dayjs(row.dataHe),
    });
  }

  async function salvarEdicao() {
    setSalvandoEdicao(true);
    try {
      await api.put(`/solicitacoes/itens/${edicao.itemId}`, {
        tipo: edicao.tipo,
        horas: edicao.horas,
        justificativa: edicao.justificativa,
        dataHe: edicao.dataHe.format("YYYY-MM-DD"),
      });
      message.success("Item atualizado");
      setEdicao(null);
      carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function exportar() {
    setExportando(true);
    try {
      const res = await api.get("/solicitacoes/export", { params: filtros, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "solicitacoes.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.message);
    } finally {
      setExportando(false);
    }
  }

  const linhas = dados.itens.flatMap((s) =>
    s.itens.map((item) => ({
      key: item.id,
      protocolo: s.protocolo,
      solicitacaoId: s.id,
      dataSolicitacao: s.criadoEm,
      gerente: s.gerente.nome,
      colaborador: item.colaborador.nome,
      dataHe: item.dataHe,
      tipo: item.tipo,
      horas: Number(item.horas),
      valor: Number(item.valorCalculado),
      justificativa: item.justificativa,
      status: item.status,
      statusGeral: s.statusGeral,
      solicitante: s.solicitante.nome,
      solicitanteId: s.solicitanteId,
      // ADMIN edita qualquer solicitação, independente do status; o autor só
      // edita a própria enquanto o item não estiver aprovado.
      podeEditar: usuario.perfil === "ADMIN" || (item.status !== "APROVADO" && s.solicitanteId === usuario.id),
      podeExcluir: item.status !== "APROVADO" && s.solicitanteId === usuario.id,
    }))
  );

  const colunas = [
    { title: "Protocolo", dataIndex: "protocolo", width: 110, ellipsis: true },
    { title: "Data Solic.", dataIndex: "dataSolicitacao", render: (v) => dayjs(v).format("DD/MM/YY"), width: 85, align: "center" },
    { title: "Gerente", dataIndex: "gerente", width: 170, ellipsis: true },
    { title: "Colaborador", dataIndex: "colaborador", width: 170, ellipsis: true },
    { title: "Data HE", dataIndex: "dataHe", render: (v) => dayjs(v).format("DD/MM/YY"), width: 85, align: "center" },
    { title: "Tipo", dataIndex: "tipo", render: (v) => (v === "PCT_50" ? "50%" : "100%"), width: 55, align: "center" },
    { title: "Horas", dataIndex: "horas", width: 55, align: "center" },
    { title: "Valor", dataIndex: "valor", render: (v) => formatadorMoeda.format(v), width: 95, align: "center" },
    {
      title: "Status",
      dataIndex: "status",
      width: 95,
      align: "center",
      render: (v) => <Tag color={STATUS_ITEM[v]?.color}>{STATUS_ITEM[v]?.label}</Tag>,
    },
    { title: "Solicitante", dataIndex: "solicitante", width: 130, ellipsis: true },
    {
      title: "Ações",
      width: 70,
      align: "center",
      render: (_, row) =>
        (row.podeEditar || row.podeExcluir) && (
          <Space size={4}>
            {row.podeEditar && <Button size="small" type="text" icon={<EditOutlined />} onClick={() => abrirEdicao(row)} />}
            {row.podeExcluir && (
              <Popconfirm title="Excluir esta solicitação?" onConfirm={() => excluir(row.solicitacaoId)}>
                <Button size="small" danger type="text" icon={<DeleteOutlined />} loading={excluindoId === row.solicitacaoId} />
              </Popconfirm>
            )}
          </Space>
        ),
    },
  ];

  return (
    <Card
      title={<PageTitle icon="horas-extras-calendario.svg">Solicitações</PageTitle>}
      extra={
        <Tooltip title="Baixa em Excel as solicitações que batem com os filtros aplicados abaixo.">
          <Button icon={<DownloadOutlined />} loading={exportando} onClick={exportar}>
            Exportar XLSX
          </Button>
        </Tooltip>
      }
    >
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
        Você só pode editar ou excluir solicitações próprias que ainda não foram aprovadas.
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Tooltip title="Filtra pelo andamento de cada item: pendente de aprovação, aprovado ou recusado.">
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 160 }}
            value={filtros.status}
            onChange={(v) => setFiltros((f) => ({ ...f, status: v }))}
            options={Object.entries(STATUS_ITEM).map(([value, { label }]) => ({ value, label }))}
          />
        </Tooltip>
        <Tooltip title="Filtra pelo gerente responsável pelo limite dessa solicitação.">
          <Select
            placeholder="Gerente"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            value={filtros.gerenteId}
            onChange={(v) => setFiltros((f) => ({ ...f, gerenteId: v }))}
            options={gerentes.map((g) => ({ value: g.id, label: g.nome }))}
          />
        </Tooltip>
        {podeFiltrarSolicitante && (
          <Tooltip title="Filtra por quem criou a solicitação. A tela abre mostrando só as suas; limpe o filtro para ver as de todos.">
            <Select
              placeholder="Solicitante (todos)"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 220 }}
              value={filtros.solicitanteId}
              onChange={(v) => setFiltros((f) => ({ ...f, solicitanteId: v }))}
              options={(solicitantes.some((s) => s.id === usuario.id)
                ? solicitantes
                : [{ id: usuario.id, nome: usuario.nome }, ...solicitantes]
              ).map((s) => ({ value: s.id, label: s.id === usuario.id ? `${s.nome} (você)` : s.nome }))}
            />
          </Tooltip>
        )}
        <Tooltip title="Busque pelo número de protocolo da solicitação.">
          <Input.Search
            placeholder="Protocolo"
            allowClear
            style={{ width: 180 }}
            onSearch={(v) => setFiltros((f) => ({ ...f, protocolo: v || undefined }))}
          />
        </Tooltip>
      </Space>
      <Table
        className="tabela-app tabela-compacta"
        size="small"
        dataSource={linhas}
        columns={colunas}
        loading={carregando}
        locale={{ emptyText: <EmptyState description="Nenhuma solicitação encontrada" /> }}
        pagination={{
          current: pagina,
          pageSize: 20,
          total: dados.total,
          onChange: setPagina,
          showTotal: (total) => `${total} solicitações`,
        }}
      />

      <Modal
        title="Editar item da solicitação"
        open={!!edicao}
        onOk={salvarEdicao}
        onCancel={() => setEdicao(null)}
        confirmLoading={salvandoEdicao}
        forceRender
      >
        {edicao && (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <div>
              <div style={{ marginBottom: 4 }}>Tipo</div>
              <Radio.Group value={edicao.tipo} onChange={(e) => setEdicao((s) => ({ ...s, tipo: e.target.value }))}>
                <Radio.Button value="PCT_50">50%</Radio.Button>
                <Radio.Button value="PCT_100">100%</Radio.Button>
              </Radio.Group>
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>Horas</div>
              <InputNumber
                min={0.5}
                step={0.5}
                style={{ width: "100%" }}
                value={edicao.horas}
                onChange={(v) => setEdicao((s) => ({ ...s, horas: v }))}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>Justificativa</div>
              <Select
                style={{ width: "100%" }}
                value={edicao.justificativa}
                onChange={(v) => setEdicao((s) => ({ ...s, justificativa: v }))}
                options={JUSTIFICATIVAS}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>Data HE</div>
              <DatePicker
                style={{ width: "100%" }}
                format="DD/MM/YYYY"
                value={edicao.dataHe}
                onChange={(v) => setEdicao((s) => ({ ...s, dataHe: v }))}
                allowClear={false}
              />
            </div>
          </Space>
        )}
      </Modal>
    </Card>
  );
}
