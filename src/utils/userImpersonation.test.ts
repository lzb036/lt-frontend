import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sources = [
  'App.vue',
  'components/crawler/UserManagement.vue',
  'composables/useAuth.ts',
  'composables/useCollectorApi.ts',
  'utils/api.ts',
].map((file) => readFileSync(resolve(sourceRoot, file), 'utf8')).join('\n')

for (const contract of [
  '登录用户账户',
  '当前超级管理员标签页不会退出',
  "window.open('', '_blank')",
  'new URL(result.path, window.location.origin).href',
  '/auth/impersonation',
  '/auth/impersonation/consume',
  "TAB_SESSION_TOKEN_KEY = 'lt_tab_session_token'",
  'window.sessionStorage.setItem',
  'config.headers.Authorization = `Bearer ${token}`',
  "const prefix = '#impersonation='",
]) {
  if (!sources.includes(contract)) {
    throw new Error(`missing user impersonation contract: ${contract}`)
  }
}

for (const forbidden of [
  'password=',
  '/api/auth/impersonate?token=',
]) {
  if (sources.includes(forbidden)) {
    throw new Error(`unsafe user impersonation contract present: ${forbidden}`)
  }
}
