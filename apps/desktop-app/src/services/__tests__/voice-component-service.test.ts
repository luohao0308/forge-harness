import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { PassThrough } from 'node:stream'
import type { ChildProcess, spawn } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

type VoiceManifest = {
  schemaVersion: 1
  componentVersion: string
  platform: NodeJS.Platform
  arch: string
  engineVersion: string
  model: { id: string; path: string; sizeBytes: number; sha256: string }
  compatibleAppVersion: { min: string; maxExclusive: string }
}

describe('VoiceComponentService', () => {
  let root: string
  let userDataPath: string
  let resourcesPath: string

  beforeEach(() => {
    vi.resetModules()
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-voice-'))
    userDataPath = path.join(root, 'user-data')
    resourcesPath = path.join(root, 'dev-resources')
    fs.mkdirSync(userDataPath, { recursive: true })
    createEngine(resourcesPath)
    vi.doMock('electron', () => ({
      app: {
        getPath: vi.fn(() => userDataPath),
        getVersion: vi.fn(() => '0.1.0'),
        isPackaged: true,
      },
      dialog: { showOpenDialog: vi.fn() },
      ipcMain: { handle: vi.fn() },
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  test('atomically imports a valid pack and hot-uninstalls it', async () => {
    const { VoiceComponentService } = await import('../voice-component-service')
    const source = createPack(root, 'valid.hvoice', Buffer.from('model-data'))
    const service = new VoiceComponentService({ userDataPath, resourcesPath, appVersion: '0.1.0' })

    await expect(service.getStatus()).resolves.toMatchObject({ state: 'not-installed' })
    await expect(service.installFromDirectory(source)).resolves.toMatchObject({
      state: 'ready',
      modelId: 'whisper-base-multilingual',
      engineVersion: 'b4938',
    })

    const installedModel = path.join(userDataPath, 'voice', 'active', 'models', 'ggml-base.bin')
    expect(fs.readFileSync(installedModel)).toEqual(Buffer.from('model-data'))
    expect(fs.readdirSync(path.join(userDataPath, 'voice')).filter((name) => name.startsWith('.'))).toEqual([])

    await expect(service.uninstall()).resolves.toMatchObject({ state: 'not-installed' })
    expect(fs.existsSync(path.join(userDataPath, 'voice', 'active'))).toBe(false)
  })

  test('rejects wrong platform, traversal, symlinks, size and SHA-256 without replacing active model', async () => {
    const { VoiceComponentService } = await import('../voice-component-service')
    const service = new VoiceComponentService({ userDataPath, resourcesPath, appVersion: '0.1.0' })
    const valid = createPack(root, 'valid.hvoice', Buffer.from('known-good'))
    await service.installFromDirectory(valid)

    const wrongPlatform = createPack(root, 'wrong-platform.hvoice', Buffer.from('new'), {
      platform: process.platform === 'darwin' ? 'linux' : 'darwin',
    })
    await expect(service.installFromDirectory(wrongPlatform)).rejects.toThrow(/targets/)

    const traversal = createPack(root, 'traversal.hvoice', Buffer.from('new'), {
      model: { path: '../outside.bin' },
    })
    await expect(service.installFromDirectory(traversal)).rejects.toThrow(/unsafe/)

    const wrongSize = createPack(root, 'wrong-size.hvoice', Buffer.from('new'), {
      model: { sizeBytes: 99 },
    })
    await expect(service.installFromDirectory(wrongSize)).rejects.toThrow(/size/)

    const wrongHash = createPack(root, 'wrong-hash.hvoice', Buffer.from('new'), {
      model: { sha256: '0'.repeat(64) },
    })
    await expect(service.installFromDirectory(wrongHash)).rejects.toThrow(/SHA-256/)

    const symlink = createPack(root, 'symlink.hvoice', Buffer.from('new'))
    fs.symlinkSync(path.join(symlink, 'models', 'ggml-base.bin'), path.join(symlink, 'LICENSES', 'linked.txt'))
    await expect(service.installFromDirectory(symlink)).rejects.toThrow(/symbolic links/)

    expect(fs.readFileSync(path.join(userDataPath, 'voice', 'active', 'models', 'ggml-base.bin')))
      .toEqual(Buffer.from('known-good'))
  })

  test('downloads a pinned model through a bounded part file and validates it before activation', async () => {
    const { VoiceComponentService } = await import('../voice-component-service')
    const model = Buffer.from('downloaded-model')
    const descriptor = {
      url: 'https://models.invalid/ggml-base.bin',
      manifest: makeManifest(model),
    }
    const fetchMock = vi.fn(async () => new Response(model, {
      status: 200,
      headers: { 'content-length': String(model.length) },
    }))
    const service = new VoiceComponentService({
      userDataPath,
      resourcesPath,
      appVersion: '0.1.0',
      defaultModel: descriptor,
      fetch: fetchMock as typeof fetch,
    })

    await expect(service.installDefaultModel()).resolves.toMatchObject({ state: 'ready' })
    expect(fetchMock).toHaveBeenCalledWith(descriptor.url, { redirect: 'follow' })
    expect(fs.readdirSync(path.join(userDataPath, 'voice'), { recursive: true })
      .some((name) => String(name).endsWith('.part'))).toBe(false)
  })

  test('validates 16 kHz mono PCM WAV and executes only the fixed engine path without a shell', async () => {
    const { VoiceComponentService } = await import('../voice-component-service')
    const source = createPack(root, 'valid.hvoice', Buffer.from('model'))
    const spawnMock = vi.fn((executable: string, args: string[], options: object) => {
      const child = fakeChild()
      process.nextTick(() => {
        const outputPrefix = args[args.indexOf('-of') + 1]
        fs.writeFileSync(`${outputPrefix}.txt`, '你好，Forge Harness。\n')
        child.emit('close', 0)
      })
      return child as unknown as ChildProcess
    })
    const service = new VoiceComponentService({
      userDataPath,
      resourcesPath,
      appVersion: '0.1.0',
      spawnProcess: spawnMock as unknown as typeof spawn,
    })
    await service.installFromDirectory(source)

    await expect(service.transcribe({
      audio: makeWav(1000),
      language: 'zh-CN',
      durationMs: 1000,
    }, 'renderer-1')).resolves.toMatchObject({ text: '你好，Forge Harness。' })

    const [executable, args, options] = spawnMock.mock.calls[0]
    expect(executable).toBe(engineExecutable(resourcesPath))
    expect(args).toEqual(expect.arrayContaining(['-l', 'zh', '-m', expect.stringContaining('ggml-base.bin')]))
    expect(options).toMatchObject({ shell: false, windowsHide: true })
    expect(fs.readdirSync(path.join(userDataPath, 'voice')).some((name) => name.startsWith('.transcribe-')))
      .toBe(false)
  })

  test('rejects invalid WAV data before spawning and cleans temporary audio after cancellation', async () => {
    const { VoiceComponentService } = await import('../voice-component-service')
    const source = createPack(root, 'valid.hvoice', Buffer.from('model'))
    const child = fakeChild()
    child.kill.mockImplementation(() => {
      process.nextTick(() => child.emit('close', null))
      return true
    })
    const spawnMock = vi.fn(() => child as unknown as ChildProcess)
    const service = new VoiceComponentService({
      userDataPath,
      resourcesPath,
      appVersion: '0.1.0',
      spawnProcess: spawnMock as unknown as typeof spawn,
    })
    await service.installFromDirectory(source)

    await expect(service.transcribe({
      audio: new Uint8Array(64),
      language: 'auto',
      durationMs: 1000,
    }, 'renderer-1')).rejects.toThrow(/PCM WAV/)
    expect(spawnMock).not.toHaveBeenCalled()

    const transcription = service.transcribe({
      audio: makeWav(1000),
      language: 'auto',
      durationMs: 1000,
    }, 'renderer-1')
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce())
    expect(service.cancel('renderer-1')).toBe(true)
    await expect(transcription).rejects.toThrow(/cancelled/)
    expect(child.kill).toHaveBeenCalled()
    expect(fs.readdirSync(path.join(userDataPath, 'voice')).some((name) => name.startsWith('.transcribe-')))
      .toBe(false)
  })

  test('times out a stuck engine and removes its temporary WAV', async () => {
    const { VoiceComponentService } = await import('../voice-component-service')
    const source = createPack(root, 'valid.hvoice', Buffer.from('model'))
    const child = fakeChild()
    child.kill.mockImplementation(() => {
      process.nextTick(() => child.emit('close', null))
      return true
    })
    const spawnMock = vi.fn(() => child as unknown as ChildProcess)
    const service = new VoiceComponentService({
      userDataPath,
      resourcesPath,
      appVersion: '0.1.0',
      spawnProcess: spawnMock as unknown as typeof spawn,
      transcriptionTimeoutMs: 10,
    })
    await service.installFromDirectory(source)

    await expect(service.transcribe({
      audio: makeWav(1000),
      language: 'en-US',
      durationMs: 1000,
    }, 'renderer-1')).rejects.toThrow(/timed out/)
    expect(child.kill).toHaveBeenCalled()
    expect(fs.readdirSync(path.join(userDataPath, 'voice')).some((name) => name.startsWith('.transcribe-')))
      .toBe(false)
  })

  test('registers fail-closed IPC handlers for trusted renderer origins only', async () => {
    const electron = await import('electron')
    const { registerVoiceComponentHandlers, setTrustedVoiceOrigin } = await import('../voice-component-service')
    const service = {
      getStatus: vi.fn(async () => ({ state: 'not-installed' as const })),
      installDefaultModel: vi.fn(),
      installFromDirectory: vi.fn(),
      uninstall: vi.fn(),
      transcribe: vi.fn(),
      cancel: vi.fn(),
    }
    registerVoiceComponentHandlers(service)
    const handle = vi.mocked(electron.ipcMain.handle)
    const statusHandler = handle.mock.calls.find(([channel]) => channel === 'voice:get-status')?.[1]
    expect(statusHandler).toBeDefined()

    const event = (url: string) => ({
      senderFrame: { url },
      sender: { id: 7, getURL: () => url },
    })
    expect(() => statusHandler!(event('https://attacker.example') as never)).toThrow(/unavailable/)
    await expect(statusHandler!(event('harness-app://renderer/index.html') as never)).resolves.toEqual({
      state: 'not-installed',
    })
    setTrustedVoiceOrigin('http://127.0.0.1:43117')
    await expect(statusHandler!(event('http://127.0.0.1:43117/desktop/') as never)).resolves.toEqual({
      state: 'not-installed',
    })
  })
})

function createEngine(resourcesPath: string): void {
  const directory = path.join(resourcesPath, 'voice', builderOs(), process.arch)
  fs.mkdirSync(directory, { recursive: true })
  const executable = engineExecutable(resourcesPath)
  fs.writeFileSync(executable, 'fixed whisper engine')
  fs.writeFileSync(path.join(directory, 'engine-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    engineVersion: 'b4938',
    executable: path.basename(executable),
    sha256: sha256(Buffer.from('fixed whisper engine')),
  }))
  fs.writeFileSync(path.join(directory, 'whisper.cpp-MIT.txt'), 'MIT')
  fs.writeFileSync(path.join(directory, 'openai-whisper-MIT.txt'), 'MIT')
}

function engineExecutable(resourcesPath: string): string {
  return path.join(
    resourcesPath,
    'voice',
    builderOs(),
    process.arch,
    process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli',
  )
}

function builderOs(): string {
  if (process.platform === 'darwin') return 'mac'
  if (process.platform === 'win32') return 'win'
  return process.platform
}

function createPack(
  root: string,
  name: string,
  model: Buffer,
  overrides: {
    platform?: NodeJS.Platform
    model?: Partial<VoiceManifest['model']>
  } = {},
): string {
  const directory = path.join(root, name)
  fs.mkdirSync(path.join(directory, 'models'), { recursive: true })
  fs.mkdirSync(path.join(directory, 'LICENSES'), { recursive: true })
  fs.writeFileSync(path.join(directory, 'models', 'ggml-base.bin'), model)
  fs.writeFileSync(path.join(directory, 'LICENSES', 'whisper.cpp-MIT.txt'), 'MIT')
  fs.writeFileSync(path.join(directory, 'LICENSES', 'openai-whisper-MIT.txt'), 'MIT')
  const manifest = makeManifest(model)
  if (overrides.platform) manifest.platform = overrides.platform
  manifest.model = { ...manifest.model, ...overrides.model }
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest))
  return directory
}

function makeManifest(model: Buffer): VoiceManifest {
  return {
    schemaVersion: 1,
    componentVersion: '1.0.0',
    platform: process.platform,
    arch: process.arch,
    engineVersion: 'b4938',
    model: {
      id: 'whisper-base-multilingual',
      path: 'models/ggml-base.bin',
      sizeBytes: model.length,
      sha256: sha256(model),
    },
    compatibleAppVersion: { min: '0.1.0', maxExclusive: '1.0.0' },
  }
}

function makeWav(durationMs: number): Uint8Array {
  const dataBytes = Math.round(16_000 * 2 * durationMs / 1000)
  const output = Buffer.alloc(44 + dataBytes)
  output.write('RIFF', 0)
  output.writeUInt32LE(36 + dataBytes, 4)
  output.write('WAVE', 8)
  output.write('fmt ', 12)
  output.writeUInt32LE(16, 16)
  output.writeUInt16LE(1, 20)
  output.writeUInt16LE(1, 22)
  output.writeUInt32LE(16_000, 24)
  output.writeUInt32LE(32_000, 28)
  output.writeUInt16LE(2, 32)
  output.writeUInt16LE(16, 34)
  output.write('data', 36)
  output.writeUInt32LE(dataBytes, 40)
  return output
}

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: null
    stdout: PassThrough
    stderr: PassThrough
    kill: ReturnType<typeof vi.fn>
  }
  child.stdin = null
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = vi.fn(() => true)
  return child
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}
