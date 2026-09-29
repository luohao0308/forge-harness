import { ipcMain } from 'electron'
import type { Task, TaskStatus } from '../preload-api'
import { apiRequest, buildQueryString } from '../shared/api-client'
import { assertTrustedRendererSender } from './ipc-security'

export function registerTaskHandlers(): void {
  ipcMain.handle('task:get', async (event, taskId: string): Promise<Task> => {
    assertTrustedRendererSender(event)
    return apiRequest<Task>(`/api/tasks/${taskId}`)
  })

  ipcMain.handle('task:cancel', async (event, taskId: string): Promise<void> => {
    assertTrustedRendererSender(event)
    await apiRequest(`/api/tasks/${taskId}/cancel`, {
      method: 'POST',
    })
  })

  ipcMain.handle(
    'task:list',
    async (
      event,
      filters: { status?: TaskStatus } = {}
    ): Promise<{ items: Task[] }> => {
      assertTrustedRendererSender(event)
      const suffix = buildQueryString({
        status: filters.status,
      })

      return apiRequest<{ items: Task[] }>(`/api/tasks${suffix}`)
    }
  )
}
