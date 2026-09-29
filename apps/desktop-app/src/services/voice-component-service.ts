import { app, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'

import type {
  DesktopVoiceLanguage,
  DesktopVoiceStatus,
  DesktopVoiceTranscriptionInput,
  DesktopVoiceTranscriptionResult,
} from '../preload-api'
import { getAppConfig } from '../config/app'

const MANIFEST_NAME = 'manifest.json'
const MANIFEST_SCHEMA_VERSION = 1
const MAX_MODEL_BYTES = 512 * 1024 * 1024
const MAX_AUDIO_BYTES = 20 * 1024 * 1024
const MAX_AUDIO_DURATION_MS = 60_000
const MAX_PROCESS_OUTPUT_BYTES = 1024 * 1024
const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 120_000
const INSTALLED_DIRECTORY_NAME = 'active'
const ENGINE_VERSION = 'b4938'
const REQUIRED_LICENSES = ['whisper.cpp-MIT.txt', 'openai-whisper-MIT.txt'] as const

type VoicePackManifest = {
  schemaVersion: 1
  componentVersion: string
  platform: NodeJS.Platform
  arch: string
  engineVersion: string
  model: {
    id: string
    path: string
    sizeBytes: number
    sha256: string
  }
  compatibleAppVersion: {
    min: string
    maxExclusive?: string
  }
}

type VoiceEngineManifest = {
  schemaVersion: 1
  engineVersion: string
  executable: string
  sha256: string
}

export type DefaultVoiceModelDescriptor = {
  manifest: VoicePackManifest
  url: string
}

export const DEFAULT_VOICE_MODEL: DefaultVoiceModelDescriptor = {
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  manifest: {
    schemaVersion: 1,
    componentVersion: '1.0.0',
    platform: process.platform,
    arch: process.arch,
    engineVersion: ENGINE_VERSION,
    model: {
      id: 'whisper-base-multilingual',
      path: 'models/ggml-base.bin',
      sizeBytes: 147_951_465,
      sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    },
    compatibleAppVersion: { min: '0.1.0', maxExclusive: '1.0.0' },
  },
}

export type VoiceComponentServiceOptions = {
  userDataPath: string
  resourcesPath: string
  appVersion: string
  platform?: NodeJS.Platform
  arch?: string
  packaged?: boolean
  defaultModel?: DefaultVoiceModelDescriptor | null
  fetch?: typeof globalThis.fetch
  transcriptionTimeoutMs?: number
  spawnProcess?: typeof spawn
}

type ActiveTranscription = {
  child: ChildProcess
  cancelled: boolean
  timedOut: boolean
}

type VoiceComponentContract = Pick<VoiceComponentService,
  'getStatus' | 'installDefaultModel' | 'installFromDirectory' | 'uninstall' | 'transcribe' | 'cancel'>

export class VoiceComponentService {
  private readonly voiceRoot: string
  private readonly engineRoot: string
  private readonly platform: NodeJS.Platform
  private readonly arch: string
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly spawnProcess: typeof spawn
  private readonly timeoutMs: number
  private installInProgress = false
  private activeTranscriptions = new Map<string, ActiveTranscription>()

  constructor(private readonly options: VoiceComponentServiceOptions) {
    this.platform = options.platform || process.platform
    this.arch = options.arch || process.arch
    this.voiceRoot = path.join(options.userDataPath, 'voice')
    this.engineRoot = resolveEngineRoot(
      options.resourcesPath,
      this.platform,
      this.arch,
      options.packaged === true,
    )
    this.fetchImpl = options.fetch || globalThis.fetch
    this.spawnProcess = options.spawnProcess || spawn
    this.timeoutMs = options.transcriptionTimeoutMs || DEFAULT_TRANSCRIPTION_TIMEOUT_MS
  }

  async getStatus(): Promise<DesktopVoiceStatus> {
    if (this.installInProgress) return { state: 'installing' }
    let engine: VoiceEngineManifest & { executablePath: string }
    try {
      engine = await this.verifyEngine()
    } catch (error) {
      return { state: 'unavailable', message: errorMessage(error) }
    }
    try {
      const installed = await this.verifyVoicePack(path.join(this.voiceRoot, INSTALLED_DIRECTORY_NAME))
      return {
        state: 'ready',
        modelId: installed.manifest.model.id,
        engineVersion: engine.engineVersion,
      }
    } catch (error) {
      if (isMissingError(error)) {
        return { state: 'not-installed', engineVersion: engine.engineVersion }
      }
      return { state: 'error', message: errorMessage(error) }
    }
  }

  async installFromDirectory(sourcePath: string): Promise<DesktopVoiceStatus> {
    if (path.extname(sourcePath).toLowerCase() !== '.hvoice') {
      throw new Error('voice pack directory must use the .hvoice extension')
    }
    await this.withInstallLock(async () => {
      await this.verifyEngine()
      const source = await this.verifyVoicePack(sourcePath)
      const stagingPath = await this.createStagingDirectory()
      try {
        await copyVerifiedPack(source.rootPath, stagingPath)
        await this.verifyVoicePack(stagingPath)
        await this.activateStaging(stagingPath)
      } catch (error) {
        await fs.rm(stagingPath, { recursive: true, force: true })
        throw error
      }
    })
    return this.getStatus()
  }

  async installDefaultModel(): Promise<DesktopVoiceStatus> {
    await this.withInstallLock(async () => {
      const descriptor = this.options.defaultModel === undefined
        ? DEFAULT_VOICE_MODEL
        : this.options.defaultModel
      if (!descriptor) throw new Error('online voice model installation is unavailable')
      await this.verifyEngine()
      validateManifest(descriptor.manifest, this.platform, this.arch, this.options.appVersion)
      const stagingPath = await this.createStagingDirectory()
      const modelPath = resolveSafeRelativePath(stagingPath, descriptor.manifest.model.path)
      const partPath = `${modelPath}.part`
      try {
        await fs.mkdir(path.dirname(modelPath), { recursive: true, mode: 0o700 })
        const response = await this.fetchImpl(descriptor.url, { redirect: 'follow' })
        if (!response.ok || !response.body) {
          throw new Error(`voice model download failed with HTTP ${response.status}`)
        }
        const contentLength = response.headers.get('content-length')
        const declaredLength = contentLength === null ? null : Number(contentLength)
        if (declaredLength !== null
          && Number.isFinite(declaredLength)
          && declaredLength !== descriptor.manifest.model.sizeBytes) {
          throw new Error('voice model download size does not match the pinned descriptor')
        }
        await pipeline(
          Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
          createSizeVerifier(descriptor.manifest.model.sizeBytes),
          createWriteStream(partPath, { flags: 'wx', mode: 0o600 }),
        )
        await fs.rename(partPath, modelPath)
        const licensesPath = path.join(stagingPath, 'LICENSES')
        await fs.mkdir(licensesPath, { recursive: true, mode: 0o700 })
        await Promise.all(REQUIRED_LICENSES.map((name) => (
          fs.copyFile(path.join(this.engineRoot, name), path.join(licensesPath, name))
        )))
        await fs.writeFile(
          path.join(stagingPath, MANIFEST_NAME),
          `${JSON.stringify(descriptor.manifest, null, 2)}\n`,
          { mode: 0o600 },
        )
        await this.verifyVoicePack(stagingPath)
        await this.activateStaging(stagingPath)
      } catch (error) {
        await fs.rm(stagingPath, { recursive: true, force: true })
        throw error
      }
    })
    return this.getStatus()
  }

  async uninstall(): Promise<DesktopVoiceStatus> {
    if (this.installInProgress) throw new Error('voice component installation is in progress')
    if (this.activeTranscriptions.size > 0) throw new Error('voice transcription is in progress')
    await fs.rm(path.join(this.voiceRoot, INSTALLED_DIRECTORY_NAME), { recursive: true, force: true })
    await this.cleanupTransientDirectories()
    return this.getStatus()
  }

  async transcribe(
    input: DesktopVoiceTranscriptionInput,
    owner: string,
  ): Promise<DesktopVoiceTranscriptionResult> {
    if (this.activeTranscriptions.has(owner)) throw new Error('voice transcription is already in progress')
    const audio = validateAudioInput(input)
    const { manifest, modelPath } = await this.verifyVoicePack(
      path.join(this.voiceRoot, INSTALLED_DIRECTORY_NAME),
    )
    const engine = await this.verifyEngine()
    const temporaryRoot = await fs.mkdtemp(path.join(this.voiceRoot, '.transcribe-'))
    const wavPath = path.join(temporaryRoot, 'audio.wav')
    const outputPrefix = path.join(temporaryRoot, 'result')
    const language = whisperLanguage(input.language)
    const args = [
      '-m', modelPath,
      '-f', wavPath,
      '-l', language,
      '-otxt',
      '-of', outputPrefix,
      '-np',
    ]

    try {
      await fs.writeFile(wavPath, audio, { mode: 0o600 })
      const startedAt = Date.now()
      await this.runWhisper(owner, engine.executablePath, args)
      const text = (await fs.readFile(`${outputPrefix}.txt`, 'utf8')).trim()
      if (!text) throw new Error('voice transcription returned no text')
      return { text, modelId: manifest.model.id, durationMs: Date.now() - startedAt }
    } finally {
      this.activeTranscriptions.delete(owner)
      await fs.rm(temporaryRoot, { recursive: true, force: true })
    }
  }

  cancel(owner: string): boolean {
    const active = this.activeTranscriptions.get(owner)
    if (!active) return false
    active.cancelled = true
    active.child.kill()
    return true
  }

  private async withInstallLock<T>(operation: () => Promise<T>): Promise<T> {
    if (this.installInProgress) throw new Error('voice component installation is already in progress')
    if (this.activeTranscriptions.size > 0) throw new Error('voice transcription is in progress')
    this.installInProgress = true
    try {
      await fs.mkdir(this.voiceRoot, { recursive: true, mode: 0o700 })
      await this.cleanupTransientDirectories()
      return await operation()
    } finally {
      this.installInProgress = false
    }
  }

  private async createStagingDirectory(): Promise<string> {
    const stagingPath = path.join(this.voiceRoot, `.install-${randomUUID()}`)
    await fs.mkdir(stagingPath, { recursive: false, mode: 0o700 })
    return stagingPath
  }

  private async activateStaging(stagingPath: string): Promise<void> {
    const activePath = path.join(this.voiceRoot, INSTALLED_DIRECTORY_NAME)
    const backupPath = path.join(this.voiceRoot, `.backup-${randomUUID()}`)
    let hadActive = false
    try {
      await fs.rename(activePath, backupPath)
      hadActive = true
    } catch (error) {
      if (!isMissingError(error)) throw error
    }
    try {
      await fs.rename(stagingPath, activePath)
    } catch (error) {
      if (hadActive) await fs.rename(backupPath, activePath).catch(() => undefined)
      throw error
    }
    if (hadActive) await fs.rm(backupPath, { recursive: true, force: true }).catch(() => undefined)
  }

  private async cleanupTransientDirectories(): Promise<void> {
    const entries = await fs.readdir(this.voiceRoot, { withFileTypes: true }).catch(() => [])
    await Promise.all(entries
      .filter((entry) => entry.name.startsWith('.install-')
        || entry.name.startsWith('.backup-')
        || entry.name.startsWith('.transcribe-'))
      .map((entry) => fs.rm(path.join(this.voiceRoot, entry.name), { recursive: true, force: true })))
  }

  private async verifyVoicePack(rootPath: string): Promise<{
    rootPath: string
    manifest: VoicePackManifest
    modelPath: string
  }> {
    const rootStat = await fs.lstat(rootPath)
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('voice pack must be a real directory')
    const realRoot = await fs.realpath(rootPath)
    await assertNoSymlinks(realRoot)
    const manifestPath = path.join(realRoot, MANIFEST_NAME)
    const manifestStat = await fs.lstat(manifestPath)
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 64 * 1024) {
      throw new Error('voice pack manifest is invalid')
    }
    const manifest = parseManifest(await fs.readFile(manifestPath, 'utf8'))
    validateManifest(manifest, this.platform, this.arch, this.options.appVersion)
    const modelPath = resolveSafeRelativePath(realRoot, manifest.model.path)
    const modelStat = await fs.lstat(modelPath)
    if (!modelStat.isFile() || modelStat.isSymbolicLink()) throw new Error('voice model must be a regular file')
    if (modelStat.size !== manifest.model.sizeBytes) throw new Error('voice model size does not match manifest')
    const digest = await sha256File(modelPath)
    if (digest !== manifest.model.sha256) throw new Error('voice model SHA-256 does not match manifest')
    await validatePackContents(realRoot, manifest.model.path)
    return { rootPath: realRoot, manifest, modelPath }
  }

  private async verifyEngine(): Promise<VoiceEngineManifest & { executablePath: string }> {
    const manifestPath = path.join(this.engineRoot, 'engine-manifest.json')
    let parsed: unknown
    try {
      parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    } catch (error) {
      if (isMissingError(error)) throw new Error(`voice engine is unavailable for ${this.platform}/${this.arch}`)
      throw new Error('voice engine manifest is invalid')
    }
    if (!isRecord(parsed)
      || parsed.schemaVersion !== 1
      || parsed.engineVersion !== ENGINE_VERSION
      || typeof parsed.executable !== 'string'
      || !/^[a-zA-Z0-9._-]+$/.test(parsed.executable)
      || typeof parsed.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(parsed.sha256)) {
      throw new Error('voice engine manifest is invalid')
    }
    const executablePath = resolveSafeRelativePath(this.engineRoot, parsed.executable)
    const stat = await fs.lstat(executablePath)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('voice engine executable is invalid')
    if (await sha256File(executablePath) !== parsed.sha256) {
      throw new Error('voice engine SHA-256 verification failed')
    }
    return { ...(parsed as VoiceEngineManifest), executablePath }
  }

  private runWhisper(owner: string, executable: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = this.spawnProcess(executable, args, {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const active: ActiveTranscription = { child, cancelled: false, timedOut: false }
      this.activeTranscriptions.set(owner, active)
      let settled = false
      let outputBytes = 0
      let stderr = ''
      let terminationFallback: NodeJS.Timeout | null = null
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (terminationFallback) clearTimeout(terminationFallback)
        error ? reject(error) : resolve()
      }
      const collect = (chunk: Buffer, stderrOutput: boolean) => {
        outputBytes += chunk.length
        if (outputBytes > MAX_PROCESS_OUTPUT_BYTES) {
          child.kill()
          finish(new Error('voice engine output exceeded the allowed size'))
          return
        }
        if (stderrOutput) stderr += chunk.toString('utf8')
      }
      child.stdout?.on('data', (chunk: Buffer) => collect(chunk, false))
      child.stderr?.on('data', (chunk: Buffer) => collect(chunk, true))
      child.once('error', (error) => finish(error))
      child.once('close', (code) => {
        if (active.cancelled) return finish(new Error('voice transcription was cancelled'))
        if (active.timedOut) return finish(new Error('voice transcription timed out'))
        if (code !== 0) return finish(new Error(`voice engine failed (${code ?? 'unknown'}): ${stderr.trim().slice(0, 512)}`))
        finish()
      })
      const timeout = setTimeout(() => {
        active.timedOut = true
        child.kill()
        terminationFallback = setTimeout(() => {
          finish(new Error('voice transcription timed out'))
        }, 2000)
        terminationFallback.unref?.()
      }, this.timeoutMs)
      timeout.unref?.()
    })
  }
}

