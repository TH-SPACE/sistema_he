import React, { useCallback, useEffect, useState } from "react";
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, Upload, message, Popconfirm, Alert } from "antd";
import { CheckOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import api from "../../services/api";
import PageTitle from "../../components/PageTitle";

const PERFIS = ["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"];
const STATUS_COLOR = { PENDENTE: "gold", ATIVO: "green", INATIVO: "default" };

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase();
}

export default function Usuarios() {
  const [dados, setDados] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [gerentes, setGerentes] = useState([]);
  const [modal, setModal] = useState(null); // usuário em edição ou {} para criar
  const [salvando, setSalvando] = useState(false);
  const [aprovandoId, setAprovandoId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const [form] = Form.useForm();
  const [importModal, setImportModal] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [arquivoImport, setArquivoImport] = useState(null);
  const [importando, setImportando] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/usuarios");
      setDados(data.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    api.get("/gerentes").then(({ data }) => setGerentes(data.data));
  }, [carregar]);

  async function aprovar(id) {
    setAprovandoId(id);
    try {
      await api.post(`/usuarios/${id}/aprovar`);
      message.success("Usuário aprovado");
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setAprovandoId(null);
    }
  }

  async function excluir(id) {
    setExcluindoId(id);
    try {
      await api.delete(`/usuarios/${id}`);
      message.success("Usuário excluído");
      await carregar();
    } catch (err) {
      message.error(err.message);
    } finally {
      setExcluindoId(null);
    }
  }

  function abrirEdicao(usuario) {
    setModal(usuario);
    form.setFieldsValue(usuario || { perfil: "SOLICITADOR", status: "ATIVO" });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const valores = await form.validateFields();
      if (modal?.id) {
        await api.put(`/usuarios/${modal.id}`, valores);
      } else {
        await api.post("/usuarios", valores);
      }
      message.success("Usuário salvo");
      setModal(null);
      await carregar();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function baixarModelo() {
    setBaixandoModelo(true);
    try {
      const res = await api.get("/usuarios/modelo", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo_usuarios.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.message);
    } finally {
      setBaixandoModelo(false);
    }
  }

  async function importar() {
    if (!arquivoImport) return message.warning("Selecione um arquivo");
    setImportando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivoImport);
      const { data } = await api.post("/usuarios/importar?commit=true", formData, { headers: { "Content-Type": "multipart/form-data" } });
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

  function fecharImportModal() {
    setImportModal(false);
    setResultadoImport(null);
    setArquivoImport(null);
  }

  const colunas = [
    { title: "Usuário", dataIndex: "username" },
    { title: "Nome", dataIndex: "nome" },
    { title: "Email", dataIndex: "email" },
    { title: "Cargo (AD)", dataIndex: "cargoSolicitante" },
    { title: "Perfil", dataIndex: "perfil", render: (v) => <Tag>{v}</Tag> },
    { title: "Gerente", dataIndex: ["gerente", "nome"] },
    { title: "Status", dataIndex: "status", render: (v) => <Tag color={STATUS_COLOR[v]}>{v}</Tag> },
    {
      title: "Ações",
      render: (_, row) => (
        <Space>
          {row.status === "PENDENTE" && (
            <Popconfirm title="Aprovar este cadastro?" onConfirm={() => aprovar(row.id)}>
              <Button size="small" icon={<CheckOutlined />} loading={aprovandoId === row.id}>Aprovar</Button>
            </Popconfirm>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirEdicao(row)} />
          <Popconfirm title="Excluir este usuário?" onConfirm={() => excluir(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} loading={excluindoId === row.id} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const buscaNormalizada = normalizar(busca);
  const dadosFiltrados = buscaNormalizada
    ? dados.filter((u) =>
        [u.username, u.nome, u.email, u.cargoSolicitante, u.perfil, u.gerente?.nome, u.status].some((campo) =>
          normalizar(campo).includes(buscaNormalizada)
        )
      )
    : dados;

  return (
    <Card
      title={<PageTitle icon="vivo-vivinho-escudo-purpura-esquerda-320x320.svg">Usuários</PageTitle>}
      extra={
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportModal(true)}>Importar planilha</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirEdicao({})}>Novo usuário</Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
        Usuários com status <Tag color="gold" style={{ marginInline: 4 }}>PENDENTE</Tag> se cadastraram pelo login mas ainda
        precisam ser aprovados aqui antes de conseguir acessar o sistema.
      </div>
      <Input.Search
        placeholder="Buscar por usuário, nome, email, cargo, perfil, gerente ou status"
        allowClear
        style={{ width: 360, marginBottom: 12 }}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <Table className="tabela-app tabela-compacta" size="small" rowKey="id" dataSource={dadosFiltrados} columns={colunas} loading={carregando} pagination={{ pageSize: 20 }} />
      <Modal title={modal?.id ? "Editar usuário" : "Novo usuário"} open={!!modal} onOk={salvar} onCancel={() => setModal(null)} confirmLoading={salvando} forceRender>
        <Form form={form} layout="vertical">
          {!modal?.id && (
            <Form.Item name="username" label="Usuário (login)" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="nome" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item
            name="perfil"
            label="Perfil"
            rules={[{ required: true }]}
            tooltip="SOLICITADOR: cria solicitações de HE. APROVADOR: aprova/recusa solicitações de qualquer gerência. FOCAL: cadastra colaboradores, cargos e importa a base de HE executado. ADMIN: acesso total ao sistema."
          >
            <Select options={PERFIS.map((p) => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item
            name="gerenteId"
            label="Gerente vinculado (opcional)"
            tooltip="Para SOLICITADOR e FOCAL, este vínculo limita as solicitações e visões à gerência vinculada. Para APROVADOR, não restringe: ele aprova qualquer gerência."
          >
            <Select allowClear showSearch optionFilterProp="label" options={gerentes.map((g) => ({ value: g.id, label: g.nome }))} />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select options={["PENDENTE", "ATIVO", "INATIVO"].map((s) => ({ value: s, label: s }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Importar usuários.xlsx"
        open={importModal}
        onCancel={fecharImportModal}
        footer={
          resultadoImport
            ? [
                <Button key="outro" onClick={importarOutroArquivo}>Importar outro arquivo</Button>,
                <Button key="fechar" type="primary" onClick={() => setImportModal(false)}>Fechar</Button>,
              ]
            : [
                <Button key="modelo" icon={<DownloadOutlined />} loading={baixandoModelo} onClick={baixarModelo}>Baixar modelo</Button>,
                <Button key="importar" type="primary" loading={importando} onClick={importar}>Importar</Button>,
              ]
        }
      >
        {!resultadoImport ? (
          <>
            <div style={{ marginBottom: 12, fontSize: 12, color: "var(--he-text-muted)" }}>
              O arquivo deve ter as colunas Username, Nome, Email, Perfil (SOLICITADOR, APROVADOR, FOCAL ou ADMIN — vazio vira
              SOLICITADOR) e Gerente (nome do gerente já cadastrado; opcional, ignorado para APROVADOR). Baixe o modelo abaixo
              para ver o formato esperado. Linhas com erro não bloqueiam as demais — ao final você vê o que foi importado e o
              que precisa corrigir.
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
              message={`${resultadoImport.totalLinhas} linhas — ${resultadoImport.inseridos} importados — ${resultadoImport.erros} com erro`}
            />
            {resultadoImport.detalheErros?.length > 0 && (
              <div style={{ maxHeight: 240, overflow: "auto", fontSize: 12 }}>
                {resultadoImport.detalheErros.map((e, i) => (
                  <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--he-border)" }}>
                    <strong>Linha {e.linha}</strong>{e.username ? ` (usuário ${e.username})` : ""}: {e.erro}
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
