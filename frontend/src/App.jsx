import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./layout/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NovaSolicitacao from "./pages/NovaSolicitacao";
import FilaSolicitacoes from "./pages/FilaSolicitacoes";
import Aprovacoes from "./pages/Aprovacoes";
import Colaboradores from "./pages/Colaboradores";
import HeExecutado from "./pages/HeExecutado";
import Auditoria from "./pages/admin/Auditoria";
import Usuarios from "./pages/admin/Usuarios";
import Cargos from "./pages/admin/Cargos";
import Gerentes from "./pages/admin/Gerentes";

function Protegida({ perfis, children }) {
  const { usuario } = useAuth();
  if (perfis && !perfis.includes(usuario.perfil)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!usuario) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/nova-solicitacao" element={<NovaSolicitacao />} />
        <Route path="/solicitacoes" element={<FilaSolicitacoes />} />
        <Route
          path="/aprovacoes"
          element={
            <Protegida perfis={["APROVADOR", "ADMIN"]}>
              <Aprovacoes />
            </Protegida>
          }
        />
        <Route
          path="/colaboradores"
          element={
            <Protegida perfis={["FOCAL", "ADMIN"]}>
              <Colaboradores />
            </Protegida>
          }
        />
        <Route
          path="/he-executado"
          element={
            <Protegida perfis={["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"]}>
              <HeExecutado />
            </Protegida>
          }
        />
        <Route
          path="/auditoria"
          element={
            <Protegida perfis={["FOCAL", "ADMIN"]}>
              <Auditoria />
            </Protegida>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <Protegida perfis={["ADMIN"]}>
              <Usuarios />
            </Protegida>
          }
        />
        <Route
          path="/admin/cargos"
          element={
            <Protegida perfis={["ADMIN"]}>
              <Cargos />
            </Protegida>
          }
        />
        <Route
          path="/admin/gerentes"
          element={
            <Protegida perfis={["ADMIN"]}>
              <Gerentes />
            </Protegida>
          }
        />
        <Route
          path="/admin/auditoria"
          element={
            <Protegida perfis={["ADMIN"]}>
              <Auditoria />
            </Protegida>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
