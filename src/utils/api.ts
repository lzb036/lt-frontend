import axios from 'axios'

export const MAINTENANCE_STATUS_EVENT = 'lt:maintenance-status'
export const TAB_SESSION_TOKEN_KEY = 'lt_tab_session_token'

export function resolveApiBaseUrl() {
  const configured = (import.meta.env?.VITE_API_BASE_URL || '').trim()
  return configured.length > 0 ? configured : '/api'
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  timeout: 60_000,
})

apiClient.interceptors.request.use((config) => {
  if (typeof window === 'undefined') {
    return config
  }
  const token = window.sessionStorage.getItem(TAB_SESSION_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error)
      && error.response?.status === 503
      && error.response.data?.maintenance?.active === true
      && typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent(MAINTENANCE_STATUS_EVENT, {
        detail: error.response.data.maintenance,
      }))
    }
    return Promise.reject(error)
  },
)

export function toApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}
