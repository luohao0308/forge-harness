import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VoiceInputButton } from "../VoiceInputButton";

type MockResult = {
  isFinal: boolean;
  0: { transcript: string };
};

class MockSpeechRecognition {
  lang = "";
  interimResults = true;
  continuous = true;
  onstart: (() => void) | null = null;
  onresult: ((event: Event & { results: { length: number; [index: number]: MockResult } }) => void) | null = null;
  onerror: ((event: Event & { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());

  constructor() {
    latestRecognition = this;
  }
}

let latestRecognition: MockSpeechRecognition | null = null;

function installSpeechRecognition() {
  window.SpeechRecognition = MockSpeechRecognition as unknown as NonNullable<typeof window.SpeechRecognition>;
}

afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  latestRecognition = null;
});

describe("VoiceInputButton", () => {
  it("reports that voice input is unavailable when the runtime has no speech API", async () => {
    render(<VoiceInputButton onTranscript={vi.fn()} />);

    const button = await screen.findByRole("button", { name: "语音输入不可用" });
    expect(button).toHaveAttribute("title", "语音输入不可用");
  });

  it("starts Chinese recognition and emits final transcripts", async () => {
    installSpeechRecognition();
    const onTranscript = vi.fn();
    render(<VoiceInputButton onTranscript={onTranscript} />);

    await userClick("开始语音输入");
    expect(screen.getByRole("button", { name: "停止语音输入" }).querySelector(".lucide-square")).not.toBeNull();
    expect(latestRecognition).not.toBeNull();
    expect(latestRecognition?.lang).toBe("zh-CN");
    expect(latestRecognition?.start).toHaveBeenCalledOnce();

    act(() => {
      latestRecognition?.onresult?.({
        results: [{ isFinal: true, 0: { transcript: " 你好，Harness " } }] as unknown as {
          length: number;
          [index: number]: MockResult;
        },
      } as unknown as Event & { results: { length: number; [index: number]: MockResult } });
    });

    expect(onTranscript).toHaveBeenCalledWith("你好，Harness");
  });

  it("returns to idle and exposes a permission error after the browser rejects the microphone", async () => {
    installSpeechRecognition();
    render(<VoiceInputButton onTranscript={vi.fn()} />);

    await userClick("开始语音输入");
    act(() => {
      latestRecognition?.onerror?.({ error: "not-allowed" } as unknown as Event & { error: string });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "开始语音输入" })).toHaveAttribute("title", "麦克风权限被拒绝");
    });
  });

  it("supports hold-to-talk and forwards interim transcript updates", async () => {
    installSpeechRecognition();
    const onInterimTranscript = vi.fn();
    render(<VoiceInputButton onTranscript={vi.fn()} inputMode="hold" onInterimTranscript={onInterimTranscript} />);

    const button = await screen.findByRole("button", { name: "开始语音输入" });
    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(latestRecognition?.start).toHaveBeenCalledOnce();
    act(() => {
      latestRecognition?.onresult?.({
        results: [{ isFinal: false, 0: { transcript: "正在说" } }],
      } as unknown as Event & { results: { length: number; [index: number]: MockResult } });
    });
    expect(onInterimTranscript).toHaveBeenLastCalledWith("正在说");
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(latestRecognition?.stop).toHaveBeenCalledOnce();
  });
});

async function userClick(name: string) {
  fireEvent.click(await screen.findByRole("button", { name }));
}