let handlersRegistered = false
let trustedVoiceOrigin: string | null = null

export function setTrustedVoiceOrigin(origin: string | null): void {
  trustedVoiceOrigin = origin
}

export function registerVoiceComponentHandlers(
  service?: VoiceComponentContract,
): void {
  if (handlersRegistered) return
  handlersRegistered = true
  let instance = service
  const getService = (): VoiceComponentContract => {
    if (instance) return instance
    instance = new VoiceComponentService({
      userDataPath: app.getPath('userData'),
      resourcesPath: app.isPackaged
        ? process.resourcesPath
        : path.resolve(__dirname, '..', '..', 'resources'),
      appVersion: typeof app.getVersion === 'function' ? app.getVersion() : '0.1.0',
      packaged: app.isPackaged,
      fetch: globalThis.fetch,
    })
    return instance
  }
  ipcMain.handle('voice:get-status', (event) => {
    assertTrustedVoiceSender(event)
    return getService().getStatus()
  })
  ipcMain.handle('voice:install-default-model', (event) => {
    assertTrustedVoiceSender(event)
    return getService().installDefaultModel()
  })
  ipcMain.handle('voice:import-pack', async (event) => {
    assertTrustedVoiceSender(event)
    const selection = await dialog.showOpenDialog({
      title: 'Import Forge Harness Voice Pack',
      properties: ['openDirectory'],
    })
    if (selection.canceled || !selection.filePaths[0]) return getService().getStatus()
    return getService().installFromDirectory(selection.filePaths[0])
  })
  ipcMain.handle('voice:uninstall', (event) => {
    assertTrustedVoiceSender(event)
    return getService().uninstall()
  })
  ipcMain.handle('voice:transcribe', (event, input: DesktopVoiceTranscriptionInput) => {
    assertTrustedVoiceSender(event)
    return getService().transcribe(input, String(event.sender.id))
  })
  ipcMain.handle('voice:cancel', (event) => {
    assertTrustedVoiceSender(event)
    return getService().cancel(String(event.sender.id))
  })
}

function assertTrustedVoiceSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url || event.sender.getURL()
  try {
    const url = new URL(senderUrl)
    const packagedRenderer = url.protocol === 'harness-app:' && url.hostname === 'renderer'
    const localRuntime = trustedVoiceOrigin !== null && url.origin === trustedVoiceOrigin
    const devServerUrl = getAppConfig().devServerUrl
    const developmentRenderer = !app.isPackaged
      && url.origin === new URL(devServerUrl).origin
    if (packagedRenderer || localRuntime || developmentRenderer) return
  } catch {
    // Fail closed below.
  }
  throw new Error('voice IPC is unavailable for this origin')
}

function resolveEngineRoot(
  resourcesPath: string,
  platform: NodeJS.Platform,
  arch: string,
  packaged: boolean,
): string {
  return packaged
    ? path.join(resourcesPath, 'voice')
    : path.join(resourcesPath, 'voice', electronBuilderOs(platform), arch)
}

function electronBuilderOs(platform: NodeJS.Platform): string {
  if (platform === 'darwin') return 'mac'
  if (platform === 'win32') return 'win'
  return platform
}

function parseManifest(value: string): VoicePackManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('voice pack manifest is not valid JSON')
  }
  if (!isRecord(parsed)
    || parsed.schemaVersion !== MANIFEST_SCHEMA_VERSION
    || typeof parsed.componentVersion !== 'string'
    || typeof parsed.platform !== 'string'
    || typeof parsed.arch !== 'string'
    || typeof parsed.engineVersion !== 'string'
    || !isRecord(parsed.model)
    || typeof parsed.model.id !== 'string'
    || typeof parsed.model.path !== 'string'
    || typeof parsed.model.sizeBytes !== 'number'
    || typeof parsed.model.sha256 !== 'string'
    || !isRecord(parsed.compatibleAppVersion)
    || typeof parsed.compatibleAppVersion.min !== 'string'
    || (parsed.compatibleAppVersion.maxExclusive !== undefined
      && typeof parsed.compatibleAppVersion.maxExclusive !== 'string')) {
    throw new Error('voice pack manifest schema is invalid')
  }
  return parsed as VoicePackManifest
}

