export type VoiceLanguage = "zh-CN" | "en-US" | "auto";

export type VoiceSpeechErrorCode =
  | "not-allowed"
  | "audio-capture"
  | "no-speech"
  | "network"
  | "aborted"
  | "service-not-allowed"
  | "unsupported"
  | "start-failed"
  | "unknown";

export type VoiceSpeechError = {
  code: VoiceSpeechErrorCode;
  message: string;
  retryable: boolean;
};

export type VoiceSpeechAdapterCallbacks = {
  onStart: () => void;
  onInterim: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError: (error: VoiceSpeechError) => void;
  onEnd: () => void;
};

export type VoiceSpeechAdapter = {
  start: (language: VoiceLanguage) => void;
  stop: () => void;
  abort: () => void;
  dispose: () => void;
};

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; [index: number]: RecognitionAlternative };
type RecognitionEvent = Event & {
  resultIndex?: number;
  results: { length: number; [index: number]: RecognitionResult };
};
type RecognitionErrorEvent = Event & { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type SpeechRecognitionScope = {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  navigator?: { language?: string };
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function getSpeechRecognitionConstructor(
  scope: SpeechRecognitionScope,
): SpeechRecognitionConstructor | null {
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function recognitionLocale(
  language: VoiceLanguage,
  browserLanguage = "zh-CN",
): string {
  if (language !== "auto") return language;
  return browserLanguage || "zh-CN";
}

export function mapSpeechRecognitionError(
  rawCode: string,
): VoiceSpeechError {
  const code = normalizeSpeechErrorCode(rawCode);
  const messages: Record<VoiceSpeechErrorCode, string> = {
    "not-allowed": "麦克风权限被拒绝",
    "audio-capture": "没有检测到可用的麦克风",
    "no-speech": "没有检测到语音，请重试",
    network: "语音识别服务暂时不可用",
    aborted: "语音识别已取消",
    "service-not-allowed": "当前运行时不允许使用语音识别服务",
    unsupported: "当前运行时不支持语音识别",
    "start-failed": "无法启动麦克风",
    unknown: "语音识别失败，请重试",
  };
  return {
    code,
    message: messages[code],
    retryable: !["not-allowed", "audio-capture", "unsupported"].includes(code),
  };
}

export function createWebSpeechAdapter(
  scope: SpeechRecognitionScope,
  callbacks: VoiceSpeechAdapterCallbacks,
): VoiceSpeechAdapter | null {
  const Constructor = getSpeechRecognitionConstructor(scope);
  if (!Constructor) return null;

  let recognition: SpeechRecognitionLike | null = null;
  let disposed = false;

  const disposeRecognition = () => {
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition = null;
  };

  return {
    start(language) {
      if (disposed) return;
      disposeRecognition();
      const next = new Constructor();
      next.lang = recognitionLocale(language, scope.navigator?.language);
      next.interimResults = true;
      next.continuous = false;
      next.onstart = callbacks.onStart;
      next.onresult = (event) => {
        const startIndex = event.resultIndex ?? 0;
        const interim: string[] = [];
        const finals: string[] = [];
        for (let index = startIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript ?? "";
          if (result?.isFinal) finals.push(transcript);
          else interim.push(transcript);
        }
        callbacks.onInterim(interim.join("").trim());
        const finalTranscript = finals.join("").trim();
        if (finalTranscript) callbacks.onFinal(finalTranscript);
      };
      next.onerror = (event) => callbacks.onError(mapSpeechRecognitionError(event.error));
      next.onend = () => {
        disposeRecognition();
        callbacks.onEnd();
      };
      recognition = next;
      try {
        next.start();
      } catch {
        disposeRecognition();
        callbacks.onError(mapSpeechRecognitionError("start-failed"));
      }
    },
    stop() {
      recognition?.stop();
    },
    abort() {
      recognition?.abort();
    },
    dispose() {
      disposed = true;
      try {
        recognition?.abort();
      } finally {
        disposeRecognition();
      }
    },
  };
}

function normalizeSpeechErrorCode(rawCode: string): VoiceSpeechErrorCode {
  if (
    rawCode === "not-allowed" ||
    rawCode === "audio-capture" ||
    rawCode === "no-speech" ||
    rawCode === "network" ||
    rawCode === "aborted" ||
    rawCode === "service-not-allowed"
  ) {
    return rawCode;
  }
  if (rawCode === "unsupported" || rawCode === "start-failed") return rawCode;
  return "unknown";
}
