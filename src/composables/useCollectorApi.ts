import type {
  AuthSession,
  CrawlSource,
  CrawlSourcePayload,
  CrawlTask,
  CreateTaskPayload,
  ProductItem,
  ReviewStatus,
  SecretProfile,
  SecretProfilePayload,
  UserAccount,
} from '../types/crawler'
import { apiClient } from '../utils/api'

export function useCollectorApi() {
  async function listUsers() {
    const response = await apiClient.get<{ users: UserAccount[] }>('/users')
    return response.data.users
  }

  async function createUser(payload: { username: string; password: string; displayName: string }) {
    const response = await apiClient.post<{ user: UserAccount; users: UserAccount[] }>('/users', payload)
    return response.data
  }

  async function updateUser(username: string, payload: { displayName?: string; enabled?: boolean }) {
    const response = await apiClient.put<{ user: UserAccount; users: UserAccount[] }>(`/users/${encodeURIComponent(username)}`, payload)
    return response.data
  }

  async function resetPassword(username: string, password: string) {
    const response = await apiClient.put<{ user: UserAccount; users: UserAccount[] }>(
      `/users/${encodeURIComponent(username)}/password`,
      { password },
    )
    return response.data
  }

  async function getSecretProfile() {
    const response = await apiClient.get<{ profile: SecretProfile }>('/profile/secrets')
    return response.data.profile
  }

  async function updateSecretProfile(payload: SecretProfilePayload) {
    const response = await apiClient.put<{ profile: SecretProfile }>('/profile/secrets', payload)
    return response.data.profile
  }

  async function verifySecretProfile() {
    const response = await apiClient.post<{ profile: SecretProfile }>('/profile/secrets/verify')
    return response.data.profile
  }

  async function listSources() {
    const response = await apiClient.get<{ sources: CrawlSource[] }>('/crawler/sources')
    return response.data.sources
  }

  async function saveSource(payload: CrawlSourcePayload, id?: number) {
    const request = id
      ? apiClient.put<{ source: CrawlSource; sources: CrawlSource[] }>(`/crawler/sources/${id}`, payload)
      : apiClient.post<{ source: CrawlSource; sources: CrawlSource[] }>('/crawler/sources', payload)
    const response = await request
    return response.data
  }

  async function deleteSource(id: number) {
    const response = await apiClient.delete<{ sources: CrawlSource[] }>(`/crawler/sources/${id}`)
    return response.data.sources
  }

  async function listTasks() {
    const response = await apiClient.get<{ tasks: CrawlTask[] }>('/crawler/tasks')
    return response.data.tasks
  }

  async function createTask(payload: CreateTaskPayload) {
    const response = await apiClient.post<{ task: CrawlTask; tasks: CrawlTask[] }>('/crawler/tasks', payload)
    return response.data
  }

  async function listProducts(params: { status?: ReviewStatus | ''; keyword?: string }) {
    const response = await apiClient.get<{ products: ProductItem[] }>('/crawler/products', { params })
    return response.data.products
  }

  function isSuperadmin(session: AuthSession | null | undefined) {
    return session?.role === 'superadmin'
  }

  return {
    listUsers,
    createUser,
    updateUser,
    resetPassword,
    getSecretProfile,
    updateSecretProfile,
    verifySecretProfile,
    listSources,
    saveSource,
    deleteSource,
    listTasks,
    createTask,
    listProducts,
    isSuperadmin,
  }
}
