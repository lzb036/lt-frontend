import axios from 'axios'

export const MAINTENANCE_STATUS_EVENT = 'lt:maintenance-status'

export function resolveApiBaseUrl() {
  const configured = (import.meta.env?.VITE_API_BASE_URL || '').trim()
  return configured.length > 0 ? configured : '/api'
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  timeout: 60_000,
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