function validateManifest(
  manifest: VoicePackManifest,
  platform: NodeJS.Platform,
  arch: string,
  appVersion: string,
): void {
  if (manifest.platform !== platform || manifest.arch !== arch) {
    throw new Error(`voice pack targets ${manifest.platform}/${manifest.arch}, expected ${platform}/${arch}`)
  }
  if (manifest.engineVersion !== ENGINE_VERSION) throw new Error('voice pack engine version is incompatible')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(manifest.model.id)) {
    throw new Error('voice pack model ID is invalid')
  }
  if (!Number.isSafeInteger(manifest.model.sizeBytes)
    || manifest.model.sizeBytes <= 0
    || manifest.model.sizeBytes > MAX_MODEL_BYTES) {
    throw new Error('voice pack model size is invalid')
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.model.sha256)) throw new Error('voice pack SHA-256 is invalid')
  if (!isSafeRelativePath(manifest.model.path)) throw new Error('voice pack model path is unsafe')
  if (!manifest.model.path.startsWith('models/') || !manifest.model.path.endsWith('.bin')) {
    throw new Error('voice pack model must be a .bin file under models/')
  }
  if (!isValidSemver(manifest.componentVersion)
    || !isValidSemver(manifest.compatibleAppVersion.min)
    || (manifest.compatibleAppVersion.maxExclusive
      && !isValidSemver(manifest.compatibleAppVersion.maxExclusive))) {
    throw new Error('voice pack version metadata is invalid')
  }
  if (compareSemver(appVersion, manifest.compatibleAppVersion.min) < 0
    || (manifest.compatibleAppVersion.maxExclusive
      && compareSemver(appVersion, manifest.compatibleAppVersion.maxExclusive) >= 0)) {
    throw new Error(`voice pack is incompatible with app version ${appVersion}`)
  }
}

