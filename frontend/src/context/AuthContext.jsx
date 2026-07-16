import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregarMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUsuario(data.data);
    } catch {
      setUsuario(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarMe();
  }, [carregarMe]);

  async function login(username, password) {
    const { data } = await api.post("/auth/login", { username, password });
    await carregarMe();
    return data.data;
  }

  async function logout() {
    await api.post("/auth/logout");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout, recarregar: carregarMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
