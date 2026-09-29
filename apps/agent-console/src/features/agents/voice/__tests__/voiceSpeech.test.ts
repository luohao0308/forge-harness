import { describe, expect, it, vi } from "vitest";

import {
  createWebSpeechAdapter,
  mapSpeechRecognitionError,
  recognitionLocale,
  type SpeechRecognitionConstructor,
} from "../voiceSpeech";

class FakeRecognition {
  lang = "";
  interimResults = false;
  continuous = true;
  onstart: (() => void) | null = null;
  onresult: ((event: never) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());
}

describe("WebSpeechAdapter", () => {
  it("maps auto language to the browser locale and enables interim results", () => {
    const recognition = new FakeRecognition();
    const Constructor = vi.fn(() => recognition) as unknown as SpeechRecognitionConstructor;
    const adapter = createWebSpeechAdapter(
      { SpeechRecognition: Constructor, navigator: { language: "en-GB" } },
      { onStart: vi.fn(), onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() },
    );

    adapter?.start("auto");

    expect(recognition.lang).toBe("en-GB");
    expect(recognition.interimResults).toBe(true);
    expect(recognition.continuous).toBe(false);
    expect(recognition.start).toHaveBeenCalledOnce();
  });

  it("separates interim and final results and releases the recognition on end", () => {
    const recognition = new FakeRecognition();
    const onInterim = vi.fn();
    const onFinal = vi.fn();
    const onEnd = vi.fn();
    const adapter = createWebSpeechAdapter(
      { SpeechRecognition: vi.fn(() => recognition) as unknown as SpeechRecognitionConstructor },
      { onStart: vi.fn(), onInterim, onFinal, onError: vi.fn(), onEnd },
    );

    adapter?.start("zh-CN");
    recognition.onresult?.({
      resultIndex: 0,
      results: [
        { isFinal: false, 0: { transcript: "你好" } },
        { isFinal: true, 0: { transcript: "，Harness" } },
      ],
    } as never);
    expect(onInterim).toHaveBeenCalledWith("你好");
    expect(onFinal).toHaveBeenCalledWith("，Harness");

    adapter?.stop();
    expect(onEnd).toHaveBeenCalledOnce();
    adapter?.stop();
    expect(recognition.stop).toHaveBeenCalledOnce();
  });

  it.each([
    ["not-allowed", "麦克风权限被拒绝", false],
    ["audio-capture", "没有检测到可用的麦克风", false],
    ["no-speech", "没有检测到语音，请重试", true],
    ["network", "语音识别服务暂时不可用", true],
  ])("maps %s into a user-facing retry policy", (code, message, retryable) => {
    expect(mapSpeechRecognitionError(code)).toMatchObject({ code, message, retryable });
  });

  it("uses the explicit locale and falls back to Chinese for auto", () => {
    expect(recognitionLocale("zh-CN", "en-US")).toBe("zh-CN");
    expect(recognitionLocale("auto", "en-US")).toBe("en-US");
    expect(recognitionLocale("auto", "")).toBe("zh-CN");
  });
});
