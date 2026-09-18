/**
 * Exercise engine — state-machine-based repetition detection + form analysis.
 *
 * The engine is a pure function: given (definition, previousState, frame) it
 * produces (nextState, repDelta, formFeedback, scoreComponents). It has no
 * DOM dependencies and is fully unit-testable.
 *
 * Rep state machine:
 *
 *   READY ──descend──> DESCENDING ──hit bottom──> BOTTOM ──ascend──> ASCENDING
 *     ▲                                                                  │
 *     └─────────────────────── rep completed ────────────────────────────┘
 *
 * Each transition is gated by:
 *   - `repDetectionRules[i].condition(ctx)` returns true
 *   - `repDetectionRules[i].minDwellMs` elapsed in the FROM state
 *   - average keypoint confidence >= REP_MIN_CONFIDENCE
 *
 * This avoids the classic "increment on every frame where angle crossed threshold"
 * bug — the user must complete a full down→up cycle to register one rep.
 */
import type {
  ExerciseContext,
  ExerciseDefinition,
  ExerciseState,
  FormFeedback,
  FormScoreBreakdown,
  KeypointName,
  PoseFrame,
} from "@/types/exercise";
import {
  ANGLE_MIN_CONFIDENCE,
  REP_MIN_CONFIDENCE,
} from "@/constants/pose";
import { averageConfidence, jointAngle } from "@/lib/pose/keypoints";

export interface ExerciseRunnerState {
  state: ExerciseState;
  /** Monotonic ms timestamp when the user entered the current state */
  stateEnteredAt: number;
  /** Total reps counted */
  repCount: number;
  /** Per-rep form scores (last N) for averaging */
  repScores: number[];
  /** Per-rep duration in ms */
  repDurations: number[];
  /** Per-rep score breakdown components for averaging */
  repBreakdowns: FormScoreBreakdown[];
  /** ms timestamp when the rep cycle started (entered DESCENDING) */
  cycleStartedAt: number;
  /** Last computed angles (for stability calc) */
  lastAngles: Record<string, number>;
  /** Buffer of recent angles (for stability) */
  angleHistory: Array<Record<string, number>>;
  /** Per-form-rule rolling scores for stability averaging */
  formRuleScores: Record<string, number[]>;
  /** ms the user has been performing this exercise (active only) */
  activeMs: number;
  startedAt: number;
  /** last frame timestamp seen */
  lastFrameAt: number;
}

export interface ExerciseRunnerInput {
  definition: ExerciseDefinition;
  state: ExerciseRunnerState;
  frame: PoseFrame;
  mirrored: boolean;
  /** ms timestamp (e.g. performance.now()) */
  now: number;
}

export interface ExerciseRunnerOutput {
  state: ExerciseRunnerState;
  /** +1 if a rep completed this frame, else 0 */
  repDelta: number;
  /** Per-frame form feedback (one entry per failing rule) */
  feedback: FormFeedback[];
  /** Per-frame score breakdown */
  breakdown: FormScoreBreakdown;
  /** Computed angles (deg) by rule label */
  angles: Record<string, number>;
  /** Current phase label for UI */
  phase: string;
  /** True if low confidence — UI should warn user */
  lowConfidence: boolean;
}

export function createRunnerState(now: number): ExerciseRunnerState {
  return {
    state: "ready",
    stateEnteredAt: now,
    repCount: 0,
    repScores: [],
    repDurations: [],
    repBreakdowns: [],
    cycleStartedAt: now,
    lastAngles: {},
    angleHistory: [],
    formRuleScores: {},
    activeMs: 0,
    startedAt: now,
    lastFrameAt: now,
  };
}

/**
 * Build the context that's passed to every rule function.
 * Pure function of (definition, frame, runnerState, now).
 */
export function buildContext(
  _definition: ExerciseDefinition,
  frame: PoseFrame,
  runnerState: ExerciseRunnerState,
  mirrored: boolean,
  now: number,
  angles: Record<string, number>,
): ExerciseContext {
  const kpMap = new Map<KeypointName, { x: number; y: number; score: number }>();
  for (const kp of frame.keypoints) {
    if (kp.score >= 0.2) {
      kpMap.set(kp.name, { x: kp.x, y: kp.y, score: kp.score });
    }
  }
  const confidence = averageConfidence(frame.keypoints);
  return {
    frame,
    keypoints: kpMap,
    angles,
    state: runnerState.state,
    dwellMs: now - runnerState.stateEnteredAt,
    repCount: runnerState.repCount,
    mirrored,
    confidence,
  };
}

