import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, theme as antdTheme } from "antd";
import ptBR from "antd/locale/pt_BR";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTema } from "./context/ThemeContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function AntdThemedApp() {
  const { modoEscuro } = useTema();
  return (
    <ConfigProvider
      locale={ptBR}
      theme={{
        algorithm: modoEscuro ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: modoEscuro
          ? { colorPrimary: "#1677ff" }
          : {
              colorPrimary: "#1677ff",
              // bordas um pouco mais escuras que o padrão do antd: em alguns
              // monitores as bordas claras (#d9d9d9/#f0f0f0) somem contra o
              // fundo claro do sistema, dificultando ver onde um filtro ou
              // tabela termina.
              colorBorder: "#b3b3b3",
              colorBorderSecondary: "#d0d0d0",
              colorSplit: "#d0d0d0",
            },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AntdThemedApp />
    </ThemeProvider>
  </React.StrictMode>
);
