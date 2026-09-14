import axios from 'axios'
import { useAuthStore } from '../store/authStore'

function apiBase(): string {
  const root = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
  return root.endsWith('/api') ? root.slice(0, -4) : root
}

export function apiRoot(): string {
  return `${apiBase()}/api`
}

const api = axios.create({})

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  config.url = `${apiBase()}${config.url}`
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(
          `${apiRoot()}/auth/refresh`,
          { refresh: refreshToken }
        )
        useAuthStore.getState().setTokens(data.access, data.refresh)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
      }
    }

    return Promise.reject(error)
  }
)

export default api