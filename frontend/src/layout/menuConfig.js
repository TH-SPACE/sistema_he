import {
  DashboardOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  CheckSquareOutlined,
  TeamOutlined,
  FileExcelOutlined,
  SettingOutlined,
  UserOutlined,
  IdcardOutlined,
  ApartmentOutlined,
  AuditOutlined,
} from "@ant-design/icons";

// perfis: SOLICITADOR, APROVADOR, FOCAL, ADMIN
export const menuItems = [
  { key: "/dashboard", label: "Dashboard", icon: DashboardOutlined, perfis: ["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"] },
  { key: "/nova-solicitacao", label: "Nova Solicitação", icon: FileAddOutlined, perfis: ["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"] },
  { key: "/solicitacoes", label: "Solicitações", icon: UnorderedListOutlined, perfis: ["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"] },
  { key: "/aprovacoes", label: "Aprovações", icon: CheckSquareOutlined, perfis: ["APROVADOR", "ADMIN"] },
  { key: "/colaboradores", label: "Colaboradores", icon: TeamOutlined, perfis: ["FOCAL", "ADMIN"] },
  { key: "/he-executado", label: "HE Executado", icon: FileExcelOutlined, perfis: ["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"] },
  { key: "/auditoria", label: "Auditoria", icon: AuditOutlined, perfis: ["FOCAL"] },
  {
    key: "/admin",
    label: "Administração",
    icon: SettingOutlined,
    perfis: ["ADMIN"],
    children: [
      { key: "/admin/usuarios", label: "Usuários", icon: UserOutlined, perfis: ["ADMIN"] },
      { key: "/admin/cargos", label: "Cargos & Valores", icon: IdcardOutlined, perfis: ["ADMIN"] },
      { key: "/admin/gerentes", label: "Gerentes & Limites", icon: ApartmentOutlined, perfis: ["ADMIN"] },
      { key: "/admin/auditoria", label: "Auditoria", icon: AuditOutlined, perfis: ["ADMIN"] },
    ],
  },
];

export function menuParaPerfil(perfil) {
  return menuItems
    .filter((item) => item.perfis.includes(perfil))
    .map((item) => ({
      ...item,
      children: item.children?.filter((c) => c.perfis.includes(perfil)),
    }));
}
