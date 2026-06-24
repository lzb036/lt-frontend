import { computed, readonly, shallowRef } from 'vue'

import type { AuthSession } from '../types/crawler'
import { apiClient, toApiErrorMessage } from '../utils/api'

const session = shallowRef<AuthSession | null>(null)
const checkingSession = shallowRef(false)
const loggingIn = shallowRef(false)
const authError = shallowRef('')

export function useAuth() {
  const authenticated = computed(() => Boolean(session.value))
  const sessionUsername = computed(() => session.value?.username ?? '')
  const isSuperadmin = computed(() => session.value?.role === 'superadmin')

  async function fetchSession() {
    checkingSession.value = true
    authError.value = ''
    try {
      const response = await apiClient.get<AuthSession>('/auth/session')
      session.value = response.data
      return response.data
    } catch (error) {
      session.value = null
      authError.value = toApiErrorMessage(error, '登录状态检查失败')
      throw error
    } finally {
      checkingSession.value = false
    }
  }

  async function login(payload: { username: string; password: string }) {
    loggingIn.value = true
    authError.value = ''
    try {
      const response = await apiClient.post<AuthSession>('/auth/login', payload)
      session.value = response.data
      return response.data
    } catch (error) {
      session.value = null
      authError.value = toApiErrorMessage(error, '登录失败')
      throw error
    } finally {
      loggingIn.value = false
    }
  }

  async function logout() {
    await apiClient.post('/auth/logout')
    session.value = null
  }

  return {
    session: readonly(session),
    checkingSession: readonly(checkingSession),
    loggingIn: readonly(loggingIn),
    authError: readonly(authError),
    authenticated,
    sessionUsername,
    isSuperadmin,
    fetchSession,
    login,
    logout,
  }
}
