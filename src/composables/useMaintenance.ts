import { computed, readonly, shallowRef } from 'vue'

import type {
  MaintenanceSettings,
  MaintenanceSettingsPayload,
  SystemAnnouncement,
  SystemAnnouncementPayload,
  TaskControlStatus,
} from '../types/crawler'
import { apiClient, MAINTENANCE_STATUS_EVENT } from '../utils/api'

const maintenance = shallowRef<MaintenanceSettings | null>(null)
const checkingMaintenance = shallowRef(false)
const taskControl = shallowRef<TaskControlStatus | null>(null)
let eventListenerInstalled = false

if (typeof window !== 'undefined' && !eventListenerInstalled) {
  window.addEventListener(MAINTENANCE_STATUS_EVENT, (event) => {
    const nextMaintenance = (event as CustomEvent<MaintenanceSettings>).detail
    if (nextMaintenance?.active) {
      maintenance.value = nextMaintenance
    }
  })
  eventListenerInstalled = true
}

export function useMaintenance() {
  const maintenanceActive = computed(() => Boolean(maintenance.value?.active))

  async function fetchMaintenanceStatus() {
    checkingMaintenance.value = true
    try {
      const response = await apiClient.get<{ maintenance: MaintenanceSettings }>('/maintenance/status')
      maintenance.value = response.data.maintenance
      return maintenance.value
    } finally {
      checkingMaintenance.value = false
    }
  }

  async function fetchMaintenanceSettings() {
    const response = await apiClient.get<{ maintenance: MaintenanceSettings }>('/maintenance/settings')
    maintenance.value = response.data.maintenance
    return maintenance.value
  }

  async function updateMaintenanceSettings(payload: MaintenanceSettingsPayload) {
    const response = await apiClient.put<{ maintenance: MaintenanceSettings }>('/maintenance/settings', payload)
    maintenance.value = response.data.maintenance
    return maintenance.value
  }

  async function listAnnouncements() {
    const response = await apiClient.get<{
      announcements: SystemAnnouncement[]
    }>('/maintenance/announcements')
    return response.data.announcements
  }

  async function hasUnreadAnnouncements() {
    const response = await apiClient.get<{ hasUnread: boolean }>(
      '/maintenance/announcements/unread',
    )
    return response.data.hasUnread
  }

  async function markAnnouncementsRead(announcementIds: number[]) {
    const response = await apiClient.post<{ readAnnouncementIds: number[] }>(
      '/maintenance/announcements/read',
      { announcementIds },
    )
    return response.data.readAnnouncementIds
  }

  async function listManagedAnnouncements() {
    const response = await apiClient.get<{
      announcements: SystemAnnouncement[]
    }>('/maintenance/announcements/manage')
    return response.data.announcements
  }

  async function saveAnnouncement(
    payload: SystemAnnouncementPayload,
    announcementId?: number,
  ) {
    const response = announcementId
      ? await apiClient.put<{ announcement: SystemAnnouncement }>(
          `/maintenance/announcements/${announcementId}`,
          payload,
        )
      : await apiClient.post<{ announcement: SystemAnnouncement }>(
          '/maintenance/announcements',
          payload,
        )
    return response.data.announcement
  }

  async function deleteAnnouncement(announcementId: number) {
    await apiClient.delete(`/maintenance/announcements/${announcementId}`)
  }

  async function uploadAnnouncementImage(file: File) {
    const data = new FormData()
    data.append('file', file)
    const response = await apiClient.post<{ imageUrl: string }>(
      '/maintenance/announcement-images',
      data,
      { timeout: 2 * 60_000 },
    )
    return response.data.imageUrl
  }

  async function deleteAnnouncementImage(imageUrl: string) {
    await apiClient.delete('/maintenance/announcement-images', {
      data: { imageUrl },
    })
  }

  async function fetchTaskControlStatus() {
    const response = await apiClient.get<{ taskControl: TaskControlStatus }>('/maintenance/task-control')
    taskControl.value = response.data.taskControl
    return taskControl.value
  }

  async function stopAllTasks(usernames: string[]) {
    const response = await apiClient.post<{ taskControl: TaskControlStatus }>(
      '/maintenance/task-control/stop-all',
      { usernames },
      { timeout: 150_000 },
    )
    taskControl.value = response.data.taskControl
    return taskControl.value
  }

  async function resumeAllTasks() {
    const response = await apiClient.post<{ taskControl: TaskControlStatus }>(
      '/maintenance/task-control/resume-all',
      undefined,
      { timeout: 150_000 },
    )
    taskControl.value = response.data.taskControl
    return taskControl.value
  }

  return {
    maintenance: readonly(maintenance),
    checkingMaintenance: readonly(checkingMaintenance),
    maintenanceActive,
    taskControl: readonly(taskControl),
    fetchMaintenanceStatus,
    fetchMaintenanceSettings,
    updateMaintenanceSettings,
    listAnnouncements,
    hasUnreadAnnouncements,
    markAnnouncementsRead,
    listManagedAnnouncements,
    saveAnnouncement,
    deleteAnnouncement,
    uploadAnnouncementImage,
    deleteAnnouncementImage,
    fetchTaskControlStatus,
    stopAllTasks,
    resumeAllTasks,
  }
}
