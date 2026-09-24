import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import { fileURLToPath } from 'node:url'

const ENGINE_VERSION = 'b4938'
const SOURCE_URL = `https://github.com/ggml-org/whisper.cpp/archive/refs/tags/${ENGINE_VERSION}.tar.gz`
const SOURCE_SHA256 = '6d8d70a014ca2b10f8a6d006b8f423e5f5ef2afcfbe92b57ab4e01107238112a'
const MAX_SOURCE_BYTES = 32 * 1024 * 1024
const scriptRoot = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptRoot, '..')

const target = voiceTarget(process.platform, process.arch)
const targetDirectory = path.join(appRoot, 'resources', 'voice', target.os, target.arch)
const executableName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
const executablePath = path.join(targetDirectory, executableName)
const manifestPath = path.join(targetDirectory, 'engine-manifest.json')

if (await existingEngineIsValid()) {
  process.stdout.write(`Voice engine ${ENGINE_VERSION} already prepared for ${target.os}/${target.arch}\n`)
  process.exit(0)
}

const buildRoot = await mkdtemp(path.join(tmpdir(), 'forge-harness-whisper-'))
try {
  const overridePath = process.env.HARNESS_WHISPER_CLI_PATH?.trim()
  let builtExecutable
  let whisperLicense
  if (overridePath) {
    builtExecutable = path.resolve(overridePath)
    whisperLicense = path.join(appRoot, 'resources', 'voice', 'whisper.cpp-MIT.txt')
  } else {
    const archivePath = path.join(buildRoot, `${ENGINE_VERSION}.tar.gz`)
    await downloadVerifiedSource(archivePath)
    run('tar', ['-xzf', archivePath, '-C', buildRoot])
    const sourceRoot = path.join(buildRoot, `whisper.cpp-${ENGINE_VERSION}`)
    const cmakeBuildRoot = path.join(buildRoot, 'build')
    run('cmake', [
      '-S', sourceRoot,
      '-B', cmakeBuildRoot,
      '-DCMAKE_BUILD_TYPE=Release',
      '-DBUILD_SHARED_LIBS=OFF',
      '-DWHISPER_BUILD_TESTS=OFF',
      '-DWHISPER_BUILD_SERVER=OFF',
      '-DWHISPER_BUILD_EXAMPLES=ON',
      '-DGGML_NATIVE=OFF',
      '-DGGML_OPENMP=OFF',
    ])
    run('cmake', ['--build', cmakeBuildRoot, '--config', 'Release', '--target', 'whisper-cli', '--parallel'])
    builtExecutable = await firstReadable([
      path.join(cmakeBuildRoot, 'bin', executableName),
      path.join(cmakeBuildRoot, 'bin', 'Release', executableName),
    ])
    whisperLicense = path.join(sourceRoot, 'LICENSE')
  }

  await mkdir(targetDirectory, { recursive: true, mode: 0o755 })
  await copyFile(builtExecutable, executablePath)
  if (process.platform !== 'win32') await chmod(executablePath, 0o755)
  await copyFile(whisperLicense, path.join(targetDirectory, 'whisper.cpp-MIT.txt'))
  await copyFile(
    path.join(appRoot, 'resources', 'voice', 'openai-whisper-MIT.txt'),
    path.join(targetDirectory, 'openai-whisper-MIT.txt'),
  )
  const sha256 = await sha256File(executablePath)
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    executable: executableName,
    sha256,
    sourceArchiveSha256: SOURCE_SHA256,
    ...(process.platform === 'darwin' ? { minimumMacOSVersion: '13.3' } : {}),
  }, null, 2)}\n`)
  process.stdout.write(`Prepared voice engine ${ENGINE_VERSION} for ${target.os}/${target.arch}: ${sha256}\n`)
} finally {
  await rm(buildRoot, { recursive: true, force: true })
}

export function voiceTarget(platform, arch) {
  if (arch !== 'x64') throw new Error(`unsupported voice engine architecture: ${arch}`)
  if (platform === 'darwin') return { os: 'mac', arch }
  if (platform === 'win32') return { os: 'win', arch }
  if (platform === 'linux') return { os: 'linux', arch }
  throw new Error(`unsupported voice engine platform: ${platform}`)
}

async function existingEngineIsValid() {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    return manifest.schemaVersion === 1
      && manifest.engineVersion === ENGINE_VERSION
      && manifest.executable === executableName
      && manifest.sha256 === await sha256File(executablePath)
  } catch {
    return false
  }
}

async function downloadVerifiedSource(destination) {
  const response = await fetch(SOURCE_URL, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`whisper.cpp source download failed: HTTP ${response.status}`)
  const hash = createHash('sha256')
  let bytes = 0
  const verifier = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length
      if (bytes > MAX_SOURCE_BYTES) return callback(new Error('whisper.cpp source archive exceeded size limit'))
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body), verifier, createWriteStream(destination, { flags: 'wx', mode: 0o600 }))
  if (hash.digest('hex') !== SOURCE_SHA256) throw new Error('whisper.cpp source SHA-256 verification failed')
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`)
}

async function firstReadable(candidates) {
  for (const candidate of candidates) {
    try {
      await readFile(candidate)
      return candidate
    } catch {
      // Try the next generator-specific output path.
    }
  }
  throw new Error('whisper-cli was not produced by the pinned source build')
}

async function sha256File(filePath) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}
