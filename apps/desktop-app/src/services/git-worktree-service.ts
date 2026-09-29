import { BrowserWindow, ipcMain } from 'electron'

import { getWindowWorkspaceState, setWindowWorkspaceRoot } from './file-service'
import {
  GitWorktreeService,
  type DesktopWorktreeCreateInput,
} from './git-worktree-core'
import { assertTrustedRendererSender } from './ipc-security'

let handlersRegistered = false

export function registerGitWorktreeHandlers(service: Pick<GitWorktreeService, 'getStatus' | 'create' | 'switch' | 'remove' | 'prune'> = new GitWorktreeService()): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('git-worktree:get-status', async (event) => {
    assertTrustedRendererSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    return service.getStatus(getWindowWorkspaceState(window).rootPath)
  })

  ipcMain.handle('git-worktree:create', async (event, input: DesktopWorktreeCreateInput) => {
    assertTrustedRendererSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    return service.create(getWindowWorkspaceState(window).rootPath, input)
  })

  ipcMain.handle('git-worktree:switch', async (event, relativePath: string) => {
    assertTrustedRendererSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    const currentRoot = getWindowWorkspaceState(window).rootPath
    try {
      return await service.switch(currentRoot, relativePath, (targetPath) => {
        const state = setWindowWorkspaceRoot(window, targetPath)
        if (state.rootPath !== targetPath) throw new Error('WORKTREE_SWITCH_FAILED')
      })
    } catch (error) {
      if (currentRoot) setWindowWorkspaceRoot(window, currentRoot)
      throw error
    }
  })

  ipcMain.handle('git-worktree:remove', async (event, relativePath: string) => {
    assertTrustedRendererSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    return service.remove(getWindowWorkspaceState(window).rootPath, relativePath)
  })

  ipcMain.handle('git-worktree:prune', async (event) => {
    assertTrustedRendererSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    return service.prune(getWindowWorkspaceState(window).rootPath)
  })
}