/**
 * Compute all angle rules in the definition.
 * Pure function.
 */
export function computeAngles(
  definition: ExerciseDefinition,
  frame: PoseFrame,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rule of definition.angleRules) {
    const [a, b, c] = rule.points;
    out[rule.label] = jointAngle(frame.keypoints, a, b, c, ANGLE_MIN_CONFIDENCE);
  }
  return out;
}

/**
 * Evaluate all form rules for a frame. Returns feedback for rules that
 * scored below threshold.
 */
export function evaluateFormRules(
  definition: ExerciseDefinition,
  ctx: ExerciseContext,
): FormFeedback[] {
  const out: FormFeedback[] = [];
  for (const rule of definition.formRules) {
    let score = 0;
    try {
      score = Math.max(0, Math.min(1, rule.evaluate(ctx)));
    } catch {
      score = 0;
    }
    if (score < 0.6) {
      out.push({
        ruleId: rule.id,
        description: rule.description,
        cue: rule.cue,
        score,
        severity: rule.severity,
      });
    }
  }
  return out;
}

/**
 * Score components for the current frame / accumulated state.
 *
 * - Form: average of all form rule scores this frame (1..0 → 100..0)
 * - ROM (range of motion): how close the deepest angle got to its target
 * - Symmetry: left/right angle difference (smaller = better)
 * - Tempo: rep duration vs target band (1.5–4 s ideal)
 * - Stability: variance of angles over the last 5 frames (lower = better)
 */
export function computeScoreBreakdown(
  definition: ExerciseDefinition,
  ctx: ExerciseContext,
  runnerState: ExerciseRunnerState,
): FormScoreBreakdown {
  // Form: average of all form rule scores, scaled to 0..100.
  let formSum = 0;
  let formCount = 0;
  for (const rule of definition.formRules) {
    let s = 0;
    try {
      s = Math.max(0, Math.min(1, rule.evaluate(ctx)));
    } catch {
      s = 0.5;
    }
    formSum += s;
    formCount++;
  }
  const form = formCount > 0 ? Math.round((formSum / formCount) * 100) : 70;

  // ROM: pick the primary angle rule (the first one) and measure how close
  // the current angle is to its target.
  const primary = definition.angleRules[0];
  let rom = 70;
  if (primary && primary.target !== undefined) {
    const ang = ctx.angles[primary.label];
    if (!Number.isNaN(ang)) {
      const tol = primary.tolerance ?? 20;
      const delta = Math.abs(ang - primary.target);
      const s = Math.max(0, 1 - delta / (tol * 2));
      rom = Math.round(s * 100);
    }
  }

  // Symmetry: compare left vs right angle if available.
  // For exercises with "left_*" and "right_*" keypoints, we attempt a mirrored
  // angle rule and use the delta.
  let symmetry = 85;
  for (const rule of definition.angleRules) {
    if (rule.label.startsWith("Left ") || rule.label.startsWith("Right ")) {
      const other = rule.label.startsWith("Left ")
        ? ctx.angles["Right " + rule.label.slice(5)]
        : ctx.angles["Left " + rule.label.slice(6)];
      const cur = ctx.angles[rule.label];
      if (other !== undefined && !Number.isNaN(other) && cur !== undefined && !Number.isNaN(cur)) {
        const delta = Math.abs(cur - other);
        const s = Math.max(0, 1 - delta / 30);
        symmetry = Math.round(s * 100);
        break;
      }
    }
  }

  // Tempo: based on average rep duration.
  let tempo = 80;
  const avgRepMs =
    runnerState.repDurations.length > 0
      ? runnerState.repDurations.reduce((s, d) => s + d, 0) /
        runnerState.repDurations.length
      : 0;
  if (avgRepMs > 0) {
    if (avgRepMs >= 1500 && avgRepMs <= 4000) tempo = 95;
    else if (avgRepMs < 800) tempo = 50; // too fast
    else if (avgRepMs > 6000) tempo = 60; // too slow
    else tempo = 80;
  }

  // Stability: variance of recent angles (lower = better).
  let stability = 85;
  const hist = runnerState.angleHistory;
  if (hist.length >= 3) {
    let totalVariance = 0;
    let angleCount = 0;
    const labels = Object.keys(hist[0]!);
    for (const label of labels) {
      const values = hist
        .map((h) => h[label])
        .filter((v) => v !== undefined && !Number.isNaN(v));
      if (values.length < 3) continue;
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance =
        values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
      totalVariance += Math.sqrt(variance);
      angleCount++;
    }
    if (angleCount > 0) {
      const avgStd = totalVariance / angleCount;
      // 0 deg std → 100; 15 deg std → 50
      const s = Math.max(0, 1 - avgStd / 30);
      stability = Math.round(s * 100);
    }
  }

  const overall = Math.round(
    0.35 * form + 0.2 * rom + 0.15 * symmetry + 0.15 * tempo + 0.15 * stability,
  );

  return { overall, form, rangeOfMotion: rom, symmetry, tempo, stability };
}

