import {
  canAccessRouteMeta,
  getDefaultRoutePath,
} from './permissions.ts'

const aiSession = {
  role: 'operator',
  permissionCodes: ['ai.manage'],
}

if (getDefaultRoutePath(aiSession) !== '/ai/product-analysis') {
  throw new Error('expected AI-only users to enter the product analysis workspace')
}

if (!canAccessRouteMeta(aiSession, { permission: 'ai.manage' })) {
  throw new Error('expected ai.manage to allow the product analysis route')
}

if (canAccessRouteMeta({ role: 'operator', permissionCodes: [] }, { permission: 'ai.manage' })) {
  throw new Error('expected users without ai.manage to be denied')
}
