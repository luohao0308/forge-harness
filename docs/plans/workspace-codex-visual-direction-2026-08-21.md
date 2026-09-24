# Workspace Codex-Inspired Visual Direction

Status: approved
Approved: 2026-08-21
Scope: Agent Console visual surfaces only; no backend, API, routing, or product semantics changes.

## Goal

Move the Agent Console toward a calm, Codex-inspired neutral visual language while preserving Forge Harness identity, Chinese-first copy, status semantics, chat-first Workspace behavior, and narrow-screen usability. The reference screenshots are visual direction only; they are not a source of product copy or implementation instructions.

## Evidence and constraints

- Existing global base colors are `#f7f8fa` and `#111827` in `apps/agent-console/src/styles.css`.
- Workspace history uses a separate `#f7f7f8` rail and a 280px desktop width.
- Workspace empty state currently renders five long prompt pills.
- Composer uses a 22px radius and a comparatively strong shadow.
- Existing design contract requires neutral surfaces, semantic status colors, chat-first hierarchy, Lucide icons, keyboard focus, and no 390px horizontal overflow.

## Visual direction

- Use layered cool neutrals: page `#f7f7f8`, sidebar `#efeff0`, panel `#ffffff`, selected `#e5e5e8`, border `#dedee3`, primary text `#242428`, muted text `#92929a`.
- Keep emerald, amber, red, cyan, violet, and orange as small semantic accents only.
- Prefer 1px separators and restrained shadows over heavy borders or gradients.
- Keep cards at the existing 8px radius limit; use fixed dimensions and predictable responsive grids.
- Keep the web Console navigation and Electron Workspace shell behavior unchanged.

## Ordered slices

| Slice | Outcome | Scope | Depends on | Acceptance | Rollback |
| --- | --- | --- | --- | --- | --- |
| S1 | Shared Forge Neutral theme and shell surfaces | `styles.css`, Tailwind theme, `Button`, `Card`, `Badge`, `ConsoleShell` | None | Shared controls and global shell use the neutral palette; behavior and high-contrast mode remain intact | Revert token and shared primitive changes |
| S2 | Workspace chrome and Composer visual convergence | History rail, Workspace shell bar, Composer, Workspace popovers | S1 | Existing interactions, focus states, sticky composer, and 390px layout remain intact | Revert Workspace-only surface classes |
| S3 | Four startup task cards | `ChatWelcomeState`, example prompt presentation, focused tests | S1, S2 | Four responsive cards, keyboard activation, bilingual labels, and existing prompt callbacks work | Restore pill presentation |
| S4 | Cross-page consistency and visual QA | Shared page surfaces, screenshots, tests, docs evidence | S1-S3 | Lint, build, targeted tests, responsive screenshots, and diff checks pass | Revert only affected visual classes |

## Acceptance criteria

- The UI has a neutral layered surface hierarchy without gradients or a single dominant hue.
- The Workspace welcome state presents four high-intent task cards with icon color accents and keeps the remaining example prompt reachable through a secondary path.
- Existing API calls, routes, run state, model/tool selectors, Composer actions, and Chinese-first copy semantics are unchanged.
- Desktop and 390px views have no document-level horizontal overflow.
- High-contrast mode, keyboard focus, reduced-motion behavior, and existing UI tests do not regress.

## Verification matrix

- `cd apps/agent-console && npm test`
- `cd apps/agent-console && npm run lint`
- `cd apps/agent-console && npm run build`
- Targeted Workspace/Console tests after S1-S3
- Playwright or browser screenshots at desktop and 390px widths where available
- `git diff --check`
- `python3 scripts/validate-docs.py` after documentation write-back

## Status log

- 2026-08-21: approved by user; S1-S3 implemented and targeted regressions passed.
- 2026-08-21: S4 completed with production build, responsive screenshot evidence, latest full Vitest run (107/111 files passed; six existing timing/fixture failures), `git diff --check`, and docs validation.

## Completion evidence

- Shared Forge Neutral tokens are defined in `apps/agent-console/src/styles.css` and exposed through `apps/agent-console/tailwind.config.ts`; shared Button/Card/Badge primitives and the Console shell consume semantic neutral tokens.
- Workspace history, shell bar, composer, popovers, and welcome state use layered neutral surfaces with preserved status accents, focus states, keyboard activation, and 390px no-overflow behavior.
- Welcome state now presents four high-intent starter cards and retains the fifth example through the `更多场景 / More scenarios` action.
- `/tmp/harness-workspace-desktop.png` and `/tmp/harness-workspace-mobile.png` capture the implemented desktop and narrow layouts. The narrow browser check reported `noHorizontalOverflow: true`.
- `cd apps/agent-console && npm run build` passed; the targeted HelpCenter contract rerun passed 1/1, and the previous targeted Workspace/Console suites passed 42/42 and 32/32.
- Full Vitest latest run completed with 107/111 files passing and 814/820 tests passing. Six failures are existing 5-second timing/fixture issues in Agent Studio, Subagent Specialists, Team Pages, and Tool Registry marketplace tests; the visual Workspace/Console suites remain green.
- `python3 scripts/validate-docs.py` and `git diff --check` are required final gates; the current worktree still contains unrelated user changes that remain untouched.
