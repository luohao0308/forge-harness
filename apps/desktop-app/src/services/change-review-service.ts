import { BrowserWindow, ipcMain } from 'electron'

import { getWindowWorkspaceState } from './file-service'
import {
  ChangeReviewService,
  type DesktopChangeMutationInput,
} from './change-review-core'
import { assertTrustedRendererSender } from './ipc-security'

type ChangeReviewServiceContract = Pick<ChangeReviewService, 'getStatus' | 'getDiff' | 'mutate'>

let handlersRegistered = false

export function registerChangeReviewHandlers(
  service: ChangeReviewServiceContract = new ChangeReviewService(),
): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('change-review:get-status', async (event) => {
    assertTrustedRendererSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    return service.getStatus(getWindowWorkspaceState(window).rootPath)
  })

  ipcMain.handle('change-review:get-diff', async (event, filePath: string) => {
    assertTrustedRendererSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    return service.getDiff(getWindowWorkspaceState(window).rootPath, filePath, window)
  })

  ipcMain.handle('change-review:mutate', async (event, input: DesktopChangeMutationInput) => {
    assertTrustedRendererSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    return service.mutate(getWindowWorkspaceState(window).rootPath, window, input)
  })
}
