import { beforeEach, describe, expect, test, vi } from 'vitest'

const handle = vi.fn()
const fromWebContents = vi.fn()
const getWindowWorkspaceState = vi.fn()
const setWindowWorkspaceRoot = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents },
  ipcMain: { handle },
}))

vi.mock('../services/file-service', () => ({ getWindowWorkspaceState, setWindowWorkspaceRoot }))

describe('git worktree IPC', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('binds list/create/switch/remove/prune to the active window workspace', async () => {
    const window = { id: 23 }
    const event = { sender: { id: 'sender' } }
    fromWebContents.mockReturnValue(window)
    getWindowWorkspaceState
      .mockReturnValueOnce({ rootPath: '/workspace', watching: false })
      .mockReturnValueOnce({ rootPath: '/workspace', watching: false })
      .mockReturnValueOnce({ rootPath: '/workspace', watching: false })
      .mockReturnValueOnce({ rootPath: '/workspace/.worktrees/review', watching: false })
      .mockReturnValueOnce({ rootPath: '/workspace/.worktrees/review', watching: false })
    setWindowWorkspaceRoot.mockReturnValue({ rootPath: '/workspace/.worktrees/review', watching: false })
    const service = {
      getStatus: vi.fn(async () => ({ state: 'ready', worktrees: [] })),
      create: vi.fn(async () => ({ action: 'create', status: 'completed' })),
      switch: vi.fn(async (_root: string, _path: string, apply: (target: string) => void) => {
        apply('/workspace/.worktrees/review')
        return { action: 'switch', status: 'completed' }
      }),
      remove: vi.fn(async () => ({ action: 'remove', status: 'completed' })),
      prune: vi.fn(async () => ({ action: 'prune', status: 'completed' })),
    }
    const { registerGitWorktreeHandlers } = await import('../services/git-worktree-service')
    registerGitWorktreeHandlers(service as never)
    const handlers = new Map(handle.mock.calls.map(([channel, handler]) => [channel, handler]))

    await handlers.get('git-worktree:get-status')?.(event)
    await handlers.get('git-worktree:create')?.(event, { branch: 'review' })
    await handlers.get('git-worktree:switch')?.(event, '.worktrees/review')
    await handlers.get('git-worktree:remove')?.(event, '.worktrees/review')
    await handlers.get('git-worktree:prune')?.(event)

    expect(service.getStatus).toHaveBeenCalledWith('/workspace')
    expect(service.create).toHaveBeenCalledWith('/workspace', { branch: 'review' })
    expect(service.switch).toHaveBeenCalledWith('/workspace', '.worktrees/review', expect.any(Function))
    expect(setWindowWorkspaceRoot).toHaveBeenCalledWith(window, '/workspace/.worktrees/review')
    expect(service.remove).toHaveBeenCalledWith('/workspace/.worktrees/review', '.worktrees/review')
    expect(service.prune).toHaveBeenCalledWith('/workspace/.worktrees/review')
  })
})
