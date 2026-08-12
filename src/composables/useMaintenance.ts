import { computed, readonly, shallowRef } from 'vue'

import type {
  MaintenanceSettings,
  MaintenanceSettingsPayload,
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

  async function fetchTaskControlStatus() {
    const response = await apiClient.get<{ taskControl: TaskControlStatus }>('/maintenance/task-control')
    taskControl.value = response.data.taskControl
    return taskControl.value
  }

  async function stopAllTasks() {
    const response = await apiClient.post<{ taskControl: TaskControlStatus }>('/maintenance/task-control/stop-all')
    taskControl.value = response.data.taskControl
    return taskControl.value
  }

  async function resumeAllTasks() {
    const response = await apiClient.post<{ taskControl: TaskControlStatus }>('/maintenance/task-control/resume-all')
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
    fetchTaskControlStatus,
    stopAllTasks,
    resumeAllTasks,
  }
}
