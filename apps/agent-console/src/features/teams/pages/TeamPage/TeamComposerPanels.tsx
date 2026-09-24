import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import {
  Brain,
  Check,
  ChevronRight,
  Hand,
  ListChecks,
  Paperclip,
  PlugZap,
  ShieldCheck,
  Target,
  X,
  Zap,
} from "lucide-react";

import { ContextMaxTokensSlider } from "../../../agents/components/ContextMaxTokensSlider";
import type { UsageSummary } from "../../../agents/components/InspectorDrawer";
import { modelOptionDisplay, type ModelOption } from "../../../agents/components/ModelPicker";
import type { WorkspaceMode } from "../../../agents/lib/types";
import {
  REASONING_EFFORTS,
  type PermissionMode,
  type ReasoningEffort,
} from "../../../agents/lib/workspaceSettings";
import { useI18n } from "../../../../lib/i18n";
import { cn } from "../../../../lib/utils";
import type { ToolMetadata } from "../../../tasks/api";

import { formatDuration, formatMcpCapability, formatMetricNumber, isMcpTool } from "./conversation";
import type { TextFn } from "./types";

export function TeamBottomPopover({
  open,
  onClose,
  align,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  align: "left" | "right";
  title: string;
  children: JSX.Element;
}) {
  const { text } = useI18n();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const isInsideAnyTeamPopover = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      const element = target instanceof Element ? target : target.parentElement;
      return Boolean(element?.closest("[data-team-bottom-popover]"));
    };
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const element = popoverRef.current;
      const target = event.target;
      if (target instanceof Node && element?.contains(target)) return;
      if (isInsideAnyTeamPopover(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      data-team-bottom-popover
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className={cn(
        "absolute bottom-[58px] z-30 w-[min(280px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-none",
        align === "right" ? "right-4" : "left-4",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 px-1 pb-2">
        <div className="text-xs font-semibold text-slate-900">{title}</div>
        <button
          type="button"
          aria-label={text("关闭弹层", "Close panel")}
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

export function TeamComposerSettingsPanel({
  workspaceMode,
  onWorkspaceModeChange,
  attachmentNames,
  onAddFiles,
  tools,
  onInsertMention,
  text,
  contextMaxTokens,
  onContextMaxTokensChange,
  autoCompressionRatio,
  onAutoCompressionRatioChange,
  pluginsInitiallyOpen,
}: {
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  attachmentNames: string[];
  onAddFiles: () => void;
  tools: ToolMetadata[];
  onInsertMention: (toolName: string) => void;
  text: TextFn;
  contextMaxTokens: number;
  onContextMaxTokensChange: (value: number) => void;
  autoCompressionRatio: number;
  onAutoCompressionRatioChange: (value: number) => void;
  pluginsInitiallyOpen?: boolean;
}) {
  const [pluginsOpen, setPluginsOpen] = useState(pluginsInitiallyOpen ?? false);
  const mcpTools = tools.filter(isMcpTool);

  useEffect(() => {
    if (pluginsInitiallyOpen) setPluginsOpen(true);
  }, [pluginsInitiallyOpen]);

  return (
    <div className="flex flex-col text-xs text-slate-800">
      <div className="border-b border-slate-100 px-2 py-1.5">
        <ContextMaxTokensSlider value={contextMaxTokens} onChange={onContextMaxTokensChange} />
        <TeamAutoCompressionControl
          value={autoCompressionRatio}
          onChange={onAutoCompressionRatioChange}
          text={text}
        />
      </div>
      <TeamToolActionRow
        icon={<Paperclip aria-hidden="true" className="h-3.5 w-3.5" />}
        label={
          attachmentNames.length > 0
            ? text(
                `添加照片和文件 (${attachmentNames.length})`,
                `Add photos and files (${attachmentNames.length})`,
              )
            : text("添加照片和文件", "Add photos and files")
        }
        onClick={onAddFiles}
      />
      <TeamToolToggleRow
        icon={<ListChecks aria-hidden="true" className="h-3.5 w-3.5" />}
        label={text("计划模式", "Plan mode")}
        checked={workspaceMode === "markdown_plan"}
        onChange={(checked) => onWorkspaceModeChange(checked ? "markdown_plan" : "chat")}
      />
      <TeamToolToggleRow
        icon={<Target aria-hidden="true" className="h-3.5 w-3.5" />}
        label={text("追踪目标模式", "Goal pursuit mode")}
        checked={workspaceMode === "goal"}
        onChange={(checked) => onWorkspaceModeChange(checked ? "goal" : "chat")}
      />
      <TeamToolActionRow
        icon={<PlugZap aria-hidden="true" className="h-3.5 w-3.5" />}
        label={text("插件 / MCP", "Plugins / MCP")}
        trailing={
          <ChevronRight
            aria-hidden="true"
            className={cn("h-4 w-4 text-slate-400 transition-transform", pluginsOpen ? "rotate-90" : "")}
          />
        }
        onClick={() => setPluginsOpen((open) => !open)}
      />
      {pluginsOpen ? (
        <div className="ml-4 mt-0.5 max-h-24 min-w-0 overflow-y-auto border-l border-slate-200 pl-1.5 pr-0.5">
          {mcpTools.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-500">
              {text("暂无外部协议功能。", "No MCP capabilities")}
            </p>
          ) : (
            mcpTools.map((tool) => (
              <button
                key={`${tool.source ?? "tool"}:${tool.name}`}
                type="button"
                onClick={() => onInsertMention(tool.name)}
                className="block min-w-0 w-full rounded-md px-1.5 py-1 text-left text-[11px] text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <span className="block truncate font-mono">@{tool.name}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  {formatMcpCapability(tool)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TeamAutoCompressionControl({
  value,
  onChange,
  text,
}: {
  value: number;
  onChange: (next: number) => void;
  text: TextFn;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-slate-700">
          {text("自动压缩阈值", "Auto compression threshold")}
        </label>
        <span className="font-mono text-[11px] text-slate-600">{pct}%</span>
      </div>
      <input
        type="range"
        min={0.5}
        max={0.95}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={text("自动压缩阈值", "Auto compression threshold")}
        className="h-1 accent-slate-900"
      />
    </div>
  );
}

export function TeamModelPanel({
  providers,
  selectedProviderId,
  selectedModelId,
  modelLabelFallback,
  onModelChange,
  reasoningEffort,
  onReasoningEffortChange,
  text,
}: {
  providers: ModelOption[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
  modelLabelFallback: string;
  onModelChange: (providerId: string, modelId: string) => void;
  reasoningEffort: ReasoningEffort;
  onReasoningEffortChange: (value: ReasoningEffort) => void;
  text: TextFn;
}) {
  return (
    <div className="flex flex-col gap-3">
      {providers.length > 0 ? (
        <div
          role="listbox"
          aria-label={text("切换模型", "Switch model")}
          className="flex max-h-48 flex-col gap-1 overflow-y-auto"
        >
          {providers.map((option) => {
            const selected =
              option.providerId === selectedProviderId && option.modelId === selectedModelId;
            return (
              <button
                key={`${option.providerId}:${option.modelId}`}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onModelChange(option.providerId, option.modelId)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                  selected
                    ? "bg-slate-900 font-medium text-white"
                    : "text-slate-700 hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    selected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600",
                  )}
                >
                  <Brain className="h-4 w-4" />
                </span>
                <TeamModelOptionText option={option} selected={selected} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-1.5 text-xs text-amber-800">
          {text("模型设置不可用", "Model settings unavailable")} · {modelLabelFallback}
        </div>
      )}
      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-900">
            {text("推理强度", "Reasoning effort")}
          </label>
          <span className="text-xs font-semibold text-slate-500">
            {teamReasoningEffortLabel(reasoningEffort, text)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={REASONING_EFFORTS.length - 1}
          step={1}
          value={REASONING_EFFORTS.indexOf(reasoningEffort)}
          onChange={(event) =>
            onReasoningEffortChange(REASONING_EFFORTS[Number(event.target.value)] ?? "high")
          }
          aria-label={text("推理强度", "Reasoning effort")}
          className="mt-2 h-1.5 w-full accent-slate-900"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          {REASONING_EFFORTS.map((effort) => (
            <span key={effort}>{teamReasoningEffortLabel(effort, text)}</span>
          ))}
        </div>
        {providers.find(
          (option) => option.providerId === selectedProviderId && option.modelId === selectedModelId,
        )?.supportsReasoningEffort !== true ? (
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            {text(
              "当前模型未声明推理强度能力；选择会保存，但不会伪造 provider 效果。",
              "This model has not declared reasoning-effort support. The selection is saved, but no provider behavior is faked.",
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function TeamPermissionModePanel({
  value,
  onChange,
  text,
}: {
  value: PermissionMode;
  onChange: (value: PermissionMode) => void;
  text: TextFn;
}) {
  const options: Array<{
    value: PermissionMode;
    label: string;
    description: string;
    icon: JSX.Element;
  }> = [
    {
      value: "confirm",
      label: text("请求批准", "Request approval"),
      description: text("编辑外部文件和联网操作时询问。", "Ask before external edits and network actions."),
      icon: <Hand aria-hidden="true" className="h-4 w-4" />,
    },
    {
      value: "auto-edit",
      label: text("编辑自动批准", "Auto-approve edits"),
      description: text("低风险工作区编辑自动继续，高风险操作仍需审批。", "Low-risk workspace edits continue; high-risk actions still ask."),
      icon: <ShieldCheck aria-hidden="true" className="h-4 w-4" />,
    },
    {
      value: "full-auto",
      label: text("完全自动", "Full auto"),
      description: text("仍受服务端策略、沙箱和审批审计约束。", "Still constrained by server policy, sandbox, and approval audit."),
      icon: <Zap aria-hidden="true" className="h-4 w-4" />,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-slate-900">{text("访问权限", "Access permissions")}</div>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
              selected
                ? option.value === "full-auto"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-300 bg-slate-50 text-slate-900"
                : "border-slate-200 text-slate-700 hover:bg-slate-50",
            )}
          >
            <span className="mt-0.5 shrink-0">{option.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span>{option.label}</span>
                {selected ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function teamReasoningEffortLabel(
  value: ReasoningEffort,
  text: TextFn,
): string {
  const labels: Record<ReasoningEffort, [string, string]> = {
    light: ["轻度", "Light"],
    medium: ["中", "Medium"],
    high: ["高", "High"],
    xhigh: ["极高", "Very high"],
    max: ["最高", "Max"],
  };
  return text(...labels[value]);
}

export function teamPermissionModeLabel(
  value: PermissionMode,
  text: TextFn,
): string {
  const labels: Record<PermissionMode, [string, string]> = {
    confirm: ["请求批准", "Request approval"],
    "auto-edit": ["编辑自动批准", "Auto-approve edits"],
    "full-auto": ["完全自动", "Full auto"],
  };
  return text(...labels[value]);
}

export function TeamModelOptionText({
  option,
  selected,
}: {
  option: ModelOption;
  selected: boolean;
}) {
  const display = modelOptionDisplay(option);

  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold">{display.title}</span>
      <span className={cn("block truncate text-[11px] leading-4", selected ? "text-slate-300" : "text-slate-500")}>
        {display.subtitle}
      </span>
    </span>
  );
}

export function TeamToolToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: JSX.Element;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex h-7 items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-slate-50">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-8 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          checked ? "bg-slate-900" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[14px]" : "translate-x-[2px]",
          )}
        />
      </button>
    </div>
  );
}

export function TeamToolActionRow({
  icon,
  label,
  trailing = null,
  onClick,
}: {
  icon: JSX.Element;
  label: ReactNode;
  trailing?: JSX.Element | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate leading-4">{label}</span>
      {trailing ? (
        <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center text-slate-400">
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

export function TeamComposerMetadataRow({ usage, text }: { usage: UsageSummary; text: TextFn }) {
  const items = [
    [text("输入", "In"), formatMetricNumber(usage.inputTokens)],
    [text("输出", "Out"), formatMetricNumber(usage.outputTokens)],
    [text("花费", "Cost"), usage.costUsd],
    [text("耗时", "Time"), formatDuration(usage.durationMs)],
    [text("模型", "Models"), formatMetricNumber(usage.modelCalls)],
    [text("工具", "Tools"), formatMetricNumber(usage.toolCalls)],
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4 text-slate-500"
      aria-label={text("运行元数据", "Run metadata")}
    >
      {items.map(([label, value]) => (
        <span key={label} className="inline-flex min-w-0 items-baseline gap-1">
          <span>{label}</span>
          <span className="font-mono text-slate-700">{value}</span>
        </span>
      ))}
    </div>
  );
}
