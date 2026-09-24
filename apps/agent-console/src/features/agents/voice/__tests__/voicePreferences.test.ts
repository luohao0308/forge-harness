import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_VOICE_PREFERENCES,
  applyVoiceTranscript,
  loadVoicePreferences,
  saveVoicePreferences,
} from "../voicePreferences";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("voice preferences", () => {
  it("uses safe defaults when storage is empty or malformed", () => {
    expect(loadVoicePreferences()).toEqual(DEFAULT_VOICE_PREFERENCES);
    storage.set("harness.voice.preferences.v1", "not-json");
    expect(loadVoicePreferences()).toEqual(DEFAULT_VOICE_PREFERENCES);
  });

  it("persists only language and interaction choices, never transcript data", () => {
    expect(saveVoicePreferences({ language: "en-US", inputMode: "hold", insertionMode: "replace" })).toBe(true);
    expect(loadVoicePreferences()).toEqual({ language: "en-US", inputMode: "hold", insertionMode: "replace" });
    expect(storage.get("harness.voice.preferences.v1")).not.toContain("transcript");
  });

  it("applies append and replace semantics without persisting audio", () => {
    expect(applyVoiceTranscript(" 已有内容 ", " 新内容 ", "append")).toBe("已有内容 新内容");
    expect(applyVoiceTranscript("已有内容", " 新内容 ", "replace")).toBe("新内容");
    expect(applyVoiceTranscript("已有内容", "   ", "append")).toBe("已有内容");
  });
});