function validateAudioInput(input: DesktopVoiceTranscriptionInput): Buffer {
  if (!isRecord(input)) throw new Error('voice transcription input is invalid')
  if (!['zh-CN', 'en-US', 'auto'].includes(input.language)) throw new Error('voice language is invalid')
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0 || input.durationMs > MAX_AUDIO_DURATION_MS) {
    throw new Error('voice recording duration must be between 1 ms and 60 seconds')
  }
  const audio = Buffer.isBuffer(input.audio)
    ? input.audio
    : input.audio instanceof Uint8Array
      ? Buffer.from(input.audio)
      : null
  if (!audio || audio.length < 44 || audio.length > MAX_AUDIO_BYTES) {
    throw new Error('voice audio size is invalid')
  }
  validatePcmWav(audio, input.durationMs)
  return audio
}

function validatePcmWav(audio: Buffer, declaredDurationMs: number): void {
  if (audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('voice audio must be a PCM WAV file')
  }
  if (audio.readUInt32LE(4) + 8 !== audio.length) throw new Error('voice WAV size is invalid')
  let offset = 12
  let format: { encoding: number; channels: number; sampleRate: number; bits: number } | null = null
  let dataBytes: number | null = null
  while (offset + 8 <= audio.length) {
    const id = audio.toString('ascii', offset, offset + 4)
    const size = audio.readUInt32LE(offset + 4)
    const dataStart = offset + 8
    if (dataStart + size > audio.length) throw new Error('voice WAV chunk is truncated')
    if (id === 'fmt ' && size >= 16) {
      format = {
        encoding: audio.readUInt16LE(dataStart),
        channels: audio.readUInt16LE(dataStart + 2),
        sampleRate: audio.readUInt32LE(dataStart + 4),
        bits: audio.readUInt16LE(dataStart + 14),
      }
    } else if (id === 'data') {
      dataBytes = size
    }
    offset = dataStart + size + (size % 2)
  }
  if (!format || format.encoding !== 1 || format.channels !== 1
    || format.sampleRate !== 16_000 || format.bits !== 16 || dataBytes === null) {
    throw new Error('voice audio must be 16 kHz mono 16-bit PCM WAV')
  }
  const actualDurationMs = (dataBytes / (16_000 * 2)) * 1000
  if (actualDurationMs > MAX_AUDIO_DURATION_MS + 1) throw new Error('voice audio exceeds 60 seconds')
  if (Math.abs(actualDurationMs - declaredDurationMs) > Math.max(1000, actualDurationMs * 0.1)) {
    throw new Error('voice audio duration does not match its WAV data')
  }
}

