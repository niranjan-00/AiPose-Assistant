/**
 * Workout types — builder, session, sets, summary.
 */
import type { ExerciseId } from "./exercise";

export interface WorkoutExercise {
  id: string;
  exerciseId: ExerciseId;
  sets: number;
  /** Target reps per set (ignored if isHold) */
  reps: number;
  /** Rest duration in ms between sets */
  restMs: number;
  /** For hold exercises: hold duration in ms */
  holdMs?: number;
}

export interface WorkoutSet {
  index: number;
  reps: number;
  /** 0..100 form score */
  formScore: number;
  /** ms the set took (excluding rest) */
  durationMs: number;
  completed: boolean;
}

export interface WorkoutSummaryExercise {
  exerciseId: ExerciseId;
  sets: WorkoutSet[];
  totalReps: number;
  avgFormScore: number;
  bestFormScore: number;
}

export type WorkoutSessionStatus = "active" | "rest" | "complete" | "abandoned";

export interface WorkoutSession {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  /** Index of the currently-active exercise in `exercises` */
  currentIndex: number;
  /** Index of the current set within the current exercise */
  currentSet: number;
  status: WorkoutSessionStatus;
  startedAt: number;
  endedAt?: number;
  /** Per-exercise summary filled in as sets complete */
  summary: WorkoutSummaryExercise[];
  /** ms accumulator for the whole session (active only, not rest) */
  activeMs: number;
}

export interface WorkoutSummary {
  sessionId: string;
  name: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  exercises: WorkoutSummaryExercise[];
  totalSets: number;
  totalReps: number;
  avgFormScore: number;
  bestExercise?: ExerciseId;
  /** Calorie estimate (clearly labeled as estimate in UI) */
  estimatedCalories: number;
  personalRecords: PersonalRecord[];
}

export interface PersonalRecord {
  type: "reps" | "form" | "streak" | "duration" | "first_workout" | "milestone";
  exerciseId?: ExerciseId;
  value: number;
  achievedAt: number;
  label: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Achievement is unlocked when this returns true given the user's stats */
  isUnlocked: (stats: UserStats) => boolean;
  /** Icon (emoji) for display */
  icon: string;
}

export interface UserStats {
  totalWorkouts: number;
  totalReps: number;
  totalActiveMs: number;
  currentStreakDays: number;
  bestStreakDays: number;
  lastWorkoutDate?: string;
  perExerciseBest: Partial<Record<ExerciseId, { reps: number; formScore: number }>>;
  achievements: string[];
}

export interface DashboardDay {
  date: string;
  workoutCount: number;
  totalReps: number;
  activeMs: number;
  avgFormScore: number;
}

export interface DashboardData {
  today: {
    workoutCount: number;
    totalReps: number;
    activeMs: number;
    avgFormScore: number;
  };
  weekly: DashboardDay[];
  totals: {
    workouts: number;
    reps: number;
    activeMs: number;
    avgFormScore: number;
    currentStreakDays: number;
    bestStreakDays: number;
  };
  recentSessions: WorkoutSummary[];
  perExercisePerformance: Array<{
    exerciseId: ExerciseId;
    sessions: number;
    totalReps: number;
    avgFormScore: number;
    bestFormScore: number;
  }>;
  personalRecords: PersonalRecord[];
  achievements: Achievement[];
}
