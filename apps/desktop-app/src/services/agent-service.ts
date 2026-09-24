import { ipcMain } from 'electron'
import { redactSensitiveValue } from '../shared/privacy-redaction'
import type {
  LocalAgentConversationBinding,
  LocalAgentSendMessagePayload,
  LocalAgentSendMessageResponse,
  AgentRunWorkspace,
  LocalAgentConnection,
} from '../preload-api'
import { apiRequest, buildQueryString } from '../shared/api-client'
import { assertTrustedRendererSender } from './ipc-security'

export function registerAgentHandlers(): void {
  ipcMain.handle(
    'agent:bind-conversation',
    async (
      event,
      connectionId: string,
      payload: {
        agent_session_id?: string | null
        title?: string | null
        adapter_session_id?: string | null
        resume_mode?: 'native_resume' | 'context_replay_new_session'
      } = {}
    ): Promise<LocalAgentConversationBinding> => {
      assertTrustedRendererSender(event)
      return apiRequest<LocalAgentConversationBinding>(
        `/api/agents/local-agent/connections/${connectionId}/bindings`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
    }
  )

  ipcMain.handle(
    'agent:send-message',
    async (
      event,
      bindingId: string,
      payload: LocalAgentSendMessagePayload
    ): Promise<LocalAgentSendMessageResponse> => {
      assertTrustedRendererSender(event)
      return apiRequest<LocalAgentSendMessageResponse>(
        `/api/agents/local-agent/bindings/${bindingId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
    }
  )

  ipcMain.handle(
    'agent:get-workspace',
    async (
      event,
      runId: string,
      selectors: { retrieval_session_id?: string; prompt_manifest_id?: string } = {}
    ): Promise<AgentRunWorkspace> => {
      assertTrustedRendererSender(event)
      const suffix = buildQueryString({
        retrieval_session_id: selectors.retrieval_session_id,
        prompt_manifest_id: selectors.prompt_manifest_id,
      })

      return apiRequest<AgentRunWorkspace>(
        `/api/agents/runs/${runId}/workspace${suffix}`
      )
    }
  )

  ipcMain.handle(
    'agent:list-connections',
    async (event): Promise<{ items: LocalAgentConnection[] }> => {
      assertTrustedRendererSender(event)
      return apiRequest<{ items: LocalAgentConnection[] }>(
        '/api/agents/local-agent/connections'
      )
    }
  )

  ipcMain.handle(
    'feedback:submit',
    async (event, payload: {
      title: string
      description: string
      category?: 'bug' | 'idea' | 'praise' | 'support'
      channel?: 'stable' | 'beta'
      app_version: string
      platform: string
      logs?: string[]
      screenshot_data_url?: string | null
      metadata?: Record<string, unknown>
    }) => {
      assertTrustedRendererSender(event)
      return apiRequest('/api/desktop/feedback', {
        method: 'POST',
        body: JSON.stringify(redactSensitiveValue(payload)),
      })
    }
  )

  ipcMain.handle(
    'feedback:record-metric',
    async (
      event,
      payload: {
        metric_name: 'startup_time_ms' | 'crash_event' | 'sync_success' | 'sync_failure'
        channel?: 'stable' | 'beta'
        app_version: string
        platform: string
        value?: number
        metadata?: Record<string, unknown>
      }
    ) => {
      assertTrustedRendererSender(event)
      return apiRequest('/api/desktop/metrics', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
  )

  ipcMain.handle('feedback:get-metrics-summary', async (event) => {
    assertTrustedRendererSender(event)
    return apiRequest('/api/desktop/metrics/summary')
  })
}
