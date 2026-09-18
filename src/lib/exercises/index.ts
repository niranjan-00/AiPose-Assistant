/**
 * Exercise registry — the single source of truth for exercises.
 * To add a new exercise, create a definition file and register it here.
 * No other code changes needed; the rest of the app reads from this registry.
 */
import type { ExerciseDefinition, ExerciseId } from "@/types/exercise";
import { SQUAT } from "./squat";
import { PUSHUP } from "./pushup";
import { PLANK } from "./plank";
import { LUNGE } from "./lunge";
import { BICEP_CURL } from "./bicepCurl";
import { SHOULDER_PRESS } from "./shoulderPress";
import { SITUP } from "./situp";
import { JUMPING_JACK } from "./jumpingJack";

export const EXERCISES: Record<ExerciseId, ExerciseDefinition> = {
  squat: SQUAT,
  pushup: PUSHUP,
  plank: PLANK,
  lunge: LUNGE,
  bicepCurl: BICEP_CURL,
  shoulderPress: SHOULDER_PRESS,
  situp: SITUP,
  jumpingJack: JUMPING_JACK,
};

export const EXERCISE_LIST: ExerciseDefinition[] = Object.values(EXERCISES);

export function getExercise(id: ExerciseId): ExerciseDefinition {
  const def = EXERCISES[id];
  if (!def) {
    throw new Error(`Unknown exercise: ${id}`);
  }
  return def;
}

export function getExerciseSafe(id: string): ExerciseDefinition | undefined {
  return (EXERCISES as Record<string, ExerciseDefinition>)[id];
}

export { SQUAT, PUSHUP, PLANK, LUNGE, BICEP_CURL, SHOULDER_PRESS, SITUP, JUMPING_JACK };
