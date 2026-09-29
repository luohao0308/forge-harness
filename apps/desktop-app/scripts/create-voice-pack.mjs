import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const MODEL_SIZE = 147_951_465
const MODEL_SHA256 = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe'
const ENGINE_VERSION = 'b4938'
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modelPath = argument('--model')
const outputPath = path.resolve(argument('--output'))

if (path.extname(outputPath).toLowerCase() !== '.hvoice') {
  throw new Error('voice pack output must be a .hvoice directory')
}
const modelStat = await stat(modelPath)
if (!modelStat.isFile() || modelStat.size !== MODEL_SIZE || await sha256File(modelPath) !== MODEL_SHA256) {
  throw new Error('model does not match the pinned multilingual whisper base descriptor')
}

const packageJson = JSON.parse(await readFile(path.join(appRoot, 'package.json'), 'utf8'))
const stagingPath = `${outputPath}.part-${randomUUID()}`
try {
  await mkdir(path.join(stagingPath, 'models'), { recursive: true, mode: 0o700 })
  await mkdir(path.join(stagingPath, 'LICENSES'), { recursive: true, mode: 0o700 })
  await copyFile(modelPath, path.join(stagingPath, 'models', 'ggml-base.bin'))
  await copyFile(
    path.join(appRoot, 'resources', 'voice', 'whisper.cpp-MIT.txt'),
    path.join(stagingPath, 'LICENSES', 'whisper.cpp-MIT.txt'),
  )
  await copyFile(
    path.join(appRoot, 'resources', 'voice', 'openai-whisper-MIT.txt'),
    path.join(stagingPath, 'LICENSES', 'openai-whisper-MIT.txt'),
  )
  await writeFile(path.join(stagingPath, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    componentVersion: '1.0.0',
    platform: process.platform,
    arch: process.arch,
    engineVersion: ENGINE_VERSION,
    model: {
      id: 'whisper-base-multilingual',
      path: 'models/ggml-base.bin',
      sizeBytes: MODEL_SIZE,
      sha256: MODEL_SHA256,
    },
    compatibleAppVersion: {
      min: packageJson.version,
      maxExclusive: '1.0.0',
    },
  }, null, 2)}\n`, { mode: 0o600 })
  await rename(stagingPath, outputPath)
  process.stdout.write(`Created Voice Pack: ${outputPath}\n`)
} catch (error) {
  await rm(stagingPath, { recursive: true, force: true })
  throw error
}

function argument(name) {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value) throw new Error(`missing required argument: ${name}`)
  return path.resolve(value)
}

async function sha256File(filePath) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}
