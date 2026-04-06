import axios from 'axios'

// We import the store lazily to avoid circular dependency issues at module init time.
// The store module must not import from this file.
let getToken: (() => string | null) | null = null
let clearAuth: (() => void) | null = null

export function initApiClient(
  tokenGetter: () => string | null,
  authClearer: () => void,
) {
  getToken = tokenGetter
  clearAuth = authClearer
}

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken ? getToken() : null
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response interceptor: handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (clearAuth) {
        clearAuth()
      }
      // Only redirect if not already on the login page to avoid redirect loops
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
