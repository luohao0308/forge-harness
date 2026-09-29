import { createHash, randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { apiRequest } from '../shared/api-client'
import { ChangeReviewError, runGitCommand, type GitCommandOptions, type GitCommandResult, type GitCommandRunner } from './change-review-core'

export type DesktopWorktreeState = 'ready' | 'no-workspace' | 'not-repository' | 'git-unavailable' | 'error'

export type DesktopWorktree = {
  path: string
  branch: string | null
  head: string | null
  current: boolean
  main: boolean
  dirty: boolean
  prunable: boolean
}

export type DesktopWorktreeStatus = {
  state: DesktopWorktreeState
  branch: string | null
  worktrees: DesktopWorktree[]
  errorCode: string | null
  message: string | null
}

export type DesktopWorktreeCreateInput = {
  branch: string
  path?: string
}

export type DesktopWorktreeMutationAction = 'create' | 'switch' | 'remove' | 'prune'

export type DesktopWorktreeMutationResult = {
  action: DesktopWorktreeMutationAction
  status: 'completed'
  path: string | null
  auditId: string
  eventId: string | null
  operationId: string
}

export type GitWorktreeAuditPhase = 'requested' | 'completed' | 'failed'

export type GitWorktreeAuditRecord = {
  operationId: string
  phase: GitWorktreeAuditPhase
  action: DesktopWorktreeMutationAction
  path: string
  targetPath?: string | null
  previewSha256: string
  errorCode?: string
}

export type GitWorktreeAuditReceipt = {
  accepted: boolean
  auditId: string
  eventId: string | null
  operationId: string
  phase: GitWorktreeAuditPhase
}

export type GitWorktreeServiceOptions = {
  gitRunner?: GitCommandRunner
  auditRecorder?: (record: GitWorktreeAuditRecord) => Promise<GitWorktreeAuditReceipt>
  tokenFactory?: () => string
}

const DEFAULT_WORKTREE_DIRECTORY = '.worktrees'
const MAX_BRANCH_LENGTH = 120
const MAX_RELATIVE_PATH_LENGTH = 512

export class GitWorktreeService {
  private readonly gitRunner: GitCommandRunner
  private readonly auditRecorder: (record: GitWorktreeAuditRecord) => Promise<GitWorktreeAuditReceipt>
  private readonly tokenFactory: () => string

  constructor(options: GitWorktreeServiceOptions = {}) {
    this.gitRunner = options.gitRunner ?? runGitCommand
    this.auditRecorder = options.auditRecorder ?? recordGitWorktreeAudit
    this.tokenFactory = options.tokenFactory ?? randomUUID
  }

  async getStatus(rawRootPath: string | null): Promise<DesktopWorktreeStatus> {
    if (!rawRootPath) return emptyStatus('no-workspace')
    try {
      const rootPath = validateWorkspaceRoot(rawRootPath)
      const repository = await this.requireRepository(rootPath)
      const worktrees = await this.readWorktrees(repository.repositoryRoot, rootPath)
      return {
        state: 'ready',
        branch: worktrees.find((item) => item.current)?.branch ?? null,
        worktrees,
        errorCode: null,
        message: null,
      }
    } catch (error) {
      return degradedStatus(error)
    }
  }

  async create(rawRootPath: string | null, input: DesktopWorktreeCreateInput): Promise<DesktopWorktreeMutationResult> {
    const rootPath = requireWorkspaceRoot(rawRootPath)
    const repository = await this.requireRepository(rootPath)
    const branch = await validateBranch(this.gitRunner, repository.repositoryRoot, input.branch)
    const worktrees = await this.readWorktrees(repository.repositoryRoot, rootPath)
    if (worktrees.some((item) => item.branch === branch)) {
      throw new ChangeReviewError('WORKTREE_BRANCH_EXISTS', 'branch is already checked out in a worktree')
    }
    const existingBranch = await this.gitRunner(repository.repositoryRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { allowedExitCodes: [0, 1] })
    if (existingBranch.exitCode === 0) {
      throw new ChangeReviewError('WORKTREE_BRANCH_EXISTS', 'branch already exists')
    }
    const source = worktrees.find((item) => item.current)
    if (source?.dirty) throw new ChangeReviewError('WORKTREE_SOURCE_DIRTY', 'current worktree has uncommitted changes')
    const relativePath = validateCreatePath(repository.repositoryRoot, branch, input.path)
    const targetPath = path.join(repository.repositoryRoot, relativePath)
    ensureAbsentPath(targetPath)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    const operationId = this.tokenFactory()
    const preview = operationPreviewHash({ action: 'create', path: '.', targetPath: relativePath, branch })
    await this.auditRequested(operationId, 'create', '.', relativePath, preview)
    try {
      await this.gitRunner(repository.repositoryRoot, ['worktree', 'add', '-b', branch, targetPath])
      const receipt = await this.auditCompleted(operationId, 'create', '.', relativePath, preview)
      return {
        action: 'create',
        status: 'completed',
        path: relativePath,
        auditId: receipt.auditId,
        eventId: receipt.eventId,
        operationId,
      }
    } catch (error) {
      await this.auditFailed(operationId, 'create', '.', relativePath, preview, error)
      throw error
    }
    throw new ChangeReviewError('WORKTREE_CREATE_FAILED', 'worktree creation did not complete')
  }

  async switch(
    rawRootPath: string | null,
    rawPath: string,
    apply: (targetPath: string) => void,
  ): Promise<DesktopWorktreeMutationResult> {
    const rootPath = requireWorkspaceRoot(rawRootPath)
    const repository = await this.requireRepository(rootPath)
    const worktrees = await this.readWorktrees(repository.repositoryRoot, rootPath)
    const relativePath = normalizeWorktreeReference(rawPath)
    const match = worktrees.find((item) => item.path === relativePath)
    if (!match) throw new ChangeReviewError('WORKTREE_NOT_FOUND', 'worktree is not registered in this repository')
    if (match.prunable) throw new ChangeReviewError('WORKTREE_PRUNABLE', 'worktree path is no longer available')
    const targetPath = path.join(repository.repositoryRoot, relativePath === '.' ? '' : relativePath)
    const operationId = this.tokenFactory()
    const preview = operationPreviewHash({ action: 'switch', path: relativePath })
    await this.auditRequested(operationId, 'switch', relativePath, null, preview)
    try {
      apply(targetPath)
      const receipt = await this.auditCompleted(operationId, 'switch', relativePath, null, preview)
      return {
        action: 'switch',
        status: 'completed',
        path: relativePath,
        auditId: receipt.auditId,
        eventId: receipt.eventId,
        operationId,
      }
    } catch (error) {
      await this.auditFailed(operationId, 'switch', relativePath, null, preview, error)
      throw error
    }
  }

  async remove(rawRootPath: string | null, rawPath: string): Promise<DesktopWorktreeMutationResult> {
    const rootPath = requireWorkspaceRoot(rawRootPath)
    const repository = await this.requireRepository(rootPath)
    const worktrees = await this.readWorktrees(repository.repositoryRoot, rootPath)
    const relativePath = normalizeWorktreeReference(rawPath)
    const match = worktrees.find((item) => item.path === relativePath)
    if (!match) throw new ChangeReviewError('WORKTREE_NOT_FOUND', 'worktree is not registered in this repository')
    if (match.current) throw new ChangeReviewError('WORKTREE_CURRENT', 'the current worktree cannot be removed')
    if (match.main) throw new ChangeReviewError('WORKTREE_MAIN', 'the main worktree cannot be removed')
    if (match.prunable) throw new ChangeReviewError('WORKTREE_PRUNABLE', 'prunable worktree metadata must be cleaned separately')
    if (match.dirty) throw new ChangeReviewError('WORKTREE_DIRTY', 'worktree has uncommitted changes')
    const operationId = this.tokenFactory()
    const preview = operationPreviewHash({ action: 'remove', path: relativePath })
    await this.auditRequested(operationId, 'remove', relativePath, null, preview)
    try {
      await this.gitRunner(repository.repositoryRoot, ['worktree', 'remove', '--', path.join(repository.repositoryRoot, relativePath)])
      const receipt = await this.auditCompleted(operationId, 'remove', relativePath, null, preview)
      return {
        action: 'remove',
        status: 'completed',
        path: relativePath,
        auditId: receipt.auditId,
        eventId: receipt.eventId,
        operationId,
      }
    } catch (error) {
      await this.auditFailed(operationId, 'remove', relativePath, null, preview, error)
      throw error
    }
    throw new ChangeReviewError('WORKTREE_REMOVE_FAILED', 'worktree removal did not complete')
  }

  async prune(rawRootPath: string | null): Promise<DesktopWorktreeMutationResult> {
    const rootPath = requireWorkspaceRoot(rawRootPath)
    const repository = await this.requireRepository(rootPath)
    const operationId = this.tokenFactory()
    const preview = operationPreviewHash({ action: 'prune', path: '.' })
    await this.auditRequested(operationId, 'prune', '.', null, preview)
    try {
      await this.gitRunner(repository.repositoryRoot, ['worktree', 'prune', '--verbose'])
      const receipt = await this.auditCompleted(operationId, 'prune', '.', null, preview)
      return {
        action: 'prune',
        status: 'completed',
        path: null,
        auditId: receipt.auditId,
        eventId: receipt.eventId,
        operationId,
      }
    } catch (error) {
      await this.auditFailed(operationId, 'prune', '.', null, preview, error)
      throw error
    }
    throw new ChangeReviewError('WORKTREE_PRUNE_FAILED', 'worktree cleanup did not complete')
  }

  private async resolveRepository(rootPath: string): Promise<{ repositoryRoot: string }> {
    const result = await this.gitRunner(rootPath, ['rev-parse', '--show-toplevel'])
    const repositoryRoot = validateWorkspaceRoot(result.stdout.trim())
    return { repositoryRoot }
  }

  private async requireRepository(rootPath: string): Promise<{ repositoryRoot: string }> {
    try {
      return await this.resolveRepository(rootPath)
    } catch (error) {
      if (error instanceof ChangeReviewError && error.code === 'GIT_UNAVAILABLE') throw error
      if (error instanceof ChangeReviewError && /not a git repository/i.test(error.message)) {
        throw new ChangeReviewError('NOT_REPOSITORY', 'workspace is not a Git repository')
      }
      throw error
    }
  }

  private async readWorktrees(repositoryRoot: string, currentRoot: string): Promise<DesktopWorktree[]> {
    const result = await this.gitRunner(repositoryRoot, ['worktree', 'list', '--porcelain'])
    const records = parseWorktreeRecords(result.stdout)
    return await Promise.all(records.map(async (record, index) => {
      const worktreePath = normalizeExistingOrLexicalPath(record.path)
      const relative = path.relative(repositoryRoot, worktreePath)
      if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
        throw new ChangeReviewError('WORKTREE_PATH_NOT_ALLOWED', 'Git reported a worktree outside the repository')
      }
      const relativePath = normalizeListedPath(relative)
      const current = worktreePath === currentRoot
      const prunable = !fs.existsSync(worktreePath)
      let dirty = false
      if (!prunable) {
        const status = await this.gitRunner(worktreePath, ['status', '--porcelain=v1', '--untracked-files=all'], { allowedExitCodes: [0, 128] })
        dirty = status.exitCode === 0 && status.stdout.trim().length > 0
      }
      return {
        path: relativePath,
        branch: record.branch,
        head: record.head,
        current,
        main: index === 0,
        dirty,
        prunable,
      }
    }))
  }

  private async auditRequested(operationId: string, action: DesktopWorktreeMutationAction, pathValue: string, targetPath: string | null, preview: string): Promise<void> {
    await this.auditRecorder({ operationId, phase: 'requested', action, path: pathValue, targetPath, previewSha256: preview })
  }

  private async auditCompleted(operationId: string, action: DesktopWorktreeMutationAction, pathValue: string, targetPath: string | null, preview: string): Promise<GitWorktreeAuditReceipt> {
    return this.auditRecorder({ operationId, phase: 'completed', action, path: pathValue, targetPath, previewSha256: preview })
  }

  private async auditFailed(operationId: string, action: DesktopWorktreeMutationAction, pathValue: string, targetPath: string | null, preview: string, error: unknown): Promise<void> {
    try {
      await this.auditRecorder({ operationId, phase: 'failed', action, path: pathValue, targetPath, previewSha256: preview, errorCode: errorCode(error) })
    } catch {
      // Preserve the original Git failure while keeping the failure audit best-effort.
    }
  }

}

