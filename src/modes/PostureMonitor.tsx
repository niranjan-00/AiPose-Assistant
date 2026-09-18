/**
 * PostureMonitor — analyze standing/sitting posture. Quick check, 5-min
 * monitoring, or continuous.
 *
 * Tracks head forward, shoulder alignment, torso upright, hip level.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useSettings } from "@/hooks/useSettings";
import { useVoiceCoach } from "@/hooks/useVoiceCoach";
import { analyzePosture, type PostureAnalysis } from "@/lib/posture/analyze";
import { CameraView } from "@/components/CameraView";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

type Mode = "quick" | "5min" | "continuous";

export function PostureMonitor() {
  const { settings } = useSettings();
  const [cameraActive, setCameraActive] = useState(false);
  const [mode, setMode] = useState<Mode>("quick");
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [analysis, setAnalysis] = useState<PostureAnalysis | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [samples, setSamples] = useState<number[]>([]);

  const stageRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastFeedbackAt = useRef<number>(0);
  const lastFeedbackText = useRef<string | null>(null);

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

  // Elapsed timer
  useEffect(() => {
    if (!cameraActive || mode === "quick") {
      startTimeRef.current = null;
      setElapsedMs(0);
      return;
    }
    startTimeRef.current = performance.now();
    const id = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = performance.now() - startTimeRef.current;
        setElapsedMs(elapsed);
        if (mode === "5min" && elapsed >= 5 * 60 * 1000) {
          setCameraActive(false);
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [cameraActive, mode]);

  const handleFrame = useCallback(
    (frame: Parameters<typeof analyzePosture>[0]) => {
      const result = analyzePosture(frame);
      setAnalysis(result);
      if (!result.noPerson) {
        setSamples((s) => [...s, result.score].slice(-50));
      }
      // Speak the worst cue at most every 4s
      const now = performance.now();
      if (
        now - lastFeedbackAt.current > 4000 &&
        result.summary &&
        result.summary !== lastFeedbackText.current
      ) {
        lastFeedbackAt.current = now;
        lastFeedbackText.current = result.summary;
        if (result.score < 70) {
          voice.speak({
            id: `posture-${now}`,
            text: result.summary,
            severity: "warning",
            timestamp: now,
          });
        }
      }
    },
    [voice],
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

  const avgScore = samples.length > 0
    ? Math.round(samples.reduce((s, v) => s + v, 0) / samples.length)
    : 0;
  const worstRule = analysis?.rules
    .filter((r) => r.severity === "warning" || r.severity === "error")
    .sort((a, b) => a.score - b.score)[0];

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
          status={(analysis?.score ?? 0) >= 75 ? "good" : "improve"}
          cameraActive={cameraActive}
        >
          {/* Header */}
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 pt-safe">
            <div>
              <p className="text-[10px] uppercase tracking-[0.34em] text-white/60">
                Posture Monitor
              </p>
              <h1 className="text-lg font-bold">Posture Check</h1>
            </div>
            {mode !== "quick" && cameraActive && (
              <div className="font-mono text-sm text-lime-300">
                {formatTime(elapsedMs)}
              </div>
            )}
          </div>

          {/* Score badge */}
          {cameraActive && analysis && !analysis.noPerson && (
            <div className="absolute right-4 top-20 z-10 w-44 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Posture Score
              </p>
              <p className={cn(
                "text-3xl font-bold",
                analysis.score >= 75 ? "text-lime-300" : analysis.score >= 55 ? "text-yellow-300" : "text-red-400",
              )}>
                {analysis.score}
              </p>
              <p className="mt-1 text-xs text-white/60">{analysis.summary}</p>
            </div>
          )}

          {/* Bottom feedback */}
          {cameraActive && (
            <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-3 bg-gradient-to-t from-black to-transparent p-4 pb-safe">
              {worstRule && (
                <FeedbackPanel
                  message={{
                    id: `posture-worst-${worstRule.id}`,
                    text: worstRule.cue,
                    severity: worstRule.severity,
                    timestamp: performance.now(),
                  }}
                  lowConfidence={analysis?.noPerson}
                />
              )}
              <div className="mx-auto w-full max-w-sm">
                <Segmented
                  value={mode}
                  onChange={(v) => setMode(v as Mode)}
                  options={[
                    { value: "quick", label: "Quick" },
                    { value: "5min", label: "5 min" },
                    { value: "continuous", label: "Continuous" },
                  ]}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {!cameraActive && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center">
              <div>
                <h2 className="text-2xl font-bold">Posture Monitor</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-white/60">
                  Stand or sit in view of the camera. AiPose will analyze head, shoulders, torso, and hips in real time.
                </p>
              </div>
              <Button variant="primary" size="lg" onClick={() => setCameraActive(true)}>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20">▶</span>
                Start monitoring
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

      {/* Bottom: rule breakdown */}
      <div className="border-t border-white/10 bg-black/80 p-3 backdrop-blur-xl">
        {analysis && !analysis.noPerson ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {analysis.rules.map((r) => (
              <Card key={r.id} className="p-2">
                <p className="text-[10px] uppercase tracking-wider text-white/50">
                  {r.description}
                </p>
                <p className={cn(
                  "text-sm font-bold",
                  r.score >= 0.8 ? "text-lime-300" : r.score >= 0.5 ? "text-yellow-300" : "text-red-400",
                )}>
                  {Math.round(r.score * 100)}%
                </p>
                <p className="mt-0.5 text-[10px] text-white/50">{r.cue}</p>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-white/40">
            {cameraActive ? "Move into view to start posture analysis" : "Start the camera to begin"}
          </p>
        )}
        {samples.length > 0 && (
          <p className="mt-2 text-center text-[10px] text-white/40">
            Avg posture score (last {samples.length} samples): {avgScore}%
          </p>
        )}
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