async function assertNoSymlinks(rootPath: string): Promise<void> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name)
    const stat = await fs.lstat(entryPath)
    if (stat.isSymbolicLink()) throw new Error('voice pack must not contain symbolic links')
    if (stat.isDirectory()) await assertNoSymlinks(entryPath)
  }
}

async function validatePackContents(rootPath: string, modelPath: string): Promise<void> {
  const allowedModel = path.normalize(modelPath)
  const visit = async (directory: string, relativeDirectory = ''): Promise<void> => {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const relative = path.normalize(path.join(relativeDirectory, entry.name))
      if (entry.isDirectory()) {
        if (relative !== 'models' && relative !== 'LICENSES') {
          throw new Error(`voice pack contains unexpected directory: ${relative}`)
        }
        await visit(path.join(directory, entry.name), relative)
        continue
      }
      const allowed = relative === MANIFEST_NAME
        || relative === allowedModel
        || (relative.startsWith(`LICENSES${path.sep}`) && /\.txt$/i.test(relative))
      if (!allowed) throw new Error(`voice pack contains unexpected file: ${relative}`)
    }
  }
  await visit(rootPath)
  await Promise.all(REQUIRED_LICENSES.map(async (name) => {
    const licensePath = path.join(rootPath, 'LICENSES', name)
    const stat = await fs.lstat(licensePath)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > 64 * 1024) {
      throw new Error(`voice pack license is invalid: ${name}`)
    }
  }))
}

