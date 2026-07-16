import React, { useCallback, useEffect, useState } from "react";
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, message, Tag } from "antd";
import { EditOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
import api from "../../services/api";
import { formatadorMoeda } from "../../constants";
import PageTitle from "../../components/PageTitle";

export default function Gerentes() {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [desativandoId, setDesativandoId] = useState(null);
  const [form] = Form.useForm();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/gerentes");
      setDados(data.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrir(gerente) {
    setModal(gerente);
    form.setFieldsValue(gerente || {});
  }

  async function salvar() {
    setSalvando(true);
    try {
      const valores = await form.validateFields();
      if (modal?.id) {
        await api.put(`/gerentes/${modal.id}`, valores);
      } else {
        await api.post("/gerentes", valores);
      }
      message.success("Gerente salvo");
      setModal(null);
      await carregar();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(id) {
    setDesativandoId(id);
    try {
      await api.delete(`/gerentes/${id}`);
      message.success("Gerente desativado");
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setDesativandoId(null);
    }
  }

  const colunas = [
    { title: "Gerente", dataIndex: "nome" },
    { title: "Gerência Sr", dataIndex: "gerenciaSr", render: (v) => v || <span style={{ color: "var(--he-text-disabled)" }}>—</span> },
    { title: "Limite mensal", dataIndex: "valorLimite", render: (v) => formatadorMoeda.format(Number(v)) },
    { title: "Status", dataIndex: "ativo", render: (v) => <Tag color={v ? "green" : "default"}>{v ? "Ativo" : "Inativo"}</Tag> },
    {
      title: "Ações",
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrir(row)} />
          {row.ativo && (
            <Button size="small" danger icon={<StopOutlined />} loading={desativandoId === row.id} onClick={() => desativar(row.id)} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card title={<PageTitle icon="vivo-predio-estrela-purpura-centro-320x320.svg">Gerentes & Limites</PageTitle>} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)}>Novo gerente</Button>}>
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
        O limite mensal é apenas um alerta visual — se as solicitações de um gerente ultrapassarem esse valor no mês, o
        sistema avisa, mas não bloqueia o envio.
      </div>
      <Table className="tabela-app tabela-compacta" size="small" rowKey="id" dataSource={dados} columns={colunas} loading={carregando} pagination={{ pageSize: 20 }} />
      <Modal title={modal?.id ? "Editar gerente" : "Novo gerente"} open={!!modal} onOk={salvar} onCancel={() => setModal(null)} confirmLoading={salvando} forceRender>
        <Form form={form} layout="vertical">
          <Form.Item name="nome" label="Nome do gerente" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="valorLimite" label="Limite mensal (R$)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="gerenciaSr"
            label="Gerência Sr"
            tooltip="Nome do gerente sênior/divisão a quem este gerente se reporta. Usado só para agrupar relatórios (ex: HE Executado por Gerência)."
          >
            <Input placeholder="Opcional" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
