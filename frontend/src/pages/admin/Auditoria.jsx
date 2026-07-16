import React, { useCallback, useEffect, useState } from "react";
import { Card, Table, Modal, Descriptions, Button, Space, Input, Popconfirm, message, Typography } from "antd";
import { EyeOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../services/api";
import PageTitle from "../../components/PageTitle";

export default function Auditoria() {
  const [dados, setDados] = useState({ itens: [], total: 0 });
  const [carregando, setCarregando] = useState(false);
  const [filtros, setFiltros] = useState({});
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState(null);
  const [limpando, setLimpando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/auditoria", { params: { ...filtros, page: pagina, pageSize: 20 } });
      setDados(data.data);
    } finally {
      setCarregando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function limparTudo() {
    setLimpando(true);
    try {
      const { data } = await api.delete("/auditoria");
      message.success(`${data.data.removidos} registro(s) de auditoria removido(s)`);
      setPagina(1);
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setLimpando(false);
    }
  }

  const colunas = [
    { title: "Data", dataIndex: "criadoEm", render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm:ss"), width: 160 },
    { title: "Usuário", dataIndex: ["usuario", "nome"], width: 180 },
    { title: "Ação", dataIndex: "acao", width: 180 },
    { title: "Entidade", dataIndex: "entidade", width: 140 },
    { title: "ID", dataIndex: "entidadeId", width: 80 },
    { title: "IP", dataIndex: "ip", width: 120 },
    {
      title: "Detalhe",
      width: 80,
      render: (_, row) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalhe(row)} />,
    },
  ];

  return (
    <Card
      title={<PageTitle icon="lupa-320x320.svg">Auditoria</PageTitle>}
      extra={
        <Popconfirm
          title="Limpar todo o histórico de auditoria?"
          description="Essa ação remove permanentemente todos os registros. Não pode ser desfeita."
          onConfirm={limparTudo}
          okText="Limpar tudo"
          okButtonProps={{ danger: true }}
        >
          <Button danger icon={<DeleteOutlined />} loading={limpando}>Limpar auditorias</Button>
        </Popconfirm>
      }
    >
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        Aqui ficam registradas todas as ações importantes do sistema (login, criação e edição de solicitações, aprovações,
        alterações de cadastro etc.), com quem fez e quando. Registros com mais de 90 dias são removidos automaticamente
        todos os dias.
      </Typography.Text>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search placeholder="Ação" allowClear onSearch={(v) => setFiltros((f) => ({ ...f, acao: v || undefined }))} style={{ width: 200 }} />
        <Input.Search placeholder="Entidade" allowClear onSearch={(v) => setFiltros((f) => ({ ...f, entidade: v || undefined }))} style={{ width: 200 }} />
      </Space>
      <Table
        className="tabela-app tabela-compacta"
        size="small"
        rowKey="id"
        dataSource={dados.itens}
        columns={colunas}
        loading={carregando}
        pagination={{ current: pagina, pageSize: 20, total: dados.total, onChange: setPagina }}
      />
      <Modal title="Detalhe da auditoria" open={!!detalhe} onCancel={() => setDetalhe(null)} footer={null} width={700}>
        {detalhe && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Ação">{detalhe.acao}</Descriptions.Item>
              <Descriptions.Item label="Entidade">{detalhe.entidade}</Descriptions.Item>
              <Descriptions.Item label="Usuário">{detalhe.usuario?.nome}</Descriptions.Item>
              <Descriptions.Item label="Data">{dayjs(detalhe.criadoEm).format("DD/MM/YYYY HH:mm:ss")}</Descriptions.Item>
            </Descriptions>
            <Space align="start" style={{ width: "100%" }} size="large">
              <div style={{ flex: 1 }}>
                <strong>Antes</strong>
                <pre style={{ background: "var(--he-header-bg)", color: "var(--he-text-strong)", padding: 8, maxHeight: 300, overflow: "auto" }}>
                  {JSON.stringify(detalhe.dadosAntes, null, 2)}
                </pre>
              </div>
              <div style={{ flex: 1 }}>
                <strong>Depois</strong>
                <pre style={{ background: "var(--he-header-bg)", color: "var(--he-text-strong)", padding: 8, maxHeight: 300, overflow: "auto" }}>
                  {JSON.stringify(detalhe.dadosDepois, null, 2)}
                </pre>
              </div>
            </Space>
          </>
        )}
      </Modal>
    </Card>
  );
}
