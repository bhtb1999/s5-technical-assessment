import axios from "axios";

let getToken: (() => string | null) | null = null;
let clearAuth: (() => void) | null = null;

export function initApiClient(
  tokenGetter: () => string | null,
  authClearer: () => void,
) {
  getToken = tokenGetter;
  clearAuth = authClearer;
}

const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getToken ? getToken() : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (clearAuth) {
        clearAuth();
      }
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
