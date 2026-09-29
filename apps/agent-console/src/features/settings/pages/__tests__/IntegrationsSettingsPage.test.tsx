import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../app/ConsoleShell", () => ({
  ConsoleShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../tasks/api", () => ({
  getToolRegistry: vi.fn(async () => ({ items: [{ name: "search", description: "", category: "mcp", source: "mcp", risk_level: "low", requires_sandbox: false, network_policy: "restricted", timeout_seconds: 30, allowed_roles: [], audit_level: "standard", idempotent: true, input_schema: {}, mcp_server: "demo", mcp_method: "search" }], categories: ["mcp"], sources: ["mcp"] })),
  listAgentKnowledgeSources: vi.fn(async () => ({ items: [{ id: "knowledge-1", name: "Docs", description: "", source_type: "connector", status: "ACTIVE", version: 1, scope: "agent", health_status: "HEALTHY", connector_secret_configured: true, connector_validation_status: "ready", settings_json: {}, metadata_json: {}, organization_id: "org", agent_id: "default", expires_at: null, disabled_at: null, archived_at: null, last_indexed_at: null, last_ingestion_error: null, connector_provider: "dify", connector_release_state: "usable", connector_counts_toward_complete_usable: true, idempotency_key: null, created_by: null, created_at: "2026-01-01", updated_at: "2026-01-01", latest_documents: [] }], next_cursor: null })),
  listAgentTriggers: vi.fn(async () => ({ items: [{ id: "trigger-1" }] })),
  listLocalAgentConnections: vi.fn(async () => ({ items: [{ id: "connection-1", status: "online" }] })),
}));

import { IntegrationsSettingsPage } from "../IntegrationsSettingsPage";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={["/settings/integrations"]}><IntegrationsSettingsPage /></MemoryRouter></QueryClientProvider>);
}

describe("IntegrationsSettingsPage", () => {
  it("aggregates live integration surfaces and keeps secret values out of the directory", async () => {
    renderPage();

    expect(await screen.findByText("MCP 与工具")).toBeInTheDocument();
    expect(screen.getByText("1 个知识源，1 个连接已配置 Secret Ref")).toBeInTheDocument();
    expect(screen.getByText("1/1 个 bridge 在线，状态来自 API 心跳")).toBeInTheDocument();
    expect(screen.queryByText(/secret-value|sk-[a-z0-9]+/i)).not.toBeInTheDocument();
  });

  it("filters the directory without changing source state", async () => {
    renderPage();
    await screen.findByText("Webhook 与触发器");
    const input = screen.getByRole("textbox", { name: "搜索连接" });
    await userEvent.type(input, "Webhook");
    await waitFor(() => expect(screen.queryByText("MCP 与工具")).not.toBeInTheDocument());
    expect(screen.getByText("Webhook 与触发器")).toBeInTheDocument();
  });
});
