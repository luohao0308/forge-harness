import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../app/ConsoleShell", () => ({
  ConsoleShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { VoiceSettingsPage } from "../VoiceSettingsPage";

type MockTrack = { stop: ReturnType<typeof vi.fn> };
const originalDesktopApi = window.desktopApi;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/voice"]}>
      <VoiceSettingsPage />
    </MemoryRouter>,
  );
}

describe("VoiceSettingsPage", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() } satisfies MockTrack],
        })),
      },
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(async () => ({ state: "prompt", onchange: null })),
      },
    });
  });

  afterEach(() => {
    window.desktopApi = originalDesktopApi;
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "permissions", { configurable: true, value: undefined });
  });

  it("shows runtime support and requests microphone permission through the browser API", async () => {
    window.SpeechRecognition = class {} as unknown as NonNullable<typeof window.SpeechRecognition>;
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    renderPage();

    expect(await screen.findByText("需要权限")).toBeInTheDocument();
    expect(screen.getByText("待请求")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "请求权限" }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    expect(screen.getByText("已授权")).toBeInTheDocument();
    expect(screen.getByText(/原始音频不会保存/)).toBeInTheDocument();
  });

  it("keeps a rejected request visible when the permission query falls back to prompt", async () => {
    const permissionStatus: PermissionStatus = {
      name: "microphone",
      state: "prompt",
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    };
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn(async () => permissionStatus) },
    });
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    getUserMedia.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "请求权限" }));
    await waitFor(() => expect(screen.getByText("已拒绝")).toBeInTheDocument());

    permissionStatus.onchange?.(new Event("change"));
    expect(screen.getByText("已拒绝")).toBeInTheDocument();
    expect(screen.getByText("麦克风权限被拒绝，文本输入仍可正常使用。")).toBeInTheDocument();
  });

  it("shows a safe degraded state when microphone APIs are unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    renderPage();

    expect(await screen.findAllByText("不可用")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "请求权限" })).toBeDisabled();
    expect(screen.getByText(/文本输入保持可用/)).toBeInTheDocument();
  });

  it("keeps the transcription preview local to the settings page", async () => {
    renderPage();

    const preview = screen.getByRole("textbox", { name: "语音转写结果" });
    await userEvent.type(preview, "仅页面内文本");

    expect(preview).toHaveValue("仅页面内文本");
    expect(screen.getByText(/临时 WAV 在完成、失败、取消或超时后清理/)).toBeInTheDocument();
  });

  it("installs an optional Desktop voice model without requiring an app restart", async () => {
    const installDefaultModel = vi.fn(async () => ({
      state: "ready" as const,
      modelId: "whisper-base",
      engineVersion: "b4938",
    }));
    window.desktopApi = {
      ...originalDesktopApi,
      voice: {
        getStatus: vi.fn(async () => ({ state: "not-installed" as const })),
        installDefaultModel,
        importPack: vi.fn(),
        uninstall: vi.fn(),
        transcribe: vi.fn(),
      },
    };
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "在线安装" }));

    await waitFor(() => expect(installDefaultModel).toHaveBeenCalledOnce());
    expect(screen.getByText("可用")).toBeInTheDocument();
    expect(screen.getByText(/无需重启即可使用/)).toBeInTheDocument();
  });

  it("persists language, input gesture, and draft insertion choices", async () => {
    renderPage();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "语言" }), "en-US");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "输入方式" }), "hold");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "草稿处理" }), "replace");

    expect(screen.getByRole("combobox", { name: "语言" })).toHaveValue("en-US");
    expect(screen.getByRole("combobox", { name: "输入方式" })).toHaveValue("hold");
    expect(screen.getByRole("combobox", { name: "草稿处理" })).toHaveValue("replace");
  });
});
