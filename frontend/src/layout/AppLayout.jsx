import React, { useMemo, useState } from "react";
import { Layout, Menu, Dropdown, Avatar, Tag, Switch, Typography, theme } from "antd";
import { UserOutlined, LogoutOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTema } from "../context/ThemeContext";
import { menuParaPerfil } from "./menuConfig";

const { Sider, Header, Content, Footer } = Layout;

function buildMenuItems(items) {
  return items.map((item) => ({
    key: item.key,
    icon: item.icon ? React.createElement(item.icon) : null,
    label: item.label,
    children: item.children?.length ? buildMenuItems(item.children) : undefined,
  }));
}

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const { modoEscuro, alternar } = useTema();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  const menu = useMemo(() => (usuario ? menuParaPerfil(usuario.perfil) : []), [usuario]);
  const antdMenuItems = useMemo(() => buildMenuItems(menu), [menu]);

  const userMenu = {
    items: [
      { key: "logout", icon: <LogoutOutlined />, label: "Sair" },
    ],
    onClick: async ({ key }) => {
      if (key === "logout") {
        await logout();
        navigate("/login");
      }
    },
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ position: "fixed", insetInlineStart: 0, top: 0, bottom: 0, overflow: "auto", zIndex: 10 }}
      >
        <div
          style={{
            height: 48,
            margin: 12,
            color: "#fff",
            fontWeight: 600,
            textAlign: "center",
            overflow: "hidden",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <img src="/img_vivo/horas-extras-vivo.svg" alt="" style={{ width: 28, height: 28, flexShrink: 0 }} />
          {!collapsed && "Portal HE - CONO"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={["/admin"]}
          items={antdMenuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ marginInlineStart: collapsed ? 80 : 200, transition: "margin-inline-start 0.2s" }}>
        <Header
          style={{
            background: token.colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            padding: "0 24px",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {import.meta.env.DEV && <Tag color="gold">Modo DEV</Tag>}
          <Switch
            checked={modoEscuro}
            onChange={alternar}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
          />
          <Dropdown menu={userMenu} placement="bottomRight">
            <span style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar icon={<UserOutlined />} size="small" />
              <Typography.Text>{usuario?.nome}</Typography.Text>
              <Tag>{usuario?.perfil}</Tag>
            </span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
        <Footer style={{ textAlign: "center" }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Portal HE - CONO — Responsável: Thiago Alves Nunes
          </Typography.Text>
        </Footer>
      </Layout>
    </Layout>
  );
}
