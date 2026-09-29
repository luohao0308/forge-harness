import { describe, expect, it } from "vitest";

import {
  createVoiceCapabilitySnapshot,
  deriveRecognitionAvailability,
} from "../voiceCapabilities";

describe("voice capability state", () => {
  it.each([
    [false, "granted", "unsupported"],
    [true, "prompt", "permission-required"],
    [true, "denied", "blocked"],
    [true, "granted", "ready"],
    [true, "unknown", "unknown"],
  ] as const)("derives %s + %s as %s", (supported, permission, expected) => {
    expect(deriveRecognitionAvailability(supported, permission)).toBe(expected);
  });

  it("keeps the three independent capability dimensions together", () => {
    expect(createVoiceCapabilitySnapshot(true, "prompt")).toEqual({
      speechRecognitionSupported: true,
      microphonePermission: "prompt",
      recognitionAvailability: "permission-required",
    });
  });
});
