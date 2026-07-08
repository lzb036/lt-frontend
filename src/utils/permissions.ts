type PermissionSession = {
  role?: string
  permissionCodes?: readonly string[]
} | null | undefined

type DefaultRouteCandidate = {
  path: string
  permission?: string
  anyPermission?: string[]
  superadminOnly?: boolean
}

const DEFAULT_ROUTE_CANDIDATES: DefaultRouteCandidate[] = [
  { path: '/ltJobs/wjJobs', permission: 'crawler.manage' },
  { path: '/ltJobs/wjProductJob', permission: 'crawler.manage' },
  { path: '/ltJobs/upGoodsJob', permission: 'products.manage' },
  { path: '/ltJobs/syncJob', anyPermission: ['products.manage', 'stores.manage'] },
  { path: '/ltShop/wjMerchantGoods', permission: 'products.manage' },
  { path: '/ltShop/wjMerchantGoodsTrue', permission: 'products.manage' },
  { path: '/ltShop/wjListedGoods', permission: 'products.manage' },
  { path: '/ltShop/wjMerchantGoodsError', permission: 'products.manage' },
  { path: '/ltHj/wjMerchant', permission: 'stores.manage' },
  { path: '/ltHj/collectionShops', permission: 'crawler.manage' },
  { path: '/ltShop/GoodsUp', permission: 'stores.manage' },
  { path: '/system/user', superadminOnly: true },
  { path: '/system/theme', permission: 'settings.manage' },
  { path: '/system/time', permission: 'settings.manage' },
]

export function isSuperadmin(session: PermissionSession) {
  return session?.role === 'superadmin'
}

export function hasPermission(session: PermissionSession, permission: string) {
  return isSuperadmin(session) || Boolean(session?.permissionCodes?.includes(permission))
}

export function hasAnyPermission(session: PermissionSession, permissions: string[]) {
  return isSuperadmin(session) || permissions.some((permission) => hasPermission(session, permission))
}

export function canAccessRouteMeta(session: PermissionSession, meta: Record<string, unknown>) {
  if (!session) {
    return false
  }
  if (meta.superadminOnly) {
    return isSuperadmin(session)
  }
  if (typeof meta.permission === 'string') {
    return hasPermission(session, meta.permission)
  }
  if (Array.isArray(meta.anyPermission)) {
    return hasAnyPermission(session, meta.anyPermission.filter((value): value is string => typeof value === 'string'))
  }
  return true
}

export function getDefaultRoutePath(session: PermissionSession) {
  const candidate = DEFAULT_ROUTE_CANDIDATES.find((item) => {
    if (item.superadminOnly) {
      return isSuperadmin(session)
    }
    if (item.permission) {
      return hasPermission(session, item.permission)
    }
    if (item.anyPermission) {
      return hasAnyPermission(session, item.anyPermission)
    }
    return true
  })
  return candidate?.path ?? '/ltHj/wjMerchant'
}
