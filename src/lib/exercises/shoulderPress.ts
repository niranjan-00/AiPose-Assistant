/**
 * Shoulder Press — elbow extension cycle (pressing upward).
 * Detects: ready (elbow ~90°) → descending (elbow > 110, arm going up)
 * Actually for press: starting position is elbow bent ~90°. Press up = arm straightens
 * (elbow → 180°). Come back down = elbow → 90°.
 *
 *   ready (90°) → descending (arm going up → elbow > 130)
 *              → bottom (top of press, elbow > 165)
 *              → ascending (coming down, elbow < 150)
 *              → rep_completed (back to 90°)
 */
import type { ExerciseDefinition } from "@/types/exercise";

export const SHOULDER_PRESS: ExerciseDefinition = {
  id: "shoulderPress",
  name: "Shoulder Press",
  description:
    "Start with hands at shoulder height, elbows bent. Press upward until arms are fully extended, then lower with control.",
  difficulty: "intermediate",
  targetMuscles: ["shoulders", "arms"],
  requiredKeypoints: [
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
  ],
  angleRules: [
    {
      label: "Left Elbow",
      points: ["left_shoulder", "left_elbow", "left_wrist"],
      target: 90,
      tolerance: 30,
    },
    {
      label: "Right Elbow",
      points: ["right_shoulder", "right_elbow", "right_wrist"],
      target: 90,
      tolerance: 30,
    },
  ],
  repDetectionRules: [
    {
      from: "ready",
      to: "descending",
      minDwellMs: 200,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return false;
        const max = !Number.isNaN(le) && !Number.isNaN(re)
          ? Math.max(le, re)
          : !Number.isNaN(le) ? le : re!;
        return max > 130;
      },
    },
    {
      from: "descending",
      to: "bottom",
      minDwellMs: 200,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return false;
        const max = !Number.isNaN(le) && !Number.isNaN(re)
          ? Math.max(le, re)
          : !Number.isNaN(le) ? le : re!;
        return max > 165;
      },
    },
    {
      from: "bottom",
      to: "ascending",
      minDwellMs: 150,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return false;
        const min = !Number.isNaN(le) && !Number.isNaN(re)
          ? Math.min(le, re)
          : !Number.isNaN(le) ? le : re!;
        return min < 150;
      },
    },
    {
      from: "ascending",
      to: "rep_completed",
      minDwellMs: 200,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return false;
        const max = !Number.isNaN(le) && !Number.isNaN(re)
          ? Math.max(le, re)
          : !Number.isNaN(le) ? le : re!;
        return max < 110;
      },
    },
  ],
  formRules: [
    {
      id: "press-full-extension",
      description: "Press to full extension",
      cue: "Press all the way up",
      severity: "info",
      evaluate: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return 0.5;
        const max = Math.max(
          ...(Number.isNaN(le) ? [] : [le]),
          ...(Number.isNaN(re) ? [] : [re]),
        );
        if (ctx.state === "bottom") {
          if (max < 165) return 0.4;
          return 1;
        }
        return 0.8;
      },
    },
    {
      id: "press-symmetry",
      description: "Press both arms in sync",
      cue: "Press both arms together",
      severity: "info",
      evaluate: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) || Number.isNaN(re)) return 0.5;
        const delta = Math.abs(le - re);
        if (delta < 15) return 1;
        if (delta < 30) return 0.6;
        return 0.3;
      },
    },
  ],
  commonMistakes: [
    {
      id: "partial-press",
      name: "Partial extension",
      description: "Not locking out at the top limits muscle activation.",
      cue: "Press to full lockout",
    },
    {
      id: "arch-back",
      name: "Arching the lower back",
      description: "Leaning back shifts load away from shoulders and strains the back.",
      cue: "Squeeze glutes, stay tall",
    },
    {
      id: "uneven-press",
      name: "Pressing unevenly",
      description: "One arm leading the other indicates strength imbalance.",
      cue: "Press both arms in sync",
    },
  ],
  defaultReps: 10,
  defaultSets: 3,
};
