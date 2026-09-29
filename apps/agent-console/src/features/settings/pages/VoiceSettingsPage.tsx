import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, ShieldCheck, Volume2 } from "lucide-react";

import { ConsoleShell } from "../../../app/ConsoleShell";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { VoiceInputButton } from "../../agents/components/VoiceInputButton";
import {
  createVoiceCapabilitySnapshot,
  detectSpeechRecognitionSupport,
  type MicrophonePermissionState,
} from "../../agents/voice/voiceCapabilities";
import {
  DEFAULT_VOICE_PREFERENCES,
  applyVoiceTranscript,
  loadVoicePreferences,
  saveVoicePreferences,
} from "../../agents/voice/voicePreferences";

export function VoiceSettingsPage() {
  const [permission, setPermission] = useState<MicrophonePermissionState>("unknown");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [componentStatus, setComponentStatus] = useState<DesktopVoiceComponentStatus | null>(null);
  const [componentBusy, setComponentBusy] = useState(false);
  const [preferences, setPreferences] = useState(loadVoicePreferences);
  const permissionOutcomeRef = useRef<MicrophonePermissionState | null>(null);
  const supported = typeof window !== "undefined" && detectSpeechRecognitionSupport(window);
  const capabilities = createVoiceCapabilitySnapshot(supported, permission);
  const voiceApi = typeof window !== "undefined" ? window.desktopApi?.voice : undefined;

  const refreshComponentStatus = useCallback(async () => {
    if (!voiceApi?.getStatus) return;
    try {
      setComponentStatus(await voiceApi.getStatus());
    } catch (error) {
      setComponentStatus({ state: "error", message: error instanceof Error ? error.message : "无法读取本地语音组件状态" });
    }
  }, [voiceApi]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      return;
    }
    const queryPermission = async () => {
      try {
        const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        if (status) {
          setPermission(status.state);
          status.onchange = () => {
            const next = status.state as MicrophonePermissionState;
            // Some browsers keep the permission query at "prompt" after a
            // user-visible getUserMedia rejection. Preserve the concrete
            // request outcome shown by this page until the next request.
            if (permissionOutcomeRef.current === "denied" && next === "prompt") return;
            setPermission(next);
          };
          return;
        }
      } catch {
        // Some Electron/WebKit versions do not expose microphone permission queries.
      }
      setPermission("prompt");
    };
    void queryPermission();
  }, []);

  useEffect(() => {
    void refreshComponentStatus();
  }, [refreshComponentStatus]);

  async function runComponentAction(
    action: (() => Promise<DesktopVoiceComponentStatus>) | undefined,
    successMessage: string,
  ) {
    if (!action) return;
    setComponentBusy(true);
    setNotice(null);
    try {
      const status = await action();
      setComponentStatus(status);
      setNotice(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "本地语音组件操作失败";
      setComponentStatus((current) => ({ ...current, state: "error", message }));
      setNotice(message);
    } finally {
      setComponentBusy(false);
    }
  }

  async function requestMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    permissionOutcomeRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      permissionOutcomeRef.current = "granted";
      setPermission("granted");
      setNotice("麦克风权限已授予；原始音频不会保存到 Harness。");
    } catch {
      permissionOutcomeRef.current = "denied";
      setPermission("denied");
      setNotice("麦克风权限被拒绝，文本输入仍可正常使用。");
    }
  }

  return (
    <ConsoleShell title="语音">
      <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6 border-b border-slate-200 pb-5">
            <Link to="/settings" className="text-xs font-medium text-slate-500 hover:text-slate-900">返回设置</Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">语音</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Desktop 使用可选的本地 Whisper 组件转写，模型独立安装并可随时卸载；浏览器模式保留 Web Speech。原始音频只在转写期间临时处理，不进入草稿或长期存储。</p>
          </header>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700"><Mic className="h-4 w-4" />输入能力</div>
              <div className="divide-y divide-slate-100">
                {voiceApi ? (
                  <SettingRow title="本地语音模型" description={componentDescription(componentStatus)}>
                    <Badge tone={componentStatus?.state === "ready" ? "success" : componentStatus?.state === "error" ? "warning" : "neutral"}>{componentLabel(componentStatus)}</Badge>
                    {componentStatus?.state === "ready" ? (
                      <Button type="button" variant="secondary" disabled={componentBusy} onClick={() => void runComponentAction(voiceApi.uninstall, "本地语音模型已卸载。")}>卸载</Button>
                    ) : (
                      <>
                        <Button type="button" variant="secondary" disabled={componentBusy || !voiceApi.installDefaultModel} onClick={() => void runComponentAction(voiceApi.installDefaultModel, "本地语音模型已安装，可以立即开始转写。")}>{componentBusy ? "处理中" : "在线安装"}</Button>
                        <Button type="button" variant="secondary" disabled={componentBusy || !voiceApi.importPack} onClick={() => void runComponentAction(voiceApi.importPack, "离线 Voice Pack 已导入，可以立即开始转写。")}>导入离线包</Button>
                      </>
                    )}
                  </SettingRow>
                ) : null}
                <SettingRow title="Speech Recognition" description={recognitionDescription(capabilities.recognitionAvailability)}><Badge tone={capabilities.recognitionAvailability === "ready" ? "success" : capabilities.recognitionAvailability === "blocked" ? "warning" : "neutral"}>{recognitionLabel(capabilities.recognitionAvailability)}</Badge></SettingRow>
                <SettingRow title="麦克风权限" description={permissionDescription(permission)}><Badge tone={permission === "granted" ? "success" : permission === "denied" ? "warning" : "neutral"}>{permissionLabel(permission)}</Badge><Button type="button" variant="secondary" onClick={() => void requestMicrophone()} disabled={permission === "unsupported" || permission === "granted"}>请求权限</Button></SettingRow>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700"><Volume2 className="h-4 w-4" />转写预览</div>
              <div className="space-y-3 px-3 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <VoiceInputButton
                    language={preferences.language}
                    inputMode={preferences.inputMode}
                    showControls
                    onInterimTranscript={setInterimTranscript}
                    onTranscript={(value) => {
                      setTranscript((current) => applyVoiceTranscript(current, value, preferences.insertionMode));
                      setInterimTranscript("");
                      setNotice("转写文字仅保留在当前设置页预览；发送到 Composer 后会按草稿策略保存。");
                    }}
                  />
                  <span className="text-xs text-slate-500">{preferences.inputMode === "hold" ? "按住麦克风说话，松开结束。" : "点击开始，再次点击停止。"}</span>
                  {interimTranscript ? <span className="max-w-full truncate text-xs text-slate-600" aria-live="polite">{interimTranscript}</span> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <PreferenceSelect label="语言" value={preferences.language} onChange={(value) => updatePreferences(setPreferences, preferences, { language: value })} options={[{ value: "zh-CN", label: "中文" }, { value: "en-US", label: "English" }, { value: "auto", label: "自动检测" }]} />
                  <PreferenceSelect label="输入方式" value={preferences.inputMode} onChange={(value) => updatePreferences(setPreferences, preferences, { inputMode: value })} options={[{ value: "click", label: "点击说话" }, { value: "hold", label: "按住说话" }]} />
                  <PreferenceSelect label="草稿处理" value={preferences.insertionMode} onChange={(value) => updatePreferences(setPreferences, preferences, { insertionMode: value })} options={[{ value: "append", label: "追加到草稿" }, { value: "replace", label: "替换草稿" }]} />
                </div>
                <textarea aria-label="语音转写结果" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="尚未有转写结果" className="min-h-28 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-500" />
                {notice ? <p className="text-xs leading-5 text-slate-500">{notice}</p> : null}
              </div>
            </section>

            <section className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" /><p>Desktop 本地转写不会上传原始音频；临时 WAV 在完成、失败、取消或超时后清理。模型单独存放在应用数据目录，应用升级不会重复下载。浏览器 Web Speech 可能由浏览器供应商处理音频。</p></section>
          </div>
        </div>
      </main>
    </ConsoleShell>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="flex min-h-16 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="text-sm font-medium text-slate-900">{title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{description}</div></div><div className="flex shrink-0 items-center gap-2">{children}</div></div>;
}

function permissionLabel(value: MicrophonePermissionState) {
  if (value === "granted") return "已授权";
  if (value === "denied") return "已拒绝";
  if (value === "prompt") return "待请求";
  if (value === "unsupported") return "不可用";
  return "检测中";
}

function componentLabel(status: DesktopVoiceComponentStatus | null) {
  if (!status) return "检测中";
  if (status.state === "ready") return "可用";
  if (status.state === "installing") return "安装中";
  if (status.state === "error") return "错误";
  if (status.state === "unavailable") return "当前平台不可用";
  return "未安装";
}

function componentDescription(status: DesktopVoiceComponentStatus | null) {
  if (!status) return "正在检查本地 Whisper 执行器和模型。";
  if (status.state === "ready") return `${status.modelId || "多语言模型"} 已安装，语音输入无需重启即可使用。`;
  if (status.state === "installing") return "正在下载、校验并原子安装本地语音模型。";
  if (status.state === "error") return status.message || "组件校验或安装失败，可重试或导入离线包。";
  if (status.state === "unavailable") return status.message || "当前平台没有可用的 Whisper 执行器。";
  return "基础应用不内置大模型；可在线安装或导入独立 Voice Pack。";
}

function permissionDescription(value: MicrophonePermissionState) {
  if (value === "granted") return "当前页面可以请求语音识别输入。";
  if (value === "denied") return "请在系统或浏览器设置中重新允许麦克风。";
  if (value === "unsupported") return "当前运行时没有可用的麦克风 API。";
  return "权限只在用户点击请求或语音按钮后申请。";
}

function recognitionLabel(value: ReturnType<typeof createVoiceCapabilitySnapshot>["recognitionAvailability"]) {
  if (value === "ready") return "可用";
  if (value === "permission-required") return "需要权限";
  if (value === "blocked") return "已阻止";
  if (value === "unsupported") return "不可用";
  return "检测中";
}

function recognitionDescription(value: ReturnType<typeof createVoiceCapabilitySnapshot>["recognitionAvailability"]) {
  if (value === "ready") return "Speech Recognition 和麦克风权限均可用，可以开始语音输入。";
  if (value === "permission-required") return "当前运行时支持语音识别，但需要先授予麦克风权限。";
  if (value === "blocked") return "麦克风权限已拒绝，请在系统或浏览器设置中重新允许。";
  if (value === "unsupported") return "当前运行时没有完整的语音识别能力，文本输入保持可用。";
  return "正在检测语音识别和麦克风能力。";
}

function PreferenceSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-700">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-slate-500 focus:outline-none">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function updatePreferences(
  setPreferences: React.Dispatch<React.SetStateAction<typeof DEFAULT_VOICE_PREFERENCES>>,
  current: typeof DEFAULT_VOICE_PREFERENCES,
  patch: Partial<typeof DEFAULT_VOICE_PREFERENCES>,
) {
  const next = { ...current, ...patch };
  setPreferences(next);
  saveVoicePreferences(next);
}
