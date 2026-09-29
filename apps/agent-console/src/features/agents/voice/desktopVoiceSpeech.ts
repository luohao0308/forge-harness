import type {
  VoiceLanguage,
  VoiceSpeechAdapter,
  VoiceSpeechAdapterCallbacks,
  VoiceSpeechError,
} from "./voiceSpeech";

const TARGET_SAMPLE_RATE = 16_000;
const MAX_RECORDING_MS = 60_000;
const INTERIM_TRANSCRIPTION_INTERVAL_MS = 1_500;

type DesktopVoiceStatus = {
  state: "not-installed" | "installing" | "ready" | "error" | "unavailable";
  message?: string | null;
};

type DesktopVoiceApi = {
  getStatus?: () => Promise<DesktopVoiceStatus>;
  transcribe?: (input: {
    audio: Uint8Array;
    language: VoiceLanguage;
    durationMs: number;
  }) => Promise<{ text: string }>;
  cancel?: () => Promise<void>;
};

type DesktopSpeechScope = {
  desktopApi?: { voice?: DesktopVoiceApi };
  navigator?: Pick<Navigator, "mediaDevices">;
  AudioContext?: typeof AudioContext;
  setTimeout: typeof window.setTimeout;
  clearTimeout: typeof window.clearTimeout;
};

type RecordingSession = {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  sink: GainNode;
  chunks: Float32Array[];
  sampleRate: number;
  language: VoiceLanguage;
  timeoutId: number;
  interimTimeoutId: number;
  interimInFlight: boolean;
  interimPromise: Promise<void> | null;
  finishing: boolean;
};

export function hasDesktopVoiceRuntime(scope: Window = window): boolean {
  const runtimeScope = scope as Window & { AudioContext?: typeof AudioContext };
  return Boolean(
    scope.desktopApi?.voice?.transcribe
      && scope.navigator.mediaDevices
      && runtimeScope.AudioContext,
  );
}

