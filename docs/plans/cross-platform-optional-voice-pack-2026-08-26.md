# 跨平台可选语音组件实施计划

_状态：completed | 用户确认：2026-08-26 | 任务：VOICE-P2-001 | 当前切片：S4 completed_

## 目标结果

Forge Harness Desktop 在 macOS、Windows 和 Linux 共用一套本地语音转写契约。基础安装包保留录音、组件管理和平台 `whisper-cli`，不内置约 142 MiB 的多语言模型；用户可以在应用内按需安装、热卸载模型，也可以导入独立 Voice Pack。Composer 只在组件真实可用时显示为可用，不再把 Electron `webkitSpeechRecognition` 的存在等同于服务可用。

## 已确认决策

- 默认本地引擎为固定版本的 `whisper.cpp` CLI，不使用 Node native addon，避免 Electron ABI 绑定。
- 首个质量基线为多语言 `base` 模型；量化模型必须通过中文准确率与延迟基准后才能成为默认。
- 基础包不包含模型；模型安装目录位于 Desktop `userData`，应用更新不重复下载。
- 在线安装与离线 Voice Pack 使用同一 manifest：组件版本、平台、架构、引擎版本、模型 ID、文件大小、SHA-256 和兼容应用版本均须匹配。
- 原始音频只以有界临时 WAV 存在于 Desktop main process，完成、取消、超时或失败后均清理。
- Apple Speech 和远程 `/audio/transcriptions` 只作为未来可选 Adapter，不作为跨平台主链路。

## 范围

- Desktop main/preload：语音组件状态、在线模型安装、离线目录包导入、卸载、转写、取消和受信任 IPC。
- Renderer：`16 kHz / mono / 16-bit PCM WAV` 录音、可用性状态、安装入口、Composer 与语音设置接入。
- 构建：固定 `whisper.cpp` 版本的平台 CLI 置于 `app.asar` 外；基础包不复制模型。
- 当前机器完成 macOS x64 真实构建与麦克风 E2E；Windows/Linux 用相同契约、路径解析和构建脚本测试锁定，正式平台 runner 证据保留为后续发布门。

## 非范围

- TTS、常驻监听、唤醒词、长音频转写和说话人分离。
- 在本轮直接发布 Windows/Linux 正式签名安装包。
- 自动继承聊天模型的 Base URL 或 API Key 作为语音供应商配置。
- 未经准确率基准直接把量化模型设为默认。

## 证据基线

- 当前 Web Speech 适配器位于 `apps/agent-console/src/features/agents/voice/voiceSpeech.ts`，Electron 实机返回 `network`。
- Composer 入口位于 `apps/agent-console/src/features/agents/components/VoiceInputButton.tsx` 和 `ChatSurface.tsx`。
- Desktop IPC 暴露边界位于 `apps/desktop-app/src/preload-api.ts`、`preload.ts` 和 `main.ts`。
- 打包资源边界位于 `apps/desktop-app/electron-builder.yml`；现有 runtime 通过 `extraResources` 保持在 `app.asar` 外。
- 2026-08-26 macOS Speech 探针虽然授权并成功转写，但报告 `supportsOnDeviceRecognition=false`，因此不满足跨平台本地默认方案。

## 开发切片

### S1 可选组件契约与生命周期（completed）

- 目标结果：Desktop 能报告 `not-installed / installing / ready / error`，校验 Voice Pack manifest，原子安装并热卸载模型。
- 修改范围：`apps/desktop-app/src/services/`、`preload-api.ts`、`preload.ts`、对应 Desktop tests。
- 依赖：无产品前置；使用现有 Electron IPC 和 `userData` 路径。
- 验收：非法平台/架构/哈希/超限包 fail closed；成功安装后无需重启变为 ready；卸载后不残留模型或临时文件。
- 回退点：移除新增 voice IPC/service，不影响聊天、文件、模型或 runtime IPC。
- 证据：Desktop voice component/preload tests `23 passed`；`npm run build:main` passed。

### S2 跨平台录音与 whisper 执行链（completed）

- 目标结果：Renderer 产生固定格式 WAV；main process 以固定路径、无 shell 的子进程调用 `whisper-cli` 并返回文本。
- 修改范围：`apps/agent-console/src/features/agents/voice/`、Desktop voice service、平台构建脚本和 `electron-builder.yml`。
- 依赖：S1 状态与安装路径。
- 验收：60 秒/20 MiB 上限；取消和超时终止子进程；stdout/stderr 有界；临时音频在所有退出路径清理；基础 `.app` 不含模型文件。
- 回退点：保留现有 Web Speech 浏览器 Adapter，Desktop voice capability 回到 not-installed。

### S3 Composer、设置与离线 Voice Pack（completed）

