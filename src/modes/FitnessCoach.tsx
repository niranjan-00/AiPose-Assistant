/**
 * FitnessCoach — the AI fitness coaching mode. Lets the user select an exercise,
 * runs the exercise engine + rep counter + form analysis + coaching + voice coach.
 *
 * Layout (during exercise):
 *
 *   ┌─────────────────────────┐
 *   │  SQUAT  Set 1/3         │
 *   │                         │
 *   │       CAMERA + AI       │
 *   │                         │
 *   │      12 / 15            │
 *   │      FORM 92%           │
 *   │  ✓ Great depth          │
 *   │                         │
 *   └─────────────────────────┘
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExerciseId } from "@/types/exercise";
import { EXERCISE_LIST, getExercise } from "@/lib/exercises";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useExerciseRunner } from "@/hooks/useExerciseRunner";
import { useVoiceCoach } from "@/hooks/useVoiceCoach";
import { useSettings } from "@/hooks/useSettings";
import { CameraView } from "@/components/CameraView";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { RepCounter } from "@/components/RepCounter";
import { DevPanel } from "@/components/DevPanel";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/utils/cn";

export function FitnessCoach() {
  const { settings } = useSettings();
  const [selectedExercise, setSelectedExercise] = useState<ExerciseId | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [targetReps, setTargetReps] = useState(15);
  const [showLibrary, setShowLibrary] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement>(null);

  const definition = selectedExercise ? getExercise(selectedExercise) : null;

  const cam = useCamera({
    active: cameraActive,
    facingMode: settings.camera.facingMode,
    quality: settings.camera.quality,
    mirrored: settings.camera.mirrored,
  });

  // Track stage size
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

  const runner = useExerciseRunner({
    definition: definition ?? EXERCISE_LIST[0]!,
    mirrored: settings.camera.mirrored,
    enabled: !!definition && cameraActive,
  });

  const voice = useVoiceCoach({
    enabled: settings.voice.enabled && settings.privacy.voiceCoach,
    volume: settings.voice.volume,
    rate: settings.voice.rate,
    frequency: settings.voice.frequency,
  });

  // Speak latest coaching message via voice coach
  useEffect(() => {
    if (runner.latestMessage) {
      voice.speak(runner.latestMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.latestMessage?.id]);

  const handleFrame = useCallback(
    (frame: Parameters<typeof runner.onFrame>[0]) => {
      runner.onFrame(frame);
    },
    [runner],
  );

  const pose = usePoseDetection({
    videoRef: cam.videoRef,
    videoWidth: cam.videoWidth,
    videoHeight: cam.videoHeight,
    active: cameraActive && !!definition,
    mirrored: settings.camera.mirrored,
    onFrame: handleFrame,
    targetFps: settings.pose.targetFps,
  });

  // Reset runner when exercise changes
  useEffect(() => {
    runner.reset();
    setTargetReps(definition?.defaultReps ?? 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExercise]);

  // Stop voice coach when leaving
  useEffect(() => {
    return () => voice.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectExercise = (id: ExerciseId) => {
    setSelectedExercise(id);
    setShowLibrary(false);
    setCameraActive(true);
  };

  const scoreBars = useMemo(
    () => [
      { label: "Form", value: runner.breakdown.form },
      { label: "Range", value: runner.breakdown.rangeOfMotion },
      { label: "Symmetry", value: runner.breakdown.symmetry },
      { label: "Tempo", value: runner.breakdown.tempo },
      { label: "Stability", value: runner.breakdown.stability },
    ],
    [runner.breakdown],
  );

  if (!definition) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Fitness Coach</h1>
          <p className="mt-2 text-sm text-white/60">
            Pick an exercise to start training with real-time AI feedback on form, reps, and tempo.
          </p>
        </div>
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          {EXERCISE_LIST.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => handleSelectExercise(ex.id)}
              className="flex flex-col items-start gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
            >
              <span className="text-base font-bold">{ex.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                {ex.difficulty}
              </span>
              <span className="text-[10px] text-white/50">
                {ex.targetMuscles.join(" · ")}
              </span>
              <span className="mt-1 text-xs text-lime-300">
                {ex.defaultSets} × {ex.defaultReps}
                {ex.isHold ? ` · ${Math.round((ex.defaultHoldMs ?? 0) / 1000)}s hold` : " reps"}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

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
          status={runner.breakdown.overall >= 75 ? "good" : "improve"}
          cameraActive={cameraActive}
        >
          {flashIfScoring()}

          {/* Header */}
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 pt-safe">
            <div>
              <p className="text-[10px] uppercase tracking-[0.34em] text-white/60">
                Fitness Coach
              </p>
              <h1 className="text-xl font-bold">{definition.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <IconButton
                label="Change exercise"
                onClick={() => setShowLibrary(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </IconButton>
              <IconButton
                label="Reset"
                onClick={() => runner.reset()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12a9 9 0 1015-6.7L21 8M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </IconButton>
            </div>
          </div>

          {/* Per-frame angles (top-right) */}
          {cameraActive && Object.keys(runner.angles).length > 0 && (
            <Card className="absolute right-4 top-20 z-10 w-44 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
                Joint Angles
              </p>
              <div className="space-y-1">
                {Object.entries(runner.angles).slice(0, 4).map(([label, ang]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-white/60">{label}</span>
                    <span className="font-mono text-white">
                      {Number.isNaN(ang) ? "—" : `${Math.round(ang)}°`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Error banner */}
          {(cam.error || pose.error) && (
            <div className="absolute left-4 right-4 top-24 z-10 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-200">
              {cam.error?.userMessage ?? pose.error}
            </div>
          )}

          {/* Big rep counter + feedback */}
          {cameraActive && (
            <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-3 bg-gradient-to-t from-black to-transparent p-4 pb-safe">
              <div className="flex items-center justify-center">
                <RepCounter
                  reps={runner.repCount}
                  target={targetReps}
                  phase={runner.phase}
                  formScore={runner.breakdown.overall}
                  isHold={definition.isHold}
                />
              </div>
              <div className="mx-auto w-full max-w-sm">
                <FeedbackPanel
                  message={runner.latestMessage}
                  lowConfidence={runner.lowConfidence}
                />
              </div>
              {runner.repCount >= targetReps && (
                <div className="mx-auto flex items-center gap-3 rounded-full border border-lime-300/40 bg-lime-300/10 px-4 py-2">
                  <span className="text-sm font-bold text-lime-300">
                    Target reached! Great job.
                  </span>
                  <Button size="sm" variant="primary" onClick={() => runner.reset()}>
                    Reset
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Start CTA */}
          {!cameraActive && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  {definition.difficulty} · {definition.targetMuscles.join(", ")}
                </p>
                <h2 className="mt-1 text-2xl font-bold">{definition.name}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
                  {definition.description}
                </p>
              </div>
              <Button variant="primary" size="lg" onClick={() => setCameraActive(true)}>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20">▶</span>
                Start training
              </Button>
              <button
                type="button"
                onClick={() => setSelectedExercise(null)}
                className="text-xs text-white/50 underline"
              >
                ← Pick a different exercise
              </button>
            </div>
          )}

          {settings.camera.showPerfPanel && pose.perf.fps > 0 && (
            <DevPanel
              fps={pose.perf.fps}
              inferenceMs={pose.perf.inferenceMs}
              backend={pose.perf.backend}
              model="MoveNet Lightning"
            />
          )}
        </CameraView>
      </div>

      {/* Score breakdown */}
      <div className="border-t border-white/10 bg-black/80 p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
            Score breakdown
          </p>
          <p className="text-sm font-bold text-lime-300">
            Overall: {runner.breakdown.overall}%
          </p>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {scoreBars.map((bar) => (
            <ScoreBar key={bar.label} label={bar.label} value={bar.value} />
          ))}
        </div>
      </div>

      {/* Exercise library sheet */}
      <Sheet open={showLibrary} onClose={() => setShowLibrary(false)} title="Choose exercise">
        <div className="grid grid-cols-2 gap-3">
          {EXERCISE_LIST.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                setSelectedExercise(ex.id);
                setShowLibrary(false);
                runner.reset();
              }}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-colors",
                ex.id === selectedExercise
                  ? "border-lime-300 bg-lime-300/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              )}
            >
              <span className="text-base font-bold">{ex.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                {ex.difficulty}
              </span>
              <span className="text-[10px] text-white/50">
                {ex.targetMuscles.join(" · ")}
              </span>
              <span className="mt-1 text-xs text-lime-300">
                {ex.defaultSets} × {ex.defaultReps}
                {ex.isHold ? ` · ${Math.round((ex.defaultHoldMs ?? 0) / 1000)}s hold` : " reps"}
              </span>
            </button>
          ))}
        </div>
        {definition && definition.commonMistakes.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
              Common mistakes
            </h3>
            <div className="space-y-2">
              {definition.commonMistakes.map((m) => (
                <div key={m.id} className="rounded-xl bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">{m.name}</p>
                  <p className="mt-1 text-xs text-white/60">{m.description}</p>
                  <p className="mt-1 text-xs text-lime-300">{m.cue}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );

  function flashIfScoring() {
    return null;
  }
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? "bg-lime-300" : value >= 60 ? "bg-yellow-300" : "bg-red-400";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-wider text-white/50">{label}</span>
        <span className="text-[10px] font-mono text-white">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full bar-fill rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
