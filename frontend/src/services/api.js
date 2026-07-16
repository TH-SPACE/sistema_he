import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || "Erro de comunicação com o servidor";
    return Promise.reject(new Error(message));
  }
);

export default api;
