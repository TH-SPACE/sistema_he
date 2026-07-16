import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Modal, Space } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function Login() {
  const { login } = useAuth();
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [abrirSolicitacao, setAbrirSolicitacao] = useState(false);
  const [emailSolicitacao, setEmailSolicitacao] = useState("");
  const [solicitando, setSolicitando] = useState(false);
  const [resultadoSolicitacao, setResultadoSolicitacao] = useState(null);

  async function onFinish(values) {
    setErro(null);
    setCarregando(true);
    try {
      await login(values.username, values.password);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function solicitarAcesso() {
    setSolicitando(true);
    try {
      const { data } = await api.post("/auth/solicitar-acesso", { email: emailSolicitacao });
      setResultadoSolicitacao(data.data);
    } catch (err) {
      setResultadoSolicitacao({ erro: err.message });
    } finally {
      setSolicitando(false);
    }
  }

  function fecharSolicitacao() {
    setAbrirSolicitacao(false);
    setEmailSolicitacao("");
    setResultadoSolicitacao(null);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f0f2f5" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 48 }}>
        <img
          src="/img_vivo/vivo-formulario-folha-lapis-purpura-esquerda-320x320.svg"
          alt=""
          className="login-hero"
          style={{ width: 280, height: 280 }}
        />
        <Card style={{ width: 380 }}>
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <img src="/img_vivo/horas-extras-vivo.svg" alt="" style={{ width: 48, height: 48 }} />
          </div>
          <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 4 }}>
            Portal HE - CONO
          </Typography.Title>
          {import.meta.env.DEV && (
            <Typography.Text type="warning" style={{ display: "block", textAlign: "center", marginBottom: 16 }}>
              Modo DEV — autenticação via credenciais locais
            </Typography.Text>
          )}
          {erro && <Alert type="error" message={erro} style={{ marginBottom: 16 }} showIcon />}
          <Form layout="vertical" onFinish={onFinish} disabled={carregando}>
            <Form.Item name="username" label="Usuário" rules={[{ required: true, message: "Informe o usuário" }]}>
              <Input prefix={<UserOutlined />} autoFocus />
            </Form.Item>
            <Form.Item name="password" label="Senha" rules={[{ required: true, message: "Informe a senha" }]}>
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={carregando}>
                Entrar
              </Button>
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button block onClick={() => setAbrirSolicitacao(true)}>
                Solicitar Acesso
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
      <div style={{ textAlign: "center", color: "rgba(0,0,0,0.65)", fontSize: 12, padding: 16 }}>
        Portal HE - CONO — Responsável: Thiago Alves Nunes
      </div>

      <Modal
        title="Solicitar Acesso"
        open={abrirSolicitacao}
        onCancel={fecharSolicitacao}
        onOk={solicitarAcesso}
        okText="Enviar Solicitação"
        confirmLoading={solicitando}
        okButtonProps={{ disabled: !emailSolicitacao.toLowerCase().endsWith("@telefonica.com") }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Typography.Text type="secondary">
            Informe seu e-mail corporativo @telefonica.com para registrar a solicitação de acesso.
          </Typography.Text>
          <Input
            value={emailSolicitacao}
            onChange={(e) => setEmailSolicitacao(e.target.value.trim())}
            placeholder="nome.sobrenome@telefonica.com"
            autoComplete="email"
          />
          {resultadoSolicitacao?.erro && <Alert type="error" message={resultadoSolicitacao.erro} showIcon />}
          {resultadoSolicitacao?.mensagem && (
            <Alert
              type="success"
              showIcon
              message={resultadoSolicitacao.mensagem}
              description={
                <div>
                  <div><strong>Nome:</strong> {resultadoSolicitacao.nome}</div>
                  <div><strong>E-mail:</strong> {resultadoSolicitacao.email}</div>
                  <div><strong>Cargo no AD:</strong> {resultadoSolicitacao.cargoSolicitante || "Não informado"}</div>
                  <div><strong>Status:</strong> {resultadoSolicitacao.status}</div>
                </div>
              }
            />
          )}
        </Space>
      </Modal>
    </div>
  );
}