async function copyVerifiedPack(sourceRoot: string, destinationRoot: string): Promise<void> {
  for (const entry of await fs.readdir(sourceRoot)) {
    await fs.cp(path.join(sourceRoot, entry), path.join(destinationRoot, entry), {
      recursive: true,
      errorOnExist: true,
      force: false,
      verbatimSymlinks: true,
    })
  }
}

function resolveSafeRelativePath(rootPath: string, relativePath: string): string {
  if (!isSafeRelativePath(relativePath)) throw new Error('voice pack path is unsafe')
  const resolved = path.resolve(rootPath, relativePath)
  const relative = path.relative(path.resolve(rootPath), resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('voice pack path escapes its root')
  }
  return resolved
}

function isSafeRelativePath(value: string): boolean {
  if (!value || path.isAbsolute(value) || value.includes('\\')) return false
  const parts = value.split('/')
  return parts.every((part) => part !== '' && part !== '.' && part !== '..')
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

function createSizeVerifier(expectedBytes: number): Transform {
  let bytes = 0
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length
      if (bytes > expectedBytes || bytes > MAX_MODEL_BYTES) {
        callback(new Error('voice model download exceeded the pinned size'))
        return
      }
      callback(null, chunk)
    },
    flush(callback) {
      callback(bytes === expectedBytes
        ? undefined
        : new Error('voice model download was incomplete'))
    },
  })
}

function whisperLanguage(language: DesktopVoiceLanguage): string {
  if (language === 'zh-CN') return 'zh'
  if (language === 'en-US') return 'en'
  return 'auto'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMissingError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isValidSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split('-', 1)[0].split('.').map(Number)
  const rightParts = right.split('-', 1)[0].split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index]
  }
  return 0
}

export const voiceComponentTestUtils = {
  validateAudioInput,
  validateManifest,
}
