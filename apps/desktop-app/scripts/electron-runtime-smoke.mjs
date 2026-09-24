import { spawn } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')
const electron = createRequire(import.meta.url)('electron')

const entry = path.join(here, 'electron-runtime-smoke-entry.cjs')
const child = spawn(electron, [entry], {
  cwd: appRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
})

let output = ''
child.stdout.on('data', (chunk) => { output += chunk.toString() })
child.stderr.on('data', (chunk) => { output += chunk.toString() })

const code = await new Promise((resolve) => child.once('close', resolve))
if (code !== 0) {
  process.stderr.write(output)
  process.exit(code ?? 1)
}
process.stdout.write(output)
