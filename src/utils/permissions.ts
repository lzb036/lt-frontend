type PermissionSession = {
  role?: string
  permissionCodes?: readonly string[]
} | null | undefined

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