- 目标结果：设置页可安装、导入、卸载和查看模型状态；Composer 在 ready 后录音转写，未安装时提供明确安装入口。
- 修改范围：`VoiceInputButton.tsx`、`VoiceSettingsPage.tsx`、`voiceCapabilities.ts`、UI tests。
- 依赖：S1-S2。
- 验收：未安装不显示误导性“服务暂时不可用”；错误不清空草稿；安装/卸载无需应用重启；浏览器模式保留 Web Speech 降级。
- 回退点：隐藏组件管理入口并保留文本输入。

### S4 macOS x64 打包与跨平台契约验证（completed）

- 目标结果：生成不内置模型的 macOS x64 预览应用和可导入 Voice Pack，真实麦克风完成中文转写；Windows/Linux 构建路径由测试覆盖。
- 修改范围：构建产物、计划/任务进度、wiki 证据。
- 依赖：S1-S3。
- 验收：应用包内无 `ggml-base.bin`；Voice Pack 哈希校验通过；真实中文语音进入 Composer；重启后组件仍 ready；卸载后回到 not-installed；lint/typecheck/tests/build/docs/diff 通过。
- 回退点：删除独立预览与用户数据中的测试 Voice Pack，不修改 `/Applications` 现有安装。

## Voice Pack 契约

Voice Pack 是目录型 `.hvoice` 包，便于应用在三平台安全导入，发布系统可以额外提供 zip/tar 传输包装，用户解压后导入：

```text
forge-harness-whisper-base-<platform>-<arch>.hvoice/
  manifest.json
  models/ggml-base.bin
  LICENSES/whisper.cpp-MIT.txt
  LICENSES/openai-whisper-MIT.txt
```

平台 CLI 随基础应用提供，Voice Pack 只携带模型和许可。manifest 不允许绝对路径、`..`、符号链接或额外可执行文件。

## 验证矩阵

- Unit：manifest/schema、平台与架构、SHA-256、路径穿越、大小上限、状态机、WAV 编码。
- Integration：IPC sender、安装/卸载原子性、CLI 参数、超时/取消、临时文件清理。
- UI：未安装、安装中、ready、失败、转写成功、草稿保留、浏览器降级。
- E2E：macOS x64 独立 profile，真实麦克风中文转写、重启持久化、卸载回退。
- Packaging：`app.asar` 外存在平台 CLI，基础包不存在模型，Voice Pack manifest/hash 可复验。

## 风险与缓解

- 安装包或下载源被替换：固定引擎版本，Voice Pack 强制 SHA-256 与兼容范围校验，临时文件原子改名。
- Intel CPU 延迟过高：限制 60 秒，记录转写耗时；量化模型只有在真实中文基准后开放。
- 模型下载中断：`.part` 文件和断点重试后续可加；本轮失败必须清理且不改变 active 版本。
- 三平台二进制漂移：相同 CLI 参数契约与版本探针；正式发布仍需各平台 runner 构建和 E2E。
- 音频隐私：不上传，不进入 renderer persistence、日志或 crash payload；临时目录 mode 仅当前用户可访问。

## 完成定义

S1-S4 均完成并有新鲜验证证据；当前 macOS x64 预览可实际中文转写；基础安装包不含模型；可选 Voice Pack 可热安装/卸载；Windows/Linux 共用契约且没有平台专属上层分叉。正式签名与三平台发布仍由 `REL-001` 管理，不在本计划内冒充完成。

## 完成证据

- Console 相关语音/Composer/设置回归 `7 files / 67 tests` 通过，lint 与生产构建通过。
- Desktop 语音组件/Preload 回归 `2 files / 23 tests` 通过；Desktop 全量基线为 `45 files / 372 tests`，三套 TypeScript type-check、main/renderer/runtime 构建通过。
- macOS x64 独立 `.app` 包含可执行的 `whisper-cli`，SHA-256 为 `36ba87bc84fa1d61b9b4d2d282acd37d67f20be014aae7c5b21d014dba0e71e5`，基础包未发现 `ggml-base.bin` 或 `.hvoice`。
- 离线 `.hvoice` 通过系统目录选择器热导入，状态从 `not-installed` 变为 `ready`；真实麦克风完成录音、停止、本地转写和 Composer 写回，重启后仍为 `ready`，临时音频目录为空。
- 真实服务链另行验证 `not-installed -> ready -> transcribe -> uninstall -> not-installed`，4 秒中文样本约 `1126 ms` 完成并清理所有临时目录。
- 默认在线下载改用 Electron `net.fetch`，遵循会话代理，同时保留固定大小、SHA-256、临时文件与原子激活校验。当前网络对 Hugging Face 的直连超时是环境限制，不影响离线 Voice Pack。
