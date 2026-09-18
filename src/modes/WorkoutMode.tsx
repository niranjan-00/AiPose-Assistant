/**
 * WorkoutMode — three sub-screens: Builder, Session, Summary.
 * State machine managed internally.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ExerciseId,
} from "@/types/exercise";
import type {
  WorkoutExercise,
  WorkoutSummary,
  WorkoutSummaryExercise,
} from "@/types/workout";
import { EXERCISE_LIST, getExercise } from "@/lib/exercises";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useExerciseRunner } from "@/hooks/useExerciseRunner";
import { useVoiceCoach } from "@/hooks/useVoiceCoach";
import { useSettings } from "@/hooks/useSettings";
import { saveWorkout, saveUserStats, loadUserStats } from "@/lib/storage/db";
import { CameraView } from "@/components/CameraView";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { RepCounter } from "@/components/RepCounter";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { formatDuration } from "@/lib/capture/recorder";
import { cn } from "@/utils/cn";

type Screen = "builder" | "session" | "rest" | "summary";

interface WorkoutState {
  name: string;
  exercises: WorkoutExercise[];
  currentIndex: number;
  currentSet: number;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const PRESET_WORKOUTS: Array<{
  name: string;
  exercises: Array<{ exerciseId: ExerciseId; sets: number; reps: number; restMs: number; holdMs?: number }>;
}> = [
  {
    name: "Full Body",
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 12, restMs: 30000 },
      { exerciseId: "pushup", sets: 3, reps: 10, restMs: 30000 },
      { exerciseId: "lunge", sets: 3, reps: 10, restMs: 30000 },
      { exerciseId: "plank", sets: 3, reps: 1, restMs: 30000, holdMs: 30000 },
    ],
  },
  {
    name: "Upper Body",
    exercises: [
      { exerciseId: "pushup", sets: 3, reps: 10, restMs: 30000 },
      { exerciseId: "shoulderPress", sets: 3, reps: 10, restMs: 30000 },
      { exerciseId: "bicepCurl", sets: 3, reps: 12, restMs: 30000 },
      { exerciseId: "plank", sets: 3, reps: 1, restMs: 30000, holdMs: 30000 },
    ],
  },
  {
    name: "Core",
    exercises: [
      { exerciseId: "plank", sets: 3, reps: 1, restMs: 30000, holdMs: 30000 },
      { exerciseId: "situp", sets: 3, reps: 15, restMs: 30000 },
      { exerciseId: "pushup", sets: 2, reps: 10, restMs: 30000 },
    ],
  },
  {
    name: "Quick Cardio",
    exercises: [
      { exerciseId: "jumpingJack", sets: 3, reps: 20, restMs: 20000 },
      { exerciseId: "squat", sets: 2, reps: 12, restMs: 20000 },
    ],
  },
];

export function WorkoutMode() {
  const { settings } = useSettings();
  const [screen, setScreen] = useState<Screen>("builder");
  const [workout, setWorkout] = useState<WorkoutState>({
    name: "Custom",
    exercises: PRESET_WORKOUTS[0]!.exercises.map((e) => ({ ...e, id: uid() })),
    currentIndex: 0,
    currentSet: 0,
  });
  const [restMs, setRestMs] = useState(0);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(0);
  const [activeMs, setActiveMs] = useState(0);
  const [perExerciseSummary, setPerExerciseSummary] = useState<WorkoutSummaryExercise[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number>(0);

  const currentExDef = workout.exercises[workout.currentIndex]
    ? getExercise(workout.exercises[workout.currentIndex]!.exerciseId)
    : null;

  const cam = useCamera({
    active: cameraActive,
    facingMode: settings.camera.facingMode,
    quality: settings.camera.quality,
    mirrored: settings.camera.mirrored,
  });

  const runner = useExerciseRunner({
    definition: currentExDef ?? EXERCISE_LIST[0]!,
    mirrored: settings.camera.mirrored,
    enabled: !!currentExDef && cameraActive,
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

  useEffect(() => {
    if (runner.latestMessage) {
      voice.speak(runner.latestMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.latestMessage?.id]);

  // Watch for set completion
  const currentSetTarget = workout.exercises[workout.currentIndex]?.reps ?? 0;
  const isHold = currentExDef?.isHold ?? false;

  useEffect(() => {
    if (screen !== "session" || !cameraActive) return;
    if (isHold) {
      // For hold: monitor activeMs — when it exceeds holdMs, complete set
      const target = workout.exercises[workout.currentIndex]?.holdMs ?? 30000;
      if (runner.state.activeMs >= target) {
        completeCurrentSet();
      }
    } else if (runner.repCount >= currentSetTarget && currentSetTarget > 0) {
      completeCurrentSet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.repCount, runner.state.activeMs, screen, cameraActive]);

  // Active time accumulator
  useEffect(() => {
    if (screen !== "session") return;
    const id = setInterval(() => {
      setActiveMs((m) => m + 500);
    }, 500);
    return () => clearInterval(id);
  }, [screen]);

  // Rest timer
  useEffect(() => {
    if (screen !== "rest" || restMs <= 0) return;
    const id = setInterval(() => {
      setRestMs((m) => Math.max(0, m - 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [screen, restMs]);

  useEffect(() => {
    if (screen === "rest" && restMs === 0) {
      // Move to next set or exercise
      moveToNextSet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, restMs]);

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
    active: cameraActive && !!currentExDef,
    mirrored: settings.camera.mirrored,
    onFrame: handleFrame,
    targetFps: settings.pose.targetFps,
  });

  const totalSets = workout.exercises.reduce((s, e) => s + e.sets, 0);
  const completedSets = perExerciseSummary.reduce((s, e) => s + e.sets.filter((x) => x.completed).length, 0);

  function startWorkout(): void {
    setPerExerciseSummary(workout.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: [],
      totalReps: 0,
      avgFormScore: 0,
      bestFormScore: 0,
    })));
    setWorkout((w) => ({ ...w, currentIndex: 0, currentSet: 0 }));
    setActiveMs(0);
    setSessionStartedAt(Date.now());
    sessionStartRef.current = performance.now();
    setScreen("session");
    setCameraActive(true);
    runner.reset();
  }

  function completeCurrentSet(): void {
    const ex = workout.exercises[workout.currentIndex]!;
    const setIdx = workout.currentSet;
    const setSummary = {
      index: setIdx,
      reps: isHold ? 1 : runner.repCount,
      formScore: runner.breakdown.overall,
      durationMs: runner.state.activeMs,
      completed: true,
    };
    setPerExerciseSummary((prev) => {
      const copy = [...prev];
      const exSummary = copy[workout.currentIndex]!;
      exSummary.sets = [...exSummary.sets.filter((s) => s.index !== setIdx), setSummary];
      exSummary.totalReps = exSummary.sets.reduce((s, x) => s + x.reps, 0);
      exSummary.avgFormScore = Math.round(
        exSummary.sets.reduce((s, x) => s + x.formScore, 0) / Math.max(1, exSummary.sets.length),
      );
      exSummary.bestFormScore = Math.max(0, ...exSummary.sets.map((x) => x.formScore));
      return copy;
    });
    runner.reset();

    // Move to rest, then next set
    setRestMs(ex.restMs);
    setScreen("rest");
    setCameraActive(false);
  }

  function moveToNextSet(): void {
    const ex = workout.exercises[workout.currentIndex]!;
    const nextSet = workout.currentSet + 1;
    if (nextSet < ex.sets) {
      setWorkout((w) => ({ ...w, currentSet: nextSet }));
      setScreen("session");
      setCameraActive(true);
    } else {
      // Move to next exercise
      const nextIdx = workout.currentIndex + 1;
      if (nextIdx < workout.exercises.length) {
        setWorkout((w) => ({ ...w, currentIndex: nextIdx, currentSet: 0 }));
        setScreen("session");
        setCameraActive(true);
      } else {
        // Workout complete
        finishWorkout();
      }
    }
  }

  async function finishWorkout(): Promise<void> {
    const startedAt = sessionStartedAt;
    const endedAt = Date.now();
    const durationMs = endedAt - startedAt;
    const totalReps = perExerciseSummary.reduce((s, e) => s + e.totalReps, 0);
    const totalSets = perExerciseSummary.reduce((s, e) => s + e.sets.length, 0);
    const avgForm = perExerciseSummary.length > 0
      ? Math.round(perExerciseSummary.reduce((s, e) => s + e.avgFormScore, 0) / perExerciseSummary.length)
      : 0;
    const best = perExerciseSummary
      .filter((e) => e.sets.length > 0)
      .sort((a, b) => b.bestFormScore - a.bestFormScore)[0];
    // MET-based calorie estimate (very rough; labeled as estimate in UI)
    // Average body weight 70kg, MET ~5, active time in hours
    const hours = activeMs / 3_600_000;
    const estimatedCalories = Math.round(70 * 5 * hours);

    const finalSummary: WorkoutSummary = {
      sessionId: uid(),
      name: workout.name,
      startedAt,
      endedAt,
      durationMs,
      exercises: perExerciseSummary,
      totalSets,
      totalReps,
      avgFormScore: avgForm,
      bestExercise: best?.exerciseId,
      estimatedCalories,
      personalRecords: [],
    };

    // Save to IndexedDB
    await saveWorkout(finalSummary);

    // Update user stats (streak, totals)
    const prevStats = (await loadUserStats()) ?? {
      totalWorkouts: 0,
      totalReps: 0,
      totalActiveMs: 0,
      currentStreakDays: 0,
      bestStreakDays: 0,
      perExerciseBest: {},
      achievements: [],
    };
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = prevStats.lastWorkoutDate;
    let streak = prevStats.currentStreakDays;
    if (lastDate) {
      const diff = Math.round(
        (new Date(today).getTime() - new Date(lastDate).getTime()) / 86_400_000,
      );
      if (diff === 1) streak = prevStats.currentStreakDays + 1;
      else if (diff > 1) streak = 1;
      // diff === 0 → same day, no change
    } else {
      streak = 1;
    }
    const perExerciseBest = { ...prevStats.perExerciseBest } as typeof prevStats.perExerciseBest;
    for (const ex of finalSummary.exercises) {
      const cur = perExerciseBest[ex.exerciseId];
      if (!cur || ex.bestFormScore > cur.formScore) {
        perExerciseBest[ex.exerciseId] = {
          reps: Math.max(cur?.reps ?? 0, ex.totalReps),
          formScore: Math.max(cur?.formScore ?? 0, ex.bestFormScore),
        };
      }
    }
    const updatedStats = {
      ...prevStats,
      totalWorkouts: prevStats.totalWorkouts + 1,
      totalReps: prevStats.totalReps + totalReps,
      totalActiveMs: prevStats.totalActiveMs + activeMs,
      currentStreakDays: streak,
      bestStreakDays: Math.max(prevStats.bestStreakDays, streak),
      lastWorkoutDate: today,
      perExerciseBest,
      achievements: prevStats.achievements,
    };
    await saveUserStats(updatedStats);

    setSummary(finalSummary);
    setScreen("summary");
    setCameraActive(false);
    setRestMs(0);
  }

  function stopWorkout(): void {
    finishWorkout();
  }

  // ============= BUILDER SCREEN =============
  if (screen === "builder") {
    return (
      <WorkoutBuilder
        workout={workout}
        setWorkout={setWorkout}
        onStart={startWorkout}
        presets={PRESET_WORKOUTS}
      />
    );
  }

  // ============= SESSION SCREEN =============
  if (screen === "session" && currentExDef) {
    const ex = workout.exercises[workout.currentIndex]!;
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
            {/* Header */}
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 pt-safe">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-white/60">
                  Workout · {workout.name}
                </p>
                <h1 className="text-xl font-bold">{currentExDef.name}</h1>
              </div>
              <IconButton label="Stop workout" onClick={stopWorkout}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              </IconButton>
            </div>

            {/* Set counter */}
            <div className="absolute right-4 top-20 z-10 rounded-2xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Set</p>
              <p className="text-2xl font-bold text-lime-300">
                {workout.currentSet + 1}
                <span className="text-sm text-white/50"> / {ex.sets}</span>
              </p>
            </div>

            {/* Errors */}
            {(cam.error || pose.error) && (
              <div className="absolute left-4 right-4 top-24 z-10 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-200">
                {cam.error?.userMessage ?? pose.error}
              </div>
            )}

            {/* Bottom: rep counter + feedback */}
            {cameraActive && (
              <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-3 bg-gradient-to-t from-black to-transparent p-4 pb-safe">
                <div className="flex items-center justify-center">
                  <RepCounter
                    reps={runner.repCount}
                    target={ex.reps}
                    phase={runner.phase}
                    formScore={runner.breakdown.overall}
                    isHold={isHold}
                    holdMs={runner.state.activeMs}
                    holdTargetMs={ex.holdMs}
                  />
                </div>
                <div className="mx-auto w-full max-w-sm">
                  <FeedbackPanel
                    message={runner.latestMessage}
                    lowConfidence={runner.lowConfidence}
                  />
                </div>
                <div className="text-center text-[10px] text-white/40">
                  {completedSets} of {totalSets} sets complete · {formatDuration(activeMs)} active
                </div>
              </div>
            )}

            {/* Start CTA */}
            {!cameraActive && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center">
                <div>
                  <h2 className="text-2xl font-bold">{currentExDef.name}</h2>
                  <p className="text-sm text-white/60">
                    Set {workout.currentSet + 1} of {ex.sets} · Target: {ex.reps}{isHold ? `s hold` : " reps"}
                  </p>
                </div>
                <Button variant="primary" size="lg" onClick={() => setCameraActive(true)}>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20">▶</span>
                  Start set
                </Button>
              </div>
            )}
          </CameraView>
        </div>
      </div>
    );
  }

  // ============= REST SCREEN =============
  if (screen === "rest" && currentExDef) {
    const nextExercise = (() => {
      const ex = workout.exercises[workout.currentIndex]!;
      const nextSet = workout.currentSet + 1;
      if (nextSet < ex.sets) {
        return {
          name: currentExDef.name,
          set: nextSet + 1,
          sets: ex.sets,
        };
      }
      const nextIdx = workout.currentIndex + 1;
      if (nextIdx < workout.exercises.length) {
        return {
          name: getExercise(workout.exercises[nextIdx]!.exerciseId).name,
          set: 1,
          sets: workout.exercises[nextIdx]!.sets,
        };
      }
      return null;
    })();

    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-zinc-900 to-black p-6 text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Rest</p>
          <h1 className="mt-2 text-7xl font-bold tabular-nums text-lime-300">
            {Math.ceil(restMs / 1000)}
          </h1>
          <p className="text-xs text-white/50">seconds</p>
        </div>
        {nextExercise && (
          <Card className="w-full max-w-sm">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Next up</p>
            <p className="mt-1 text-xl font-bold">{nextExercise.name}</p>
            <p className="text-xs text-white/60">
              Set {nextExercise.set} of {nextExercise.sets}
            </p>
          </Card>
        )}
        <div className="flex gap-2">
          <Button onClick={() => setRestMs(0)}>Skip rest</Button>
          <Button variant="danger" onClick={stopWorkout}>End workout</Button>
        </div>
      </div>
    );
  }

  // ============= SUMMARY SCREEN =============
  if (screen === "summary" && summary) {
    return <WorkoutSummaryView summary={summary} onDone={() => setScreen("builder")} />;
  }

  return null;
}

