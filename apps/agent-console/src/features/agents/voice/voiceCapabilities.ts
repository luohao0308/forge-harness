import { hasDesktopVoiceRuntime } from "./desktopVoiceSpeech";

export type MicrophonePermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

export type VoiceRecognitionAvailability =
  | "ready"
  | "permission-required"
  | "blocked"
  | "unsupported"
  | "unknown";

export type VoiceCapabilitySnapshot = {
  speechRecognitionSupported: boolean;
  microphonePermission: MicrophonePermissionState;
  recognitionAvailability: VoiceRecognitionAvailability;
};

export function detectSpeechRecognitionSupport(scope: Window = window): boolean {
  return hasDesktopVoiceRuntime(scope) || Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition);
}

export function deriveRecognitionAvailability(
  speechRecognitionSupported: boolean,
  microphonePermission: MicrophonePermissionState,
): VoiceRecognitionAvailability {
  if (!speechRecognitionSupported) return "unsupported";
  if (microphonePermission === "denied") return "blocked";
  if (microphonePermission === "prompt") return "permission-required";
  if (microphonePermission === "granted") return "ready";
  if (microphonePermission === "unsupported") return "unsupported";
  return "unknown";
}

export function createVoiceCapabilitySnapshot(
  speechRecognitionSupported: boolean,
  microphonePermission: MicrophonePermissionState,
): VoiceCapabilitySnapshot {
  return {
    speechRecognitionSupported,
    microphonePermission,
    recognitionAvailability: deriveRecognitionAvailability(
      speechRecognitionSupported,
      microphonePermission,
    ),
  };
}