export function createDesktopSpeechAdapter(
  scope: DesktopSpeechScope,
  callbacks: VoiceSpeechAdapterCallbacks,
): VoiceSpeechAdapter | null {
  const voice = scope.desktopApi?.voice;
  const getUserMedia = scope.navigator?.mediaDevices?.getUserMedia?.bind(scope.navigator.mediaDevices);
  const AudioContextConstructor = scope.AudioContext;
  if (!voice?.transcribe || !getUserMedia || !AudioContextConstructor) return null;

  let active: RecordingSession | null = null;
  let disposed = false;
  let generation = 0;

  const cleanup = async (session: RecordingSession) => {
    scope.clearTimeout(session.timeoutId);
    scope.clearTimeout(session.interimTimeoutId);
    session.processor.onaudioprocess = null;
    session.processor.disconnect();
    session.source.disconnect();
    session.sink.disconnect();
    session.stream.getTracks().forEach((track) => track.stop());
    if (session.context.state !== "closed") await session.context.close();
  };

  const finish = async (session: RecordingSession, language: VoiceLanguage, currentGeneration: number) => {
    if (session.finishing) return;
    session.finishing = true;
    if (active === session) active = null;
    try {
      await cleanup(session);
      await session.interimPromise?.catch(() => undefined);
      if (disposed || currentGeneration !== generation) return;
      const frameCount = session.chunks.reduce((total, chunk) => total + chunk.length, 0);
      const durationMs = Math.round((frameCount / session.sampleRate) * 1000);
      if (durationMs < 150) {
        callbacks.onError(voiceError("no-speech", "没有检测到语音，请重试", true));
        return;
      }
      const audio = encodePcm16Wav(session.chunks, session.sampleRate, TARGET_SAMPLE_RATE);
      const result = await voice.transcribe!({ audio, language, durationMs });
      const transcript = result.text.trim();
      if (!transcript) {
        callbacks.onError(voiceError("no-speech", "没有检测到语音，请重试", true));
        return;
      }
      callbacks.onFinal(transcript);
    } catch (error) {
      if (disposed || currentGeneration !== generation) return;
      callbacks.onError(desktopVoiceError(error));
    } finally {
      if (!disposed && currentGeneration === generation) callbacks.onEnd();
    }
  };

  const scheduleInterim = (session: RecordingSession, currentGeneration: number) => {
    session.interimTimeoutId = scope.setTimeout(async () => {
      const promise = transcribeInterim(session, session.language, currentGeneration);
      session.interimPromise = promise;
      await promise.finally(() => {
        if (session.interimPromise === promise) session.interimPromise = null;
      });
    }, INTERIM_TRANSCRIPTION_INTERVAL_MS);
  };

  const transcribeInterim = async (session: RecordingSession, language: VoiceLanguage, currentGeneration: number) => {
    if (disposed || currentGeneration !== generation || session.finishing || session.interimInFlight) return;
    const frameCount = session.chunks.reduce((total, chunk) => total + chunk.length, 0);
    const durationMs = Math.round((frameCount / session.sampleRate) * 1000);
    if (durationMs < 250) {
      scheduleInterim(session, currentGeneration);
      return;
    }
    session.interimInFlight = true;
    try {
      const audio = encodePcm16Wav(session.chunks, session.sampleRate, TARGET_SAMPLE_RATE);
      const result = await voice.transcribe!({ audio, language, durationMs });
      if (!disposed && currentGeneration === generation && !session.finishing) {
        const transcript = result.text.trim();
        if (transcript) callbacks.onInterim(transcript);
      }
    } catch {
      // Interim recognition is best-effort; the final transcription remains authoritative.
    } finally {
      session.interimInFlight = false;
      if (!disposed && currentGeneration === generation && !session.finishing) {
        scheduleInterim(session, currentGeneration);
      }
    }
  };

  return {
    start(language) {
      if (disposed || active) return;
      const currentGeneration = ++generation;
      void (async () => {
        try {
          const status = await voice.getStatus?.();
          if (status && status.state !== "ready") {
            callbacks.onError(voiceError(
              "unsupported",
              status.state === "installing"
                ? "本地语音模型正在安装"
                : status.message || "请先在语音设置中安装本地模型",
              status.state === "error",
            ));
            callbacks.onEnd();
            return;
          }
          const stream = await getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
          if (disposed || currentGeneration !== generation) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          const context = new AudioContextConstructor({ sampleRate: TARGET_SAMPLE_RATE });
          const source = context.createMediaStreamSource(stream);
          const processor = context.createScriptProcessor(4096, 1, 1);
          const sink = context.createGain();
          sink.gain.value = 0;
          const chunks: Float32Array[] = [];
          processor.onaudioprocess = (event) => {
            chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
          };
          source.connect(processor);
          processor.connect(sink);
          sink.connect(context.destination);
          const session: RecordingSession = {
            stream,
            context,
            source,
            processor,
            sink,
            chunks,
            sampleRate: context.sampleRate,
            language,
            timeoutId: 0,
            interimTimeoutId: 0,
            interimInFlight: false,
            interimPromise: null,
            finishing: false,
          };
          session.timeoutId = scope.setTimeout(
            () => void finish(session, language, currentGeneration),
            MAX_RECORDING_MS,
          );
          active = session;
          scheduleInterim(session, currentGeneration);
          callbacks.onStart();
        } catch (error) {
          if (!disposed && currentGeneration === generation) {
            callbacks.onError(desktopVoiceError(error));
            callbacks.onEnd();
          }
        }
      })();
    },
    stop() {
      if (active) void finish(active, active.language, generation);
    },
    abort() {
      generation += 1;
      const session = active;
      active = null;
      if (session) void cleanup(session);
      void voice.cancel?.();
    },
    dispose() {
      disposed = true;
      generation += 1;
      const session = active;
      active = null;
      if (session) void cleanup(session);
      void voice.cancel?.();
    },
  };
}

export function encodePcm16Wav(
  chunks: Float32Array[],
  inputSampleRate: number,
  outputSampleRate = TARGET_SAMPLE_RATE,
): Uint8Array {
  const inputLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const input = new Float32Array(inputLength);
  let offset = 0;
  for (const chunk of chunks) {
    input.set(chunk, offset);
    offset += chunk.length;
  }
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(0, Math.floor(input.length / ratio));
  const buffer = new ArrayBuffer(44 + outputLength * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + outputLength * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputSampleRate, true);
  view.setUint32(28, outputSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, outputLength * 2, true);
  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = Math.min(input.length - 1, Math.floor(index * ratio));
    const sample = Math.max(-1, Math.min(1, input[sourceIndex] ?? 0));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function desktopVoiceError(error: unknown): VoiceSpeechError {
  const value = error as { code?: string; message?: string; name?: string };
  if (value?.name === "NotAllowedError" || value?.code === "not-allowed") {
    return voiceError("not-allowed", "麦克风权限被拒绝", false);
  }
  if (value?.name === "NotFoundError" || value?.code === "audio-capture") {
    return voiceError("audio-capture", "没有检测到可用的麦克风", false);
  }
  return voiceError("unknown", value?.message || "本地语音转写失败，请重试", true);
}

function voiceError(code: VoiceSpeechError["code"], message: string, retryable: boolean): VoiceSpeechError {
  return { code, message, retryable };
}
