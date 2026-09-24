import { LoaderCircle, Mic, RotateCcw, Square, X } from "lucide-react";
import { useEffect, useRef, type PointerEvent } from "react";

import { cn } from "../../../lib/utils";

import { useVoiceRecognition } from "../voice/useVoiceRecognition";
import type { VoiceRecognitionPhase } from "../voice/useVoiceRecognition";
import type { VoiceSpeechError } from "../voice/voiceSpeech";
import type { VoiceInputMode } from "../voice/voicePreferences";
import type { VoiceLanguage } from "../voice/voiceSpeech";

export function VoiceInputButton({
  onTranscript,
  className,
  language = "zh-CN",
  inputMode = "click",
  showControls = false,
  onInterimTranscript,
  onPhaseChange,
  onError,
}: {
  onTranscript: (text: string) => void;
  className?: string;
  language?: VoiceLanguage;
  inputMode?: VoiceInputMode;
  showControls?: boolean;
  onInterimTranscript?: (text: string) => void;
  onPhaseChange?: (phase: VoiceRecognitionPhase) => void;
  onError?: (error: VoiceSpeechError | null) => void;
}) {
  const voice = useVoiceRecognition({
    language,
    onFinalTranscript: onTranscript,
  });
  const suppressClickRef = useRef(false);
  const listening = voice.phase === "starting" || voice.phase === "listening";
  const processing = voice.phase === "processing";
  const errorMessage = voice.error?.message ?? null;
  const label = processing
    ? "正在转写语音"
    : listening
    ? "停止语音输入"
      : voice.supported
      ? "开始语音输入"
      : "语音输入不可用";

  useEffect(() => onInterimTranscript?.(voice.interimTranscript), [onInterimTranscript, voice.interimTranscript]);
  useEffect(() => onPhaseChange?.(voice.phase), [onPhaseChange, voice.phase]);
  useEffect(() => onError?.(voice.error), [onError, voice.error]);

  const startOrRetry = () => {
    if (voice.error) voice.retry();
    else voice.start(language);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (inputMode !== "hold" || !voice.supported) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    suppressClickRef.current = true;
    voice.start(language);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (inputMode !== "hold") return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
    voice.stop();
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  };

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={() => {
          if (suppressClickRef.current) return;
          if (listening) voice.stop();
          else startOrRetry();
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => inputMode === "hold" && voice.cancel()}
        aria-label={label}
        aria-pressed={listening}
        disabled={processing}
        title={errorMessage ?? label}
        className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full border border-ui-border bg-ui-surface text-ui-ink transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong disabled:cursor-wait disabled:opacity-60", listening && "border-red-300 bg-red-50 text-red-700", className)}
      >
        {processing ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : listening ? (
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        ) : (
          <Mic className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span className="sr-only">{errorMessage ?? label}</span>
      </button>
      {showControls && listening ? (
        <button type="button" aria-label="取消语音输入" title="取消语音输入" onClick={voice.cancel} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ui-muted hover:bg-ui-subtle hover:text-ui-ink">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
      {showControls && voice.error?.retryable ? (
        <button type="button" aria-label="重试语音输入" title={voice.error.message} onClick={voice.retry} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ui-muted hover:bg-ui-subtle hover:text-ui-ink">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
