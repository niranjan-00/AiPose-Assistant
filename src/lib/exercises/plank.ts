/**
 * Plank — isometric hold. Time-based; rep detection tracks "settled into
 * plank" → "hold maintained" → "broke form" (no rep completes; we measure hold
 * duration via activeMs in the runner state).
 *
 * For the workout system, plank is a `isHold` exercise where the user holds
 * the position for the target duration. We still emit form feedback throughout.
 */
import type { ExerciseDefinition } from "@/types/exercise";

export const PLANK: ExerciseDefinition = {
  id: "plank",
  name: "Plank",
  description:
    "Hold a straight body line on your forearms and toes. Don't let your hips sag or pike. Breathe steadily.",
  difficulty: "beginner",
  targetMuscles: ["core", "shoulders", "back"],
  requiredKeypoints: [
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "left_ankle",
    "right_ankle",
  ],
  angleRules: [
    {
      label: "Left Body",
      points: ["left_shoulder", "left_hip", "left_ankle"],
      target: 180,
      tolerance: 15,
    },
    {
      label: "Right Body",
      points: ["right_shoulder", "right_hip", "right_ankle"],
      target: 180,
      tolerance: 15,
    },
  ],
  repDetectionRules: [
    {
      // ready → descending (entering plank position)
      from: "ready",
      to: "descending",
      minDwellMs: 500,
      condition: (ctx) => {
        const lb = ctx.angles["Left Body"];
        const rb = ctx.angles["Right Body"];
        if (Number.isNaN(lb) && Number.isNaN(rb)) return false;
        const avg = !Number.isNaN(lb) && !Number.isNaN(rb)
          ? (lb + rb) / 2
          : !Number.isNaN(lb) ? lb : rb!;
        return avg > 165 && avg < 195;
      },
    },
    // Plank is a hold — we don't transition further; the workout system tracks
    // accumulated time in "descending" state.
  ],
  formRules: [
    {
      id: "plank-body-line",
      description: "Keep your body in a straight line",
      cue: "Straighten your body line",
      severity: "error",
      evaluate: (ctx) => {
        const lb = ctx.angles["Left Body"];
        const rb = ctx.angles["Right Body"];
        if (Number.isNaN(lb) && Number.isNaN(rb)) return 0.5;
        const avg = !Number.isNaN(lb) && !Number.isNaN(rb)
          ? (lb + rb) / 2
          : !Number.isNaN(lb) ? lb : rb!;
        if (avg > 170 && avg < 190) return 1;
        if (avg > 160 && avg < 200) return 0.6;
        return 0.2;
      },
    },
    {
      id: "plank-hips-down",
      description: "Don't let hips sag",
      cue: "Lift your hips slightly",
      severity: "warning",
      evaluate: (ctx) => {
        const lb = ctx.angles["Left Body"];
        const rb = ctx.angles["Right Body"];
        if (Number.isNaN(lb) && Number.isNaN(rb)) return 0.5;
        const avg = !Number.isNaN(lb) && !Number.isNaN(rb)
          ? (lb + rb) / 2
          : !Number.isNaN(lb) ? lb : rb!;
        // Hips sag → angle < 170
        if (avg < 170) return 0.3;
        return 1;
      },
    },
    {
      id: "plank-hips-up",
      description: "Don't let hips pike up",
      cue: "Lower your hips slightly",
      severity: "warning",
      evaluate: (ctx) => {
        const lb = ctx.angles["Left Body"];
        const rb = ctx.angles["Right Body"];
        if (Number.isNaN(lb) && Number.isNaN(rb)) return 0.5;
        const avg = !Number.isNaN(lb) && !Number.isNaN(rb)
          ? (lb + rb) / 2
          : !Number.isNaN(lb) ? lb : rb!;
        // Hips pike → angle > 190
        if (avg > 195) return 0.3;
        return 1;
      },
    },
  ],
  commonMistakes: [
    {
      id: "hips-sag",
      name: "Hips sagging",
      description: "Lower back sags → lower-back strain and reduced core activation.",
      cue: "Squeeze glutes, lift hips in line",
    },
    {
      id: "hips-pike",
      name: "Hips piking up",
      description: "Hips too high reduces plank effectiveness.",
      cue: "Bring hips down to shoulder line",
    },
    {
      id: "head-down",
      name: "Head dropped",
      description: "Looking down rounds the upper back and strains the neck.",
      cue: "Keep neck neutral, gaze at floor",
    },
  ],
  defaultReps: 1,
  defaultSets: 3,
  isHold: true,
  defaultHoldMs: 30000,
};
