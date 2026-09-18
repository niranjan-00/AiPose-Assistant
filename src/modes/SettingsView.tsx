/**
 * Settings — appearance, camera, pose sensitivity, voice coach, privacy,
 * data management.
 */
import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import type { Settings, Theme, VideoQuality, FeedbackFrequency } from "@/types/settings";
import { clearAllData } from "@/lib/storage/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";

export function SettingsView() {
  const { settings, update, reset } = useSettings();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const setNested = <K extends keyof Settings>(key: K, value: Partial<Settings[K]>) =>
    update((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as object), ...value } as Settings[K],
    }));

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-zinc-950 p-4 pb-safe">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-white/50">Settings</p>
          <h1 className="text-2xl font-bold">Customize your experience</h1>
        </div>

        {/* Appearance */}
        <Card title="Appearance">
          <div className="space-y-3">
            <SettingRow label="Theme">
              <Segmented
                value={settings.appearance.theme}
                onChange={(v) => setNested("appearance", { theme: v as Theme })}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Reduced motion">
              <Toggle
                checked={settings.appearance.reducedMotion}
                onChange={(v) => setNested("appearance", { reducedMotion: v })}
              />
            </SettingRow>
            <SettingRow label="High contrast">
              <Toggle
                checked={settings.appearance.highContrast}
                onChange={(v) => setNested("appearance", { highContrast: v })}
              />
            </SettingRow>
          </div>
        </Card>

        {/* Camera */}
        <Card title="Camera">
          <div className="space-y-3">
            <SettingRow label="Video quality">
              <Segmented
                value={settings.camera.quality}
                onChange={(v) => setNested("camera", { quality: v as VideoQuality })}
                options={[
                  { value: "480p", label: "480p" },
                  { value: "720p", label: "720p" },
                  { value: "1080p", label: "1080p" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Default camera">
              <Segmented
                value={settings.camera.facingMode}
                onChange={(v) => setNested("camera", { facingMode: v as "user" | "environment" })}
                options={[
                  { value: "user", label: "Front" },
                  { value: "environment", label: "Rear" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Mirror preview">
              <Toggle
                checked={settings.camera.mirrored}
                onChange={(v) => setNested("camera", { mirrored: v })}
              />
            </SettingRow>
            <SettingRow label="Performance panel">
              <Toggle
                checked={settings.camera.showPerfPanel}
                onChange={(v) => setNested("camera", { showPerfPanel: v })}
              />
            </SettingRow>
          </div>
        </Card>

        {/* Pose */}
        <Card title="Pose Detection" description="Adjust sensitivity and target FPS for pose detection.">
          <div className="space-y-3">
            <SettingRow label="Target FPS">
              <input
                type="range"
                min={5}
                max={30}
                value={settings.pose.targetFps}
                onChange={(e) => setNested("pose", { targetFps: Number(e.target.value) })}
                className="w-32"
              />
              <span className="w-10 text-right text-sm font-mono text-white">{settings.pose.targetFps}</span>
            </SettingRow>
            <SettingRow label="Min confidence">
              <input
                type="range"
                min={0.2}
                max={0.6}
                step={0.05}
                value={settings.pose.minConfidence}
                onChange={(e) => setNested("pose", { minConfidence: Number(e.target.value) })}
                className="w-32"
              />
              <span className="w-10 text-right text-sm font-mono text-white">
                {settings.pose.minConfidence.toFixed(2)}
              </span>
            </SettingRow>
          </div>
        </Card>

        {/* Voice */}
        <Card title="Voice Coach" description="AiPose speaks coaching cues aloud. Uses your browser's SpeechSynthesis API.">
          <div className="space-y-3">
            <SettingRow label="Enabled">
              <Toggle
                checked={settings.voice.enabled}
                onChange={(v) => setNested("voice", { enabled: v })}
              />
            </SettingRow>
            <SettingRow label="Volume">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.voice.volume}
                onChange={(e) => setNested("voice", { volume: Number(e.target.value) })}
                className="w-32"
                disabled={!settings.voice.enabled}
              />
              <span className="w-10 text-right text-sm font-mono text-white">
                {Math.round(settings.voice.volume * 100)}%
              </span>
            </SettingRow>
            <SettingRow label="Feedback frequency">
              <Segmented
                value={settings.voice.frequency}
                onChange={(v) => setNested("voice", { frequency: v as FeedbackFrequency })}
                options={[
                  { value: "minimal", label: "Minimal" },
                  { value: "balanced", label: "Balanced" },
                  { value: "verbose", label: "Verbose" },
                ]}
              />
            </SettingRow>
          </div>
        </Card>

        {/* Privacy */}
        <Card title="Privacy" description="All pose processing happens on your device. No camera frames are uploaded.">
          <div className="space-y-3">
            <div className="rounded-xl border border-lime-300/30 bg-lime-300/5 p-3 text-xs text-lime-200/80">
              ✓ Pose processing happens on your device using TensorFlow.js. Camera frames never leave your browser unless you explicitly capture and export them.
            </div>
            <SettingRow label="Scene analysis">
              <Toggle
                checked={settings.privacy.sceneAnalysis}
                onChange={(v) => setNested("privacy", { sceneAnalysis: v })}
              />
            </SettingRow>
            <SettingRow label="Voice coach">
              <Toggle
                checked={settings.privacy.voiceCoach}
                onChange={(v) => setNested("privacy", { voiceCoach: v })}
              />
            </SettingRow>
            <SettingRow label="Local workout history">
              <Toggle
                checked={settings.privacy.analytics}
                onChange={(v) => setNested("privacy", { analytics: v })}
              />
            </SettingRow>
            <SettingRow label="Save captured media">
              <Toggle
                checked={settings.privacy.savedMedia}
                onChange={(v) => setNested("privacy", { savedMedia: v })}
              />
            </SettingRow>
          </div>
        </Card>

        {/* Data management */}
        <Card title="Data Management">
          <div className="space-y-3">
            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full"
            >
              Delete all local data
            </Button>
            <p className="text-[10px] text-white/40">
              This permanently deletes all locally stored workouts, settings, captures metadata, and personal records from this browser.
            </p>
          </div>
        </Card>

        {/* Reset */}
        <Button variant="ghost" onClick={reset} className="w-full">
          Reset settings to defaults
        </Button>
      </div>

      <Sheet open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm delete">
        <div className="space-y-4">
          <p className="text-sm text-white/80">
            This will permanently delete all locally stored data: workouts, captures, settings, stats, and personal records.
          </p>
          <p className="text-xs text-white/50">This action cannot be undone.</p>
          <div className="flex gap-2">
            <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAllData();
                reset();
                setShowDeleteConfirm(false);
                window.location.reload();
              }}
            >
              Delete everything
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/80">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-lime-300" : "bg-white/20"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}
