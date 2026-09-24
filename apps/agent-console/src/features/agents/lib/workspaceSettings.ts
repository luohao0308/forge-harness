export const REASONING_EFFORTS = ["light", "medium", "high", "xhigh", "max"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const PERMISSION_MODES = ["confirm", "auto-edit", "full-auto"] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "high";
export const DEFAULT_PERMISSION_MODE: PermissionMode = "confirm";

export function normalizeReasoningEffort(value: unknown): ReasoningEffort {
  return typeof value === "string" && REASONING_EFFORTS.includes(value as ReasoningEffort)
    ? (value as ReasoningEffort)
    : DEFAULT_REASONING_EFFORT;
}

export function normalizePermissionMode(value: unknown): PermissionMode {
  return typeof value === "string" && PERMISSION_MODES.includes(value as PermissionMode)
    ? (value as PermissionMode)
    : DEFAULT_PERMISSION_MODE;
}
