import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../app/ConsoleShell", () => ({
  ConsoleShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { EnvironmentSettingsPage } from "../EnvironmentSettingsPage";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={["/settings/environment"]}><EnvironmentSettingsPage /></MemoryRouter></QueryClientProvider>);
}

describe("EnvironmentSettingsPage", () => {
  beforeEach(() => {
    window.desktopApi = {
      profile: {
        list: vi.fn(async () => ({
          activeProfileId: "default",
          profiles: [
            {
              id: "default",
              label: "默认 Profile",
              apiBaseUrl: "http://localhost:8000",
              dataPath: "/private/profile",
              createdAt: "2026-08-21T00:00:00Z",
              updatedAt: "2026-08-21T00:00:00Z",
              hasCredential: false,
              credentialStorage: "none" as const,
            },
            {
              id: "review",
              label: "Review Profile",
              apiBaseUrl: "http://localhost:8000",
              dataPath: "/private/review",
              createdAt: "2026-08-21T00:00:00Z",
              updatedAt: "2026-08-21T00:00:00Z",
              hasCredential: true,
              credentialStorage: "persistent" as const,
            },
          ],
        })),
        switch: vi.fn(async (profileId) => ({
          id: profileId,
          label: profileId === "review" ? "Review Profile" : "默认 Profile",
          apiBaseUrl: "http://localhost:8000",
          dataPath: `/private/${profileId}`,
          createdAt: "2026-08-21T00:00:00Z",
          updatedAt: "2026-08-21T00:00:00Z",
          hasCredential: profileId === "review",
          credentialStorage: profileId === "review" ? "persistent" as const : "none" as const,
        })),
      },
      file: {
        getWorkspaceRoot: vi.fn(async () => ({ rootPath: "/private/project", watching: true })),
        selectWorkspaceRoot: vi.fn(async () => ({ rootPath: "/private/next-project", watching: false })),
      },
    };
  });

  afterEach(() => {
    delete window.desktopApi;
  });

  it("shows profile, workspace, and filtered terminal environment state", async () => {
    renderPage();

    expect((await screen.findAllByText("默认 Profile")).length).toBeGreaterThan(0);
    expect(screen.getByText("已授权目录：project")).toBeInTheDocument();
    expect(screen.getByText(/PATH · HOME · LANG/)).toBeInTheDocument();
    expect(screen.getByText(/包含密钥、Token、密码和认证标记的变量会被过滤/)).toBeInTheDocument();
  });

  it("switches profile and selects a new workspace through the trusted bridge", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "切换" }));
    await waitFor(() => expect(window.desktopApi?.profile?.switch).toHaveBeenCalledWith("review"));
    await userEvent.click(screen.getByRole("button", { name: "选择目录" }));
    await waitFor(() => expect(window.desktopApi?.file?.selectWorkspaceRoot).toHaveBeenCalledOnce());
  });
});
