import React, { useCallback, useEffect, useState } from "react";
import { Card, Table, Button, Space, Modal, Form, Input, Select, Upload, message, Tag, Alert, Popconfirm } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, StopOutlined, UploadOutlined } from "@ant-design/icons";
import api from "../services/api";
import PageTitle from "../components/PageTitle";
import { useAuth } from "../context/AuthContext";

export default function Colaboradores() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState({ itens: [], total: 0 });
  const [carregando, setCarregando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [cargos, setCargos] = useState([]);
  const [gerentes, setGerentes] = useState([]);
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [desativandoId, setDesativandoId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const [form] = Form.useForm();
  const [importModal, setImportModal] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [arquivoImport, setArquivoImport] = useState(null);
  const [importando, setImportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/colaboradores", { params: { q: busca || undefined, page: pagina, pageSize: 20 } });
      setDados(data.data);
    } finally {
      setCarregando(false);
    }
  }, [busca, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    api.get("/cargos", { params: { ativo: true } }).then(({ data }) => setCargos(data.data));
    api.get("/gerentes", { params: { ativo: true } }).then(({ data }) => setGerentes(data.data));
  }, []);

  function abrir(colaborador) {
    setModal(colaborador);
    form.setFieldsValue(colaborador ? { ...colaborador, cargoId: colaborador.cargo.id, gerenteId: colaborador.gerente.id } : {});
  }

  async function salvar() {
    setSalvando(true);
    try {
      const valores = await form.validateFields();
      if (modal?.id) {
        await api.put(`/colaboradores/${modal.id}`, valores);
      } else {
        await api.post("/colaboradores", valores);
      }
      message.success("Colaborador salvo");
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
      await api.delete(`/colaboradores/${id}`);
      message.success("Colaborador desativado");
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setDesativandoId(null);
    }
  }

  async function excluir(id) {
    setExcluindoId(id);
    try {
      await api.delete(`/colaboradores/${id}/permanente`);
      message.success("Colaborador excluído");
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setExcluindoId(null);
    }
  }

  async function importar() {
    if (!arquivoImport) return message.warning("Selecione um arquivo");
    setImportando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivoImport);
      const { data } = await api.post("/colaboradores/importar?commit=true", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setResultadoImport(data.data);
      setArquivoImport(null);
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setImportando(false);
    }
  }

  function importarOutroArquivo() {
    setResultadoImport(null);
    setArquivoImport(null);
  }

  const colunas = [
    { title: "Matrícula", dataIndex: "matricula", width: 100 },
    { title: "Nome", dataIndex: "nome" },
    { title: "Cargo", dataIndex: ["cargo", "nome"] },
    { title: "Gerente", dataIndex: ["gerente", "nome"] },
    { title: "Gerência", dataIndex: "gerencia" },
    { title: "Status", dataIndex: "ativo", render: (v) => <Tag color={v ? "green" : "default"}>{v ? "Ativo" : "Inativo"}</Tag> },
    {
      title: "Ações",
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrir(row)} />
          {row.ativo && (
            <Popconfirm title="Desativar este colaborador?" onConfirm={() => desativar(row.id)}>
              <Button size="small" danger icon={<StopOutlined />} loading={desativandoId === row.id} />
            </Popconfirm>
          )}
          {usuario?.perfil === "ADMIN" && (
            <Popconfirm
              title="Excluir definitivamente este colaborador?"
              description="Essa ação não pode ser desfeita. Se ele tiver solicitações de HE vinculadas, a exclusão será bloqueada."
              onConfirm={() => excluir(row.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} loading={excluindoId === row.id} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<PageTitle icon="vivo-homem-ferramentas-320x320.svg">Colaboradores</PageTitle>}
      extra={
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportModal(true)}>Importar planilha</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)}>Novo colaborador</Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
        Cadastre colaboradores manualmente ou importe uma planilha (.xlsx) com vários de uma vez.
      </div>
      <Input.Search placeholder="Buscar por nome ou matrícula" allowClear style={{ width: 300, marginBottom: 16 }} onSearch={setBusca} />
      <Table
        className="tabela-app tabela-compacta"
        size="small"
        rowKey="id"
        dataSource={dados.itens}
        columns={colunas}
        loading={carregando}
        pagination={{ current: pagina, pageSize: 20, total: dados.total, onChange: setPagina }}
      />

      <Modal
        title={modal?.id ? "Editar colaborador" : "Novo colaborador"}
        open={!!modal}
        onOk={salvar}
        onCancel={() => setModal(null)}
        confirmLoading={salvando}
        forceRender
      >
        <Form form={form} layout="vertical">
          <Form.Item name="matricula" label="Matrícula" rules={[{ required: true }]}>
            <Input disabled={!!modal?.id} />
          </Form.Item>
          <Form.Item name="nome" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="cargoId" label="Cargo" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={cargos.map((c) => ({ value: c.id, label: c.nome }))} />
          </Form.Item>
          <Form.Item name="gerenteId" label="Gerente" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={gerentes.map((g) => ({ value: g.id, label: g.nome }))} />
          </Form.Item>
          <Form.Item name="gerencia" label="Gerência (departamento)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Importar colaboradores.xlsx"
        open={importModal}
        onCancel={() => {
          setImportModal(false);
          setResultadoImport(null);
          setArquivoImport(null);
        }}
        footer={
          resultadoImport
            ? [
                <Button key="outro" onClick={importarOutroArquivo}>Importar outro arquivo</Button>,
                <Button key="fechar" type="primary" onClick={() => setImportModal(false)}>Fechar</Button>,
              ]
            : [
                <Button key="importar" type="primary" loading={importando} onClick={importar}>Importar</Button>,
              ]
        }
      >
        {!resultadoImport ? (
          <>
            <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
              O arquivo deve ter as colunas Matrícula, Nome, Cargo, Gerente (e opcionalmente Gerência, Regional, Estado, Cidade,
              Gestor Direto). Cargo e Gerente precisam já existir no sistema com o mesmo nome. Linhas com erro não bloqueiam as
              demais — ao final você vê o que foi importado e o que precisa corrigir.
            </div>
            <Upload beforeUpload={(file) => { setArquivoImport(file); return false; }} onRemove={() => setArquivoImport(null)} maxCount={1}>
              <Button icon={<UploadOutlined />}>Selecionar arquivo .xlsx</Button>
            </Upload>
          </>
        ) : (
          <>
            <Alert
              style={{ marginBottom: 12 }}
              type={resultadoImport.erros > 0 ? "warning" : "success"}
              showIcon
              message={`${resultadoImport.totalLinhas} linhas — ${resultadoImport.inseridos} importadas — ${resultadoImport.erros} com erro`}
            />
            {resultadoImport.detalheErros?.length > 0 && (
              <div style={{ maxHeight: 240, overflow: "auto", fontSize: 12 }}>
                {resultadoImport.detalheErros.map((e, i) => (
                  <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--he-border)" }}>
                    <strong>Linha {e.linha}</strong>{e.matricula ? ` (matrícula ${e.matricula})` : ""}: {e.erro}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </Card>
  );
}