type WorktreeRecord = { path: string; head: string | null; branch: string | null }

function parseWorktreeRecords(output: string): WorktreeRecord[] {
  const records: WorktreeRecord[] = []
  let current: WorktreeRecord | null = null
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (current) records.push(current)
      current = { path: line.slice('worktree '.length).trim(), head: null, branch: null }
    } else if (!current) {
      continue
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length).trim() || null
    } else if (line.startsWith('branch ')) {
      const branch = line.slice('branch '.length).trim()
      current.branch = branch.startsWith('refs/heads/') ? branch.slice('refs/heads/'.length) : branch || null
    }
  }
  if (current) records.push(current)
  return records
}

async function validateBranch(gitRunner: GitCommandRunner, repositoryRoot: string, rawBranch: string): Promise<string> {
  const branch = rawBranch.trim()
  if (!branch || branch.length > MAX_BRANCH_LENGTH || /[\u0000-\u001f\u007f]/.test(branch)) {
    throw new ChangeReviewError('WORKTREE_BRANCH_INVALID', 'branch name is invalid')
  }
  const result = await gitRunner(repositoryRoot, ['check-ref-format', '--branch', branch], { allowedExitCodes: [0, 1] })
  if (result.exitCode !== 0) throw new ChangeReviewError('WORKTREE_BRANCH_INVALID', 'branch name is invalid')
  return branch
}