/**
 * Advance the state machine one frame.
 * Pure function: returns the next runner state + rep delta + feedback.
 */
export function advanceRunner(input: ExerciseRunnerInput): ExerciseRunnerOutput {
  const { definition, frame, mirrored, now } = input;
  const prevState = input.state;
  const angles = computeAngles(definition, frame);
  const ctx = buildContext(definition, frame, prevState, mirrored, now, angles);

  // Confidence gate
  const lowConfidence = ctx.confidence < REP_MIN_CONFIDENCE;

  // Try state transitions
  let nextState = prevState.state;
  let repDelta = 0;

  if (!lowConfidence) {
    for (const rule of definition.repDetectionRules) {
      if (rule.from !== prevState.state) continue;
      const dwellMs = now - prevState.stateEnteredAt;
      const minDwell = rule.minDwellMs ?? 0;
      if (dwellMs < minDwell) continue;
      let ok = false;
      try {
        ok = rule.condition(ctx);
      } catch {
        ok = false;
      }
      if (ok) {
        nextState = rule.to;
        // Rep completes on the ascending → rep_completed transition.
        if (rule.to === "rep_completed") {
          repDelta = 1;
          // Compute this rep's duration: cycleStartedAt → now
          const repMs = now - prevState.cycleStartedAt;
          // Score the rep with the breakdown computed for this frame.
          const repBreakdown = computeScoreBreakdown(definition, ctx, prevState);
          prevState.repScores.push(repBreakdown.overall);
          prevState.repDurations.push(repMs);
          prevState.repBreakdowns.push(repBreakdown);
          if (prevState.repScores.length > 60) prevState.repScores.shift();
          if (prevState.repDurations.length > 60) prevState.repDurations.shift();
          if (prevState.repBreakdowns.length > 60) prevState.repBreakdowns.shift();
          // Reset cycle for next rep.
          prevState.cycleStartedAt = now;
        }
        // Reset dwell timer on transition.
        prevState.stateEnteredAt = now;
        break;
      }
    }
  }

  // Update angle history buffer (for stability).
  const angleHistory = [...prevState.angleHistory, angles];
  if (angleHistory.length > 6) angleHistory.shift();

  const effectiveState: ExerciseState =
    nextState === "rep_completed" ? "ready" : nextState;
  const nextRunnerState: ExerciseRunnerState = {
    ...prevState,
    state: effectiveState,
    lastAngles: angles,
    angleHistory,
    activeMs: prevState.activeMs + (now - prevState.lastFrameAt),
    lastFrameAt: now,
    // Re-point the cycle start if we just exited a completed rep cycle.
    cycleStartedAt:
      nextState === "rep_completed" ? now : prevState.cycleStartedAt,
    stateEnteredAt:
      nextState === "rep_completed" ? now : prevState.stateEnteredAt,
  };

  const feedback = lowConfidence ? [] : evaluateFormRules(definition, ctx);
  const breakdown = computeScoreBreakdown(definition, ctx, nextRunnerState);

  return {
    state: nextRunnerState,
    repDelta,
    feedback,
    breakdown,
    angles,
    phase: phaseLabel(nextRunnerState.state),
    lowConfidence,
  };
}

export function phaseLabel(state: ExerciseState): string {
  switch (state) {
    case "ready":
      return "Ready";
    case "descending":
      return "Down";
    case "bottom":
      return "Bottom";
    case "ascending":
      return "Up";
    case "rep_completed":
      return "Rep!";
  }
}

/**
 * Average form score across all reps completed.
 */
export function averageRepScore(state: ExerciseRunnerState): number {
  if (state.repScores.length === 0) return 0;
  return Math.round(
    state.repScores.reduce((s, v) => s + v, 0) / state.repScores.length,
  );
}

/**
 * Best (highest) rep form score.
 */
export function bestRepScore(state: ExerciseRunnerState): number {
  if (state.repScores.length === 0) return 0;
  return Math.round(Math.max(...state.repScores));
}
