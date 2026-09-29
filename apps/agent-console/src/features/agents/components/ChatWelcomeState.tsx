/**
 * ChatWelcomeState — the empty-state onboarding card shown when
 * `Active_Path` has zero conversation nodes.
 *
 * Satisfies:
 *   - Req 8.1–8.3: shows the agent name, model label, a ≤3-line intro, and
 *     four high-intent starter cards sourced from {@link EXAMPLE_PROMPTS}.
 *   - Req 9.1: all copy flows through `useI18n().text(zh, en)`.
 *   - Req 9.3: prompt tiles are real `<button>` elements with focus-visible
 *     rings so keyboard navigation lands on them.
 *
 * Pure presentational component: stateless, no store access, no hooks beyond
 * `useI18n`. Clicking a prompt invokes the parent-supplied callback which is
 * responsible for filling the composer draft and focusing the textarea.
 */

import type { JSX } from "react";
import { Bug, Search, ShieldCheck, Wrench } from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/utils";
import { EXAMPLE_PROMPTS } from "../lib/examplePrompts";

export type ChatWelcomeStateProps = {
  /** Human-readable agent name (falls back to agentId in the parent). */
  agentName: string;
  /** Human-readable model label (e.g. "openai / gpt-4o-mini"). */
  modelLabel: string;
  /** Invoked when the user picks an example prompt. */
  onPickPrompt: (prompt: string) => void;
};

export function ChatWelcomeState({
  agentName,
  modelLabel,
  onPickPrompt,
}: ChatWelcomeStateProps): JSX.Element {
  const { text } = useI18n();
  const headline = text("我们先从哪里开始呢？", "Where should we start?");
  const starterPrompts = EXAMPLE_PROMPTS.slice(0, 4);
  const additionalPrompt = EXAMPLE_PROMPTS[4];
  const icons = [Search, Wrench, ShieldCheck, Bug] as const;
  const iconStyles = [
    "bg-sky-50 text-sky-600",
    "bg-violet-50 text-violet-600",
    "bg-emerald-50 text-emerald-600",
    "bg-orange-50 text-orange-600",
  ] as const;
  const starterTitles = [
    text("探索并理解代码", "Explore and understand code"),
    text("构建新功能、应用或工具", "Build a feature, app, or tool"),
    text("审查代码并提出修改建议", "Review code and suggest improvements"),
    text("修复问题和失败", "Fix problems and failures"),
  ] as const;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 text-center">
      <header className="flex max-w-2xl flex-col items-center">
        <p className="mb-3 text-xs font-medium text-ui-faint">
          {agentName} · {modelLabel}
        </p>
        <h2 className="text-2xl font-semibold tracking-normal text-ui-ink sm:text-3xl">
          {headline}
        </h2>
      </header>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {starterPrompts.map((prompt, index) => {
          const Icon = icons[index] ?? Search;
          const label = text(prompt.zh, prompt.en);
          return (
            <button
              key={prompt.id}
              type="button"
              onClick={() => onPickPrompt(label)}
              aria-label={label}
              title={label}
              className={cn(
                "group flex min-h-[136px] flex-col justify-between rounded-lg border border-ui-border bg-ui-surface p-4 text-left",
                "shadow-[0_1px_2px_rgba(36,36,40,0.04)] transition-[background-color,border-color,box-shadow]",
                "hover:border-ui-border-strong hover:bg-ui-subtle/40 hover:shadow-[0_6px_16px_rgba(36,36,40,0.07)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong focus-visible:ring-offset-2",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-transform group-hover:-translate-y-px",
                  iconStyles[index] ?? iconStyles[0],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="mt-6 min-h-10 text-base font-semibold leading-5 text-ui-ink">
                {starterTitles[index]}
              </span>
            </button>
          );
        })}
      </div>
      {additionalPrompt ? (
        <button
          type="button"
          onClick={() => onPickPrompt(text(additionalPrompt.zh, additionalPrompt.en))}
          aria-label={text(additionalPrompt.zh, additionalPrompt.en)}
          className="text-xs font-medium text-ui-muted underline decoration-ui-border-strong underline-offset-4 transition-colors hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong focus-visible:ring-offset-2"
        >
          {text("更多场景", "More scenarios")}
        </button>
      ) : null}
    </section>
  );
}
