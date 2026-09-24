import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../app/ConsoleShell", () => ({
  ConsoleShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { SettingsHubPage } from "../SettingsHubPage";

describe("SettingsHubPage", () => {
  it("groups existing settings and keeps planned capabilities free of fake links", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsHubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "个人" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "集成" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "编码" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "数据与账户" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /模型/ })).toHaveAttribute("href", "/settings/models");
    expect(screen.getByRole("link", { name: /浏览器与链接/ })).toHaveAttribute("href", "/settings/integrations");
    expect(screen.getByRole("link", { name: /知识连接/ })).toHaveAttribute("href", "/settings/integrations");
    expect(screen.getByRole("link", { name: /Worktrees/ })).toHaveAttribute("href", "/settings/worktrees");
    expect(screen.getByText("Worktrees")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /语音/ })).toHaveAttribute("href", "/settings/voice");
    expect(screen.getByText("外观").closest("div[aria-disabled='true']")).not.toBeNull();
  });
});
