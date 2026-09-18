/**
 * Exercise engine types — used by the rep-counting state machine, form analysis,
 * scoring, and coaching engines.
 */
import type { KeypointName, PoseFrame, Severity } from "./pose";

// Re-export so consumers can import them from one place.
export type { KeypointName, PoseFrame, Severity };

export type ExerciseId =
  | "squat"
  | "pushup"
  | "plank"
  | "lunge"
  | "bicepCurl"
  | "shoulderPress"
  | "situp"
  | "jumpingJack";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type RepPhase =
  | "ready"
  | "descending"
  | "bottom"
  | "ascending"
  | "rep_completed";

/** State machine state for one exercise rep cycle. */
export type ExerciseState =
  | "ready"
  | "descending"
  | "bottom"
  | "ascending"
  | "rep_completed";

export type MuscleGroup =
  | "legs"
  | "glutes"
  | "core"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "full_body"
  | "cardio";

export interface AngleRule {
  /** Human-readable name shown in UI */
  label: string;
  /** Three keypoints forming the angle: vertex is index 1 */
  points: [KeypointName, KeypointName, KeypointName];
  /** Minimum acceptable angle in degrees */
  min?: number;
  /** Maximum acceptable angle in degrees */
  max?: number;
  /** Ideal target angle in degrees */
  target?: number;
  /** Tolerance band in degrees either side of target */
  tolerance?: number;
}

export interface FormRule {
  id: string;
  description: string;
  /** Function evaluated against a pose frame; returns 0..1 score (1 = perfect) */
  evaluate: (ctx: ExerciseContext) => number;
  /** Coaching cue shown when score < 0.6 */
  cue: string;
  severity: Severity;
}

export interface RepDetectionRule {
  /** State to transition FROM */
  from: ExerciseState;
  /** State to transition TO */
  to: ExerciseState;
  /** Predicate that must be true */
  condition: (ctx: ExerciseContext) => boolean;
  /** Minimum dwell time in the FROM state before transition is allowed (ms) */
  minDwellMs?: number;
}

export interface CommonMistake {
  id: string;
  name: string;
  description: string;
  cue: string;
}

export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  description: string;
  difficulty: Difficulty;
  targetMuscles: MuscleGroup[];
  requiredKeypoints: KeypointName[];
  /** Angles the engine tracks continuously */
  angleRules: AngleRule[];
  /** Transitions that drive the rep state machine */
  repDetectionRules: RepDetectionRule[];
  /** Per-frame form checks */
  formRules: FormRule[];
  /** Library of common mistakes for the exercise details UI */
  commonMistakes: CommonMistake[];
  /** Default rep target for workout builder */
  defaultReps: number;
  /** Default set count for workout builder */
  defaultSets: number;
  /** For time-based exercises (plank): target hold duration in ms */
  isHold?: boolean;
  /** Default hold duration when used in a workout */
  defaultHoldMs?: number;
  /** Reps counted as 1 every N cycles (jumping jacks = 2 cycles per rep) */
  cyclesPerRep?: number;
}

/** Per-frame context passed to exercise evaluators. */
export interface ExerciseContext {
  frame: PoseFrame;
  /** Map of keypoint name -> keypoint (only those with score >= threshold) */
  keypoints: Map<KeypointName, { x: number; y: number; score: number }>;
  /** Computed joint angles by AngleRule label */
  angles: Record<string, number>;
  /** Current state machine state */
  state: ExerciseState;
  /** ms the user has been in `state` */
  dwellMs: number;
  /** Total reps counted (before this frame) */
  repCount: number;
  /** True if user is mirrored (front camera) */
  mirrored: boolean;
  /** Average keypoint confidence 0..1 */
  confidence: number;
}

export interface FormFeedback {
  ruleId: string;
  description: string;
  cue: string;
  score: number;
  severity: Severity;
}

export interface FormScoreBreakdown {
  overall: number;
  form: number;
  rangeOfMotion: number;
  symmetry: number;
  tempo: number;
  stability: number;
}

export interface ExerciseResult {
  exerciseId: ExerciseId;
  reps: number;
  /** 0..100 overall form score averaged across completed reps */
  formScore: number;
  /** 0..100 average across score components */
  scoreBreakdown: FormScoreBreakdown;
  /** ms spent performing */
  durationMs: number;
  /** Average rep duration ms */
  avgRepMs: number;
  /** Best (highest) form score across reps */
  bestRepScore: number;
  /** Timestamp */
  startedAt: number;
  endedAt: number;
}

export interface CoachingMessage {
  id: string;
  text: string;
  severity: Severity;
  /** ms timestamp when emitted */
  timestamp: number;
  /** Optional source rule id (for dedup) */
  ruleId?: string;
}
