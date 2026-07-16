import React, { useCallback, useEffect, useState } from "react";
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, message, Tag } from "antd";
import { EditOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
import api from "../../services/api";
import { formatadorMoeda } from "../../constants";
import PageTitle from "../../components/PageTitle";

export default function Cargos() {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [desativandoId, setDesativandoId] = useState(null);
  const [form] = Form.useForm();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/cargos");
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

  function abrir(cargo) {
    setModal(cargo);
    form.setFieldsValue(cargo || {});
  }

  async function salvar() {
    setSalvando(true);
    try {
      const valores = await form.validateFields();
      if (modal?.id) {
        await api.put(`/cargos/${modal.id}`, valores);
      } else {
        await api.post("/cargos", valores);
      }
      message.success("Cargo salvo");
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
      await api.delete(`/cargos/${id}`);
      message.success("Cargo desativado");
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setDesativandoId(null);
    }
  }

  const colunas = [
    { title: "Cargo", dataIndex: "nome" },
    { title: "HE 50%", dataIndex: "valorHora50", render: (v) => formatadorMoeda.format(Number(v)) },
    { title: "HE 100%", dataIndex: "valorHora100", render: (v) => formatadorMoeda.format(Number(v)) },
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
    <Card title={<PageTitle icon="vivo-ferramentas-engrenagem-purpura-centro-320x320.svg">Cargos & Valores</PageTitle>} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)}>Novo cargo</Button>}>
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
        Os valores de HE 50% e HE 100% já são o valor final da hora extra (não é preciso multiplicar por nenhum fator) —
        eles são aplicados automaticamente quando alguém solicita horas extras para um colaborador com este cargo.
      </div>
      <Table className="tabela-app tabela-compacta" size="small" rowKey="id" dataSource={dados} columns={colunas} loading={carregando} pagination={{ pageSize: 20 }} />
      <Modal title={modal?.id ? "Editar cargo" : "Novo cargo"} open={!!modal} onOk={salvar} onCancel={() => setModal(null)} confirmLoading={salvando} forceRender>
        <Form form={form} layout="vertical">
          <Form.Item name="nome" label="Nome do cargo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="valorHora50" label="Valor HE 50% (R$)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="valorHora100" label="Valor HE 100% (R$)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