function validateCreatePath(repositoryRoot: string, branch: string, rawPath?: string): string {
  const fallback = `${DEFAULT_WORKTREE_DIRECTORY}/${branch.replaceAll('/', '-')}`
  const value = (rawPath?.trim() || fallback).replaceAll('\\', '/')
  if (!value || value.length > MAX_RELATIVE_PATH_LENGTH || value.startsWith('/') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new ChangeReviewError('WORKTREE_PATH_NOT_ALLOWED', 'worktree path must stay within the repository')
  }
  if (value.split('/').some((part) => part === '.git')) throw new ChangeReviewError('WORKTREE_PATH_NOT_ALLOWED', 'worktree path is not allowed')
  const candidate = path.resolve(repositoryRoot, value)
  const relative = path.relative(repositoryRoot, candidate)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new ChangeReviewError('WORKTREE_PATH_NOT_ALLOWED', 'worktree path must stay within the repository')
  assertNoSymlinkPath(repositoryRoot, relative)
  return relative.replaceAll(path.sep, '/')
}

function normalizeWorktreeReference(rawPath: string): string {
  const value = rawPath.trim().replaceAll('\\', '/')
  if (!value || value === '.') return '.'
  if (value.startsWith('/') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new ChangeReviewError('WORKTREE_PATH_NOT_ALLOWED', 'worktree path is not allowed')
  }
  return value.replace(/^\.\//, '').replace(/\/$/, '') || '.'
}

function normalizeListedPath(rawPath: string): string {
  const value = rawPath.replaceAll('\\', '/')
  if (!value || value === '.') return '.'
  return value.replace(/^\.\//, '').replace(/\/$/, '') || '.'
}

function assertNoSymlinkPath(rootPath: string, relativePath: string): void {
  let current = rootPath
  for (const segment of relativePath.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new ChangeReviewError('WORKTREE_PATH_NOT_ALLOWED', 'worktree path crosses a symbolic link')
    }
  }
}

function ensureAbsentPath(targetPath: string): void {
  if (fs.existsSync(targetPath)) throw new ChangeReviewError('WORKTREE_PATH_EXISTS', 'worktree path already exists')
}

function validateWorkspaceRoot(rawRootPath: string): string {
  const resolved = path.resolve(rawRootPath)
  try {
    if (!fs.lstatSync(resolved).isDirectory() || fs.lstatSync(resolved).isSymbolicLink()) throw new Error('invalid')
    return fs.realpathSync(resolved)
  } catch {
    throw new ChangeReviewError('WORKSPACE_ROOT_INVALID', 'workspace root is unavailable')
  }
}

function requireWorkspaceRoot(rawRootPath: string | null): string {
  if (!rawRootPath) throw new ChangeReviewError('WORKSPACE_NOT_CONFIGURED', 'workspace root is not configured')
  return validateWorkspaceRoot(rawRootPath)
}

function normalizeExistingOrLexicalPath(rawPath: string): string {
  const resolved = path.resolve(rawPath)
  try {
    return fs.realpathSync(resolved)
  } catch {
    return resolved
  }
}

function emptyStatus(state: DesktopWorktreeState): DesktopWorktreeStatus {
  return { state, branch: null, worktrees: [], errorCode: null, message: null }
}

function degradedStatus(error: unknown): DesktopWorktreeStatus {
  const normalized = error instanceof ChangeReviewError ? error : new ChangeReviewError('GIT_STATUS_FAILED', 'Git worktree status could not be read')
  const state: DesktopWorktreeState = normalized.code === 'GIT_UNAVAILABLE' ? 'git-unavailable' : normalized.code === 'NOT_REPOSITORY' ? 'not-repository' : 'error'
  return { ...emptyStatus(state), errorCode: normalized.code, message: normalized.message }
}

function operationPreviewHash(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function errorCode(error: unknown): string {
  return error instanceof ChangeReviewError ? error.code : 'GIT_COMMAND_FAILED'
}

async function recordGitWorktreeAudit(record: GitWorktreeAuditRecord): Promise<GitWorktreeAuditReceipt> {
  const response = await apiRequest<{
    accepted: boolean
    audit_id: string
    event_id: string | null
    operation_id: string
    phase: GitWorktreeAuditPhase
  }>('/api/desktop/git-worktree/audit', {
    method: 'POST',
    body: JSON.stringify({
      operation_id: record.operationId,
      phase: record.phase,
      action: record.action,
      path: record.path,
      target_path: record.targetPath,
      preview_sha256: record.previewSha256,
      error_code: record.phase === 'failed' ? record.errorCode : undefined,
    }),
  })
  return { accepted: response.accepted, auditId: response.audit_id, eventId: response.event_id, operationId: response.operation_id, phase: response.phase }
}
