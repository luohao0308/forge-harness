import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import {
  GitWorktreeService,
  type GitWorktreeAuditRecord,
  type GitWorktreeAuditReceipt,
} from '../services/git-worktree-core'
import { runGitCommand } from '../services/change-review-core'

const temporaryRoots: string[] = []

async function createRepository(): Promise<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-git-worktree-'))
  temporaryRoots.push(root)
  await runGitCommand(root, ['init', '-q'])
  await runGitCommand(root, ['config', 'user.email', 'test@example.com'])
  await runGitCommand(root, ['config', 'user.name', 'Test'])
  fs.writeFileSync(path.join(root, 'README.md'), '# test\n')
  await runGitCommand(root, ['add', 'README.md'])
  await runGitCommand(root, ['commit', '-qm', 'initial'])
  return root
}

function auditRecorder(records: GitWorktreeAuditRecord[]) {
  return async (record: GitWorktreeAuditRecord): Promise<GitWorktreeAuditReceipt> => {
    records.push(record)
    return {
      accepted: true,
      auditId: `${record.operationId}:${record.phase}`,
      eventId: null,
      operationId: record.operationId,
      phase: record.phase,
    }
  }
}

describe('GitWorktreeService', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
  })

  test('lists, creates, switches, and removes a clean worktree with audit phases', async () => {
    const root = await createRepository()
    const audits: GitWorktreeAuditRecord[] = []
    let operation = 0
    const service = new GitWorktreeService({ auditRecorder: auditRecorder(audits), tokenFactory: () => `operation-${++operation}` })

    await expect(service.getStatus(root)).resolves.toMatchObject({ state: 'ready', worktrees: [expect.objectContaining({ path: '.', current: true })] })
    const created = await service.create(root, { branch: 'review', path: '.worktrees/review' })
    expect(created).toMatchObject({ action: 'create', path: '.worktrees/review', status: 'completed' })
    await expect(service.getStatus(root)).resolves.toMatchObject({
      worktrees: expect.arrayContaining([expect.objectContaining({ path: '.worktrees/review', branch: 'review' })]),
    })
    const switched = await service.switch(root, '.worktrees/review', (targetPath) => {
      expect(targetPath).toBe(path.join(fs.realpathSync(root), '.worktrees/review'))
    })
    expect(switched).toMatchObject({ action: 'switch', path: '.worktrees/review' })
    const removed = await service.remove(root, '.worktrees/review')
    expect(removed.action).toBe('remove')
    expect(audits.map((record) => `${record.action}:${record.phase}`)).toEqual([
      'create:requested',
      'create:completed',
      'switch:requested',
      'switch:completed',
      'remove:requested',
      'remove:completed',
    ])
  })

  test('fails closed for dirty sources, duplicate branches, traversal, and current removal', async () => {
    const root = await createRepository()
    const audits: GitWorktreeAuditRecord[] = []
    const service = new GitWorktreeService({ auditRecorder: auditRecorder(audits) })
    fs.writeFileSync(path.join(root, 'dirty.txt'), 'uncommitted\n')
    await expect(service.create(root, { branch: 'dirty' })).rejects.toMatchObject({ code: 'WORKTREE_SOURCE_DIRTY' })
    fs.rmSync(path.join(root, 'dirty.txt'))
    await expect(service.create(root, { branch: 'review', path: '../outside' })).rejects.toMatchObject({ code: 'WORKTREE_PATH_NOT_ALLOWED' })
    await service.create(root, { branch: 'review' })
    await expect(service.create(root, { branch: 'review' })).rejects.toMatchObject({ code: 'WORKTREE_BRANCH_EXISTS' })
    await expect(service.remove(root, '.')).rejects.toMatchObject({ code: 'WORKTREE_CURRENT' })
  })

  test('reports a non-repository without attempting a mutation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-git-worktree-non-repo-'))
    temporaryRoots.push(root)
    const service = new GitWorktreeService({ auditRecorder: auditRecorder([]) })
    await expect(service.getStatus(root)).resolves.toMatchObject({ state: 'not-repository', errorCode: 'NOT_REPOSITORY' })
  })
})
