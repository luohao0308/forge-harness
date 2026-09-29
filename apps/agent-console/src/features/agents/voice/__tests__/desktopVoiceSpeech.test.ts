import { describe, expect, it, vi } from "vitest";

import { createDesktopSpeechAdapter, encodePcm16Wav } from "../desktopVoiceSpeech";

describe("desktop voice WAV encoding", () => {
  it("encodes mono 16-bit PCM with a stable 16 kHz header", () => {
    const wav = encodePcm16Wav([new Float32Array([0, 1, -1, 0.5])], 16_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
  });

  it("downsamples higher-rate input before writing the payload", () => {
    const wav = encodePcm16Wav([new Float32Array(48_000).fill(0.25)], 48_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(view.getUint32(40, true)).toBe(16_000 * 2);
    expect(wav.byteLength).toBe(44 + 16_000 * 2);
  });

  it("records through Web Audio and sends bounded WAV bytes to Desktop IPC", async () => {
    const stopTrack = vi.fn();
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const sink = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const processor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null as ((event: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null,
    };
    const close = vi.fn(async () => undefined);
    const context = {
      sampleRate: 16_000,
      state: "running",
      destination: {},
      createMediaStreamSource: vi.fn(() => source),
      createScriptProcessor: vi.fn(() => processor),
      createGain: vi.fn(() => sink),
      close,
    };
    const transcribe = vi.fn(async (_input: {
      audio: Uint8Array;
      language: "zh-CN" | "en-US" | "auto";
      durationMs: number;
    }) => ({ text: "你好 Harness" }));
    const onFinal = vi.fn();
    const onEnd = vi.fn();
    const adapter = createDesktopSpeechAdapter({
      desktopApi: { voice: { getStatus: vi.fn(async () => ({ state: "ready" as const })), transcribe } },
      navigator: {
        mediaDevices: {
          getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream)),
          enumerateDevices: vi.fn(),
          getSupportedConstraints: vi.fn(),
          getDisplayMedia: vi.fn(),
          ondevicechange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        },
      },
      AudioContext: vi.fn(() => context) as unknown as typeof AudioContext,
      setTimeout: globalThis.setTimeout as unknown as typeof window.setTimeout,
      clearTimeout: globalThis.clearTimeout as unknown as typeof window.clearTimeout,
    }, {
      onStart: vi.fn(),
      onInterim: vi.fn(),
      onFinal,
      onError: vi.fn(),
      onEnd,
    });

    adapter?.start("zh-CN");
    await vi.waitFor(() => expect(processor.onaudioprocess).not.toBeNull());
    processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(3_200).fill(0.2) } });
    adapter?.stop();

    await vi.waitFor(() => expect(transcribe).toHaveBeenCalledOnce());
    const input = transcribe.mock.calls[0]?.[0];
    expect(input?.language).toBe("zh-CN");
    expect(new TextDecoder().decode(input?.audio.slice(0, 4))).toBe("RIFF");
    expect(onFinal).toHaveBeenCalledWith("你好 Harness");
    expect(onEnd).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
