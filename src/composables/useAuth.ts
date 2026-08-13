import { computed, readonly, shallowRef } from 'vue'
import axios from 'axios'

import type { AuthSession } from '../types/crawler'
import { apiClient, TAB_SESSION_TOKEN_KEY, toApiErrorMessage } from '../utils/api'

const session = shallowRef<AuthSession | null>(null)
const checkingSession = shallowRef(false)
const loggingIn = shallowRef(false)
const authError = shallowRef('')

function normalizeAuthSession(value: AuthSession): AuthSession {
  return {
    ...value,
    paginationPreferences: value.paginationPreferences || {},
  }
}

export function useAuth() {
  const authenticated = computed(() => Boolean(session.value))
  const sessionUsername = computed(() => session.value?.username ?? '')
  const isSuperadmin = computed(() => session.value?.role === 'superadmin')

  async function fetchSession() {
    checkingSession.value = true
    authError.value = ''
    try {
      const response = await apiClient.get<AuthSession>('/auth/session')
      session.value = normalizeAuthSession(response.data)
      return session.value
    } catch (error) {
      session.value = null
      authError.value = isUnauthorizedSessionCheck(error) ? '' : toApiErrorMessage(error, '登录状态检查失败')
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
      window.sessionStorage.removeItem(TAB_SESSION_TOKEN_KEY)
      session.value = normalizeAuthSession(response.data)
      return session.value
    } catch (error) {
      session.value = null
      authError.value = toApiErrorMessage(error, '登录失败')
      throw error
    } finally {
      loggingIn.value = false
    }
  }

  async function logout() {
    if (window.sessionStorage.getItem(TAB_SESSION_TOKEN_KEY)) {
      window.sessionStorage.removeItem(TAB_SESSION_TOKEN_KEY)
    } else {
      await apiClient.post('/auth/logout')
    }
    session.value = null
  }

  async function consumeImpersonationToken(token: string) {
    const response = await apiClient.post<{
      session: AuthSession
      sessionToken: string
    }>('/auth/impersonation/consume', { token })
    window.sessionStorage.setItem(
      TAB_SESSION_TOKEN_KEY,
      response.data.sessionToken,
    )
    session.value = normalizeAuthSession(response.data.session)
    return session.value
  }

  async function updatePaginationPreference(listKey: string, pageSize: number) {
    if (!session.value) {
      return
    }
    const username = session.value.username
    const previousPreferences = session.value.paginationPreferences || {}
    const previousPageSize = previousPreferences[listKey]
    session.value = {
      ...session.value,
      paginationPreferences: {
        ...previousPreferences,
        [listKey]: pageSize,
      },
    }
    try {
      await apiClient.put<{ paginationPreferences: Record<string, number> }>(
        '/profile/pagination-preferences',
        { listKey, pageSize },
      )
    } catch (error) {
      if (
        session.value?.username === username
        && session.value.paginationPreferences?.[listKey] === pageSize
      ) {
        const revertedPreferences = { ...session.value.paginationPreferences }
        if (previousPageSize === undefined) {
          delete revertedPreferences[listKey]
        } else {
          revertedPreferences[listKey] = previousPageSize
        }
        session.value = {
          ...session.value,
          paginationPreferences: revertedPreferences,
        }
      }
      throw error
    }
  }

  function isUnauthorizedSessionCheck(error: unknown) {
    return axios.isAxiosError(error) && error.response?.status === 401
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
    consumeImpersonationToken,
    updatePaginationPreference,
  }
}
