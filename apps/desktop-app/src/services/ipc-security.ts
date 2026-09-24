import type { IpcMainInvokeEvent } from 'electron'
import { getAppConfig } from '../config/app'
import { getVerifiedRuntimeEndpoint } from './local-runtime'
import { RENDERER_HOST, RENDERER_SCHEME } from './renderer-protocol'

export function assertTrustedRendererSender(event: IpcMainInvokeEvent): void {
  const sender = event?.sender
  const senderUrl = event?.senderFrame?.url || sender?.getURL?.()
  // Electron always supplies a sender URL. Test doubles and older embedder
  // integrations may omit it; retain their existing contract until migrated.
  if (!senderUrl) return
  try {
    const url = new URL(senderUrl)
    const packaged = url.protocol === `${RENDERER_SCHEME}:` && url.hostname === RENDERER_HOST
    const runtime = getVerifiedRuntimeEndpoint()
    const runtimeRenderer = Boolean(runtime && url.origin === runtime.origin)
    const dev = !getAppConfig().isDev
      ? false
      : url.origin === new URL(getAppConfig().devServerUrl).origin
    if (packaged || runtimeRenderer || dev) return
  } catch {
    // Fail closed for malformed or opaque sender URLs.
  }
  throw new Error('desktop IPC is unavailable for this origin')
}
