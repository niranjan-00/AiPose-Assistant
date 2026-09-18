/**
 * PosePractice — user picks a target pose, attempts to match it.
 * Uses normalized joint-angle comparison.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useSettings } from "@/hooks/useSettings";
import { useVoiceCoach } from "@/hooks/useVoiceCoach";
import { TARGET_POSES, type TargetPose } from "@/lib/targetPoses";
import { comparePoses, type PoseComparisonResult } from "@/lib/comparison/pose";
import { CameraView } from "@/components/CameraView";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

export function PosePractice() {
  const { settings } = useSettings();
  const [target, setTarget] = useState<TargetPose>(TARGET_POSES[0]!);
  const [cameraActive, setCameraActive] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [comparison, setComparison] = useState<PoseComparisonResult | null>(null);
  const [lastPraiseAt, setLastPraiseAt] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);

  const cam = useCamera({
    active: cameraActive,
    facingMode: settings.camera.facingMode,
    quality: settings.camera.quality,
    mirrored: settings.camera.mirrored,
  });

  const voice = useVoiceCoach({
    enabled: settings.voice.enabled && settings.privacy.voiceCoach,
    volume: settings.voice.volume,
    rate: settings.voice.rate,
    frequency: settings.voice.frequency,
  });

  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setStageSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleFrame = useCallback(
    (frame: Parameters<typeof comparePoses>[0]) => {
      const result = comparePoses(frame, target);
      setComparison(result);
      const now = performance.now();
      if (result.overall >= 85 && now - lastPraiseAt > 3000) {
        setLastPraiseAt(now);
        voice.speak({
          id: `praise-${now}`,
          text: "Hold it!",
          severity: "success",
          timestamp: now,
        });
      }
    },
    [target, voice, lastPraiseAt],
  );

  const pose = usePoseDetection({
    videoRef: cam.videoRef,
    videoWidth: cam.videoWidth,
    videoHeight: cam.videoHeight,
    active: cameraActive,
    mirrored: settings.camera.mirrored,
    onFrame: handleFrame,
    targetFps: settings.pose.targetFps,
  });

  return (
    <div className="flex h-full flex-col">
      <div ref={stageRef} className="relative flex-1 overflow-hidden">
        <CameraView
          videoRef={cam.videoRef}
          videoWidth={cam.videoWidth}
          videoHeight={cam.videoHeight}
          stageWidth={stageSize.w}
          stageHeight={stageSize.h}
          mirrored={settings.camera.mirrored}
          frame={pose.latest}
          showOverlay
          status={(comparison?.overall ?? 0) >= 75 ? "good" : "improve"}
          cameraActive={cameraActive}
        >
          {/* Header */}
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 pt-safe">
            <div>
              <p className="text-[10px] uppercase tracking-[0.34em] text-white/60">
                Pose Practice
              </p>
              <h1 className="text-lg font-bold">{target.name}</h1>
            </div>
            {comparison && (
              <div className="rounded-2xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Match</p>
                <p className={cn(
                  "text-2xl font-bold",
                  comparison.overall >= 75 ? "text-lime-300" : comparison.overall >= 50 ? "text-yellow-300" : "text-red-400",
                )}>
                  {comparison.overall}%
                </p>
              </div>
            )}
          </div>

          {/* Joint diffs */}
          {cameraActive && comparison && !comparison.insufficient && (
            <div className="absolute right-4 top-32 z-10 w-44 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
              <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
                Joint Check
              </p>
              <div className="space-y-1">
                {comparison.joints.slice(0, 6).map((j) => (
                  <div key={j.label} className="flex items-center justify-between text-xs">
                    <span className="text-white/60">{j.label}</span>
                    <span className={cn(
                      "font-mono",
                      j.status === "good" ? "text-lime-300" : "text-yellow-300",
                    )}>
                      {j.status === "good" ? "✓" : `${j.delta}°`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!cameraActive && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center">
              <div>
                <h2 className="text-2xl font-bold">{target.name}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-white/60">
                  {target.description}
                </p>
              </div>
              <Button variant="primary" size="lg" onClick={() => setCameraActive(true)}>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20">▶</span>
                Start matching
              </Button>
            </div>
          )}

          {(cam.error || pose.error) && (
            <div className="absolute left-4 right-4 top-24 z-10 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-200">
              {cam.error?.userMessage ?? pose.error}
            </div>
          )}
        </CameraView>
      </div>

      {/* Bottom: target pose selector */}
      <div className="border-t border-white/10 bg-black/80 p-3 backdrop-blur-xl">
        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
          Target poses
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TARGET_POSES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setTarget(p)}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                p.id === target.id
                  ? "border-lime-300 bg-lime-300/10 text-lime-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
