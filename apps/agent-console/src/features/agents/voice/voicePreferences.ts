import { getWorkspacePersistenceStorage } from "../../../lib/workspace-persistence-storage";

import type { VoiceLanguage } from "./voiceSpeech";

export type VoiceInputMode = "click" | "hold";
export type VoiceInsertionMode = "append" | "replace";

export type VoicePreferences = {
  language: VoiceLanguage;
  inputMode: VoiceInputMode;
  insertionMode: VoiceInsertionMode;
};

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  language: "zh-CN",
  inputMode: "click",
  insertionMode: "append",
};

const STORAGE_KEY = "harness.voice.preferences.v1";

export function loadVoicePreferences(): VoicePreferences {
  const storage = getWorkspacePersistenceStorage();
  if (!storage) return DEFAULT_VOICE_PREFERENCES;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<VoicePreferences>;
    return {
      language: isVoiceLanguage(parsed.language) ? parsed.language : DEFAULT_VOICE_PREFERENCES.language,
      inputMode: parsed.inputMode === "hold" ? "hold" : DEFAULT_VOICE_PREFERENCES.inputMode,
      insertionMode: parsed.insertionMode === "replace" ? "replace" : DEFAULT_VOICE_PREFERENCES.insertionMode,
    };
  } catch {
    return DEFAULT_VOICE_PREFERENCES;
  }
}

export function saveVoicePreferences(preferences: VoicePreferences): boolean {
  const storage = getWorkspacePersistenceStorage();
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function applyVoiceTranscript(
  draft: string,
  transcript: string,
  insertionMode: VoiceInsertionMode,
): string {
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) return draft;
  if (insertionMode === "replace") return normalizedTranscript;
  const normalizedDraft = draft.trim();
  return normalizedDraft ? `${normalizedDraft} ${normalizedTranscript}` : normalizedTranscript;
}

function isVoiceLanguage(value: unknown): value is VoiceLanguage {
  return value === "zh-CN" || value === "en-US" || value === "auto";
}
