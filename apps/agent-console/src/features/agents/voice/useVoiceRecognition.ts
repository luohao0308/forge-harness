import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createWebSpeechAdapter,
  type VoiceLanguage,
  type VoiceSpeechAdapter,
  type VoiceSpeechAdapterCallbacks,
  type VoiceSpeechError,
} from "./voiceSpeech";
import { createDesktopSpeechAdapter } from "./desktopVoiceSpeech";

export type VoiceRecognitionPhase = "idle" | "starting" | "listening" | "processing" | "error";

export type UseVoiceRecognitionOptions = {
  language?: VoiceLanguage;
  onFinalTranscript?: (transcript: string) => void;
};

export type VoiceRecognitionController = {
  supported: boolean;
  phase: VoiceRecognitionPhase;
  language: VoiceLanguage;
  interimTranscript: string;
  error: VoiceSpeechError | null;
  start: (language?: VoiceLanguage) => void;
  stop: () => void;
  cancel: () => void;
  retry: () => void;
  setLanguage: (language: VoiceLanguage) => void;
};

export function useVoiceRecognition({
  language: initialLanguage = "zh-CN",
  onFinalTranscript,
}: UseVoiceRecognitionOptions = {}): VoiceRecognitionController {
  const adapterRef = useRef<VoiceSpeechAdapter | null>(null);
  const lastLanguageRef = useRef<VoiceLanguage>(initialLanguage);
  const onFinalRef = useRef(onFinalTranscript);
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<VoiceRecognitionPhase>("idle");
  const [language, setLanguage] = useState<VoiceLanguage>(initialLanguage);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<VoiceSpeechError | null>(null);

  onFinalRef.current = onFinalTranscript;

  useEffect(() => {
    const scope = window;
    const callbacks: VoiceSpeechAdapterCallbacks = {
      onStart: () => setPhase("listening"),
      onInterim: setInterimTranscript,
      onFinal: (transcript) => {
        setInterimTranscript("");
        setPhase("processing");
        onFinalRef.current?.(transcript);
      },
      onError: (nextError) => {
        setError(nextError);
        setInterimTranscript("");
        setPhase("error");
      },
      onEnd: () => {
        setInterimTranscript("");
        setPhase((current) => (current === "error" ? current : "idle"));
      },
    };
    const adapter = createDesktopSpeechAdapter(scope, callbacks)
      ?? createWebSpeechAdapter(scope, callbacks);
    setSupported(adapter !== null);
    adapterRef.current = adapter;
    return () => {
      adapter?.dispose();
      adapterRef.current = null;
    };
  }, []);

  const start = useCallback((nextLanguage = language) => {
    if (!adapterRef.current) {
      setError({
        code: "unsupported",
        message: "当前运行时不支持语音识别",
        retryable: false,
      });
      setPhase("error");
      return;
    }
    lastLanguageRef.current = nextLanguage;
    setLanguage(nextLanguage);
    setError(null);
    setInterimTranscript("");
    setPhase("starting");
    adapterRef.current.start(nextLanguage);
  }, [language]);

  const stop = useCallback(() => {
    if (phase === "listening" || phase === "starting") {
      setPhase("processing");
      adapterRef.current?.stop();
    }
  }, [phase]);

  const cancel = useCallback(() => {
    adapterRef.current?.abort();
    setInterimTranscript("");
    setError(null);
    setPhase("idle");
  }, []);

  const retry = useCallback(() => {
    start(lastLanguageRef.current);
  }, [start]);

  return useMemo(
    () => ({
      supported,
      phase,
      language,
      interimTranscript,
      error,
      start,
      stop,
      cancel,
      retry,
      setLanguage: (nextLanguage: VoiceLanguage) => {
        lastLanguageRef.current = nextLanguage;
        setLanguage(nextLanguage);
      },
    }),
    [cancel, error, interimTranscript, language, phase, retry, start, stop, supported],
  );
}
