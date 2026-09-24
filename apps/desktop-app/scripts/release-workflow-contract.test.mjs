import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workflowPath = path.resolve(appRoot, '..', '..', '.github', 'workflows', 'release.yml')
const packagePath = path.join(appRoot, 'package.json')

test('desktop packaging force-rebuilds native modules for the Electron ABI', async () => {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  const scripts = packageJson.scripts

  assert.equal(scripts['rebuild:native:electron'], 'electron-rebuild -f -w better-sqlite3')
  for (const scriptName of ['build', 'dist:mac', 'dist:win', 'dist:linux', 'package']) {
    assert.match(scripts[scriptName], /npm run rebuild:native:electron/)
  }
})

test('release waits for independently validated desktop startup evidence', async () => {
  const workflow = await readFile(workflowPath, 'utf8')
  const evidenceJob = jobBlock(workflow, 'desktop-startup-evidence', 'github-release')
  const releaseJob = jobBlock(workflow, 'github-release', 'update-deployment-yaml')

  assert.match(evidenceJob, /needs: desktop-build/)
  assert.match(evidenceJob, /pattern: harness-desktop-\*/)
  assert.match(evidenceJob, /merge-multiple: false/)
  assert.match(evidenceJob, /validate-startup-budget-artifacts\.mjs/)
  assert.match(evidenceJob, /name: desktop-startup-evidence/)
  assert.match(evidenceJob, /if-no-files-found: error/)
  assert.match(releaseJob, /- desktop-startup-evidence/)
  assert.match(releaseJob, /name: desktop-startup-evidence/)
})

function jobBlock(workflow, jobName, nextJobName) {
  const startMarker = `  ${jobName}:\n`
  const endMarker = `  ${nextJobName}:\n`
  const start = workflow.indexOf(startMarker)
  const end = workflow.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(start, -1, `missing ${jobName} job`)
  assert.notEqual(end, -1, `missing ${nextJobName} job after ${jobName}`)
  return workflow.slice(start, end)
}