// ============= BUILDER COMPONENT =============

interface BuilderProps {
  workout: WorkoutState;
  setWorkout: (w: WorkoutState | ((prev: WorkoutState) => WorkoutState)) => void;
  onStart: () => void;
  presets: typeof PRESET_WORKOUTS;
}

function WorkoutBuilder({ workout, setWorkout, onStart, presets }: BuilderProps) {
  const [showLibrary, setShowLibrary] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-zinc-950 p-4 pb-safe">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-white/50">Workout</p>
          <h1 className="text-2xl font-bold">Build your workout</h1>
        </div>

        {/* Presets */}
        <Card>
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
            Quick presets
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setWorkout((w) => ({
                    ...w,
                    name: p.name,
                    exercises: p.exercises.map((e) => ({ ...e, id: uid() })),
                    currentIndex: 0,
                    currentSet: 0,
                  }));
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  workout.name === p.name
                    ? "border-lime-300 bg-lime-300/10 text-lime-300"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Card>

        {/* Exercise list */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              Exercises ({workout.exercises.length})
            </p>
            <Button size="sm" variant="primary" onClick={() => setShowLibrary(true)}>
              + Add
            </Button>
          </div>
          {workout.exercises.length === 0 ? (
            <p className="text-sm text-white/50">
              No exercises added yet. Pick from the library to start building.
            </p>
          ) : (
            <ol className="space-y-2">
              {workout.exercises.map((ex, idx) => {
                const def = getExercise(ex.exerciseId);
                return (
                  <li
                    key={ex.id}
                    className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-300 text-sm font-bold text-black">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{def.name}</p>
                      <p className="text-xs text-white/50">
                        {def.isHold ? `${ex.sets} × ${ex.holdMs ? Math.round(ex.holdMs / 1000) : 30}s hold` : `${ex.sets} × ${ex.reps} reps`}
                        {" · "}rest {Math.round(ex.restMs / 1000)}s
                      </p>
                    </div>
                    {!def.isHold && (
                      <div className="flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setWorkout((w) => {
                            const copy = [...w.exercises];
                            copy[idx] = { ...ex, reps: Math.max(1, ex.reps - 1) };
                            return { ...w, exercises: copy };
                          })}
                          className="rounded p-1 hover:bg-white/10"
                        >
                          −
                        </button>
                        <span className="w-6 text-center">{ex.reps}</span>
                        <button
                          type="button"
                          onClick={() => setWorkout((w) => {
                            const copy = [...w.exercises];
                            copy[idx] = { ...ex, reps: ex.reps + 1 };
                            return { ...w, exercises: copy };
                          })}
                          className="rounded p-1 hover:bg-white/10"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <IconButton
                      label="Remove exercise"
                      onClick={() => setWorkout((w) => ({
                        ...w,
                        exercises: w.exercises.filter((_, i) => i !== idx),
                      }))}
                      className="h-8 w-8"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </IconButton>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={workout.exercises.length === 0}
          onClick={onStart}
        >
          Start workout
        </Button>
      </div>

      {/* Exercise picker */}
      <Sheet open={showLibrary} onClose={() => setShowLibrary(false)} title="Add exercise">
        <div className="grid grid-cols-2 gap-3">
          {EXERCISE_LIST.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                setWorkout((w) => ({
                  ...w,
                  exercises: [
                    ...w.exercises,
                    {
                      id: uid(),
                      exerciseId: ex.id,
                      sets: ex.defaultSets,
                      reps: ex.defaultReps,
                      restMs: 30000,
                      holdMs: ex.defaultHoldMs,
                    },
                  ],
                }));
                setShowLibrary(false);
              }}
              className="flex flex-col items-start gap-1 rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
            >
              <span className="text-sm font-bold">{ex.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                {ex.difficulty}
              </span>
              <span className="text-[10px] text-white/50">
                {ex.targetMuscles.join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

// ============= SUMMARY VIEW COMPONENT =============

interface SummaryViewProps {
  summary: WorkoutSummary;
  onDone: () => void;
}

function WorkoutSummaryView({ summary, onDone }: SummaryViewProps) {
  const stats = [
    { label: "Duration", value: formatDuration(summary.durationMs) },
    { label: "Exercises", value: summary.exercises.length },
    { label: "Total Sets", value: summary.totalSets },
    { label: "Total Reps", value: summary.totalReps },
    { label: "Avg Form", value: `${summary.avgFormScore}%` },
    { label: "Calories (est)", value: summary.estimatedCalories },
  ];
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-zinc-900 to-black p-4 pb-safe">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.34em] text-lime-300">Workout Complete</p>
          <h1 className="mt-2 text-3xl font-bold">{summary.name}</h1>
          <p className="mt-1 text-sm text-white/60">
            {new Date(summary.startedAt).toLocaleString()}
          </p>
        </div>

        <Card>
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
            Today's Performance
          </p>
          <div className="space-y-2">
            <SummaryBar label="Form" percent={summary.avgFormScore} />
            <SummaryBar label="Consistency" percent={Math.min(100, Math.round((summary.totalSets / Math.max(1, summary.totalSets)) * 100))} />
            <SummaryBar label="Mobility" percent={Math.min(100, summary.avgFormScore - 5)} />
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <Card key={s.label} className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                {s.label}
              </p>
              <p className="text-xl font-bold text-lime-300">{s.value}</p>
            </Card>
          ))}
        </div>

        <Card>
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
            Per-exercise breakdown
          </p>
          <div className="space-y-2">
            {summary.exercises.map((ex) => {
              const def = getExercise(ex.exerciseId);
              return (
                <div key={ex.exerciseId} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-bold">{def.name}</p>
                    <p className="text-[10px] text-white/50">
                      {ex.sets.length} sets · {ex.totalReps} reps
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-lime-300">{ex.avgFormScore}%</p>
                    <p className="text-[10px] text-white/50">best: {ex.bestFormScore}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border-yellow-300/20 bg-yellow-300/5">
          <p className="text-xs text-yellow-200/80">
            <strong>Calorie estimate:</strong> The calorie number shown is a rough estimate based on METs and an assumed body weight. It is not a precise measurement.
          </p>
        </Card>

        <Button variant="primary" size="lg" className="w-full" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function SummaryBar({ label, percent }: { label: string; percent: number }) {
  const color = percent >= 80 ? "bg-lime-300" : percent >= 60 ? "bg-yellow-300" : "bg-red-400";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="font-mono text-white">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full bar-fill rounded-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
