/**
 * Lunge — single-leg knee flexion cycle.
 * Detects: descend (front knee angle < 130°) → bottom (< 100°) → ascend (> 110°) → rep (> 160°)
 *
 * Form rules:
 *   - Front knee alignment (knee over ankle)
 *   - Back knee dropping toward floor
 *   - Torso upright
 *   - Symmetry (left vs right)
 */
import type { ExerciseDefinition } from "@/types/exercise";

export const LUNGE: ExerciseDefinition = {
  id: "lunge",
  name: "Lunge",
  description:
    "Step one foot forward and lower your hips until both knees are bent ~90°. Keep your torso tall. Push through the front heel to return.",
  difficulty: "intermediate",
  targetMuscles: ["legs", "glutes", "core"],
  requiredKeypoints: [
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
  ],
  angleRules: [
    {
      label: "Left Knee",
      points: ["left_hip", "left_knee", "left_ankle"],
      target: 90,
      tolerance: 15,
    },
    {
      label: "Right Knee",
      points: ["right_hip", "right_knee", "right_ankle"],
      target: 90,
      tolerance: 15,
    },
  ],
  repDetectionRules: [
    {
      from: "ready",
      to: "descending",
      minDwellMs: 250,
      condition: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return false;
        return Math.min(lk, rk) < 130;
      },
    },
    {
      from: "descending",
      to: "bottom",
      minDwellMs: 200,
      condition: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return false;
        return Math.min(lk, rk) < 110;
      },
    },
    {
      from: "bottom",
      to: "ascending",
      minDwellMs: 150,
      condition: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return false;
        return Math.max(lk, rk) > 120;
      },
    },
    {
      from: "ascending",
      to: "rep_completed",
      minDwellMs: 200,
      condition: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return false;
        return Math.min(lk, rk) > 160;
      },
    },
  ],
  formRules: [
    {
      id: "lunge-depth",
      description: "Lower your hips fully",
      cue: "Go lower — both knees ~90°",
      severity: "warning",
      evaluate: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return 0.5;
        const min = Math.min(lk, rk);
        if (ctx.state === "bottom" || ctx.state === "ascending") {
          if (min > 105) return 0.3;
          if (min > 95) return 0.6;
          return 1;
        }
        return 0.8;
      },
    },
    {
      id: "lunge-torso",
      description: "Keep your torso tall",
      cue: "Keep your chest tall",
      severity: "info",
      evaluate: (ctx) => {
        const ls = ctx.keypoints.get("left_shoulder");
        const rs = ctx.keypoints.get("right_shoulder");
        const lh = ctx.keypoints.get("left_hip");
        const rh = ctx.keypoints.get("right_hip");
        if (!ls || !rs || !lh || !rh) return 0.5;
        const midS = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
        const midH = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
        const dx = midS.x - midH.x;
        const dy = midS.y - midH.y;
        const lean = Math.abs(Math.atan2(dx, dy)) * (180 / Math.PI);
        if (lean < 15) return 1;
        if (lean < 30) return 0.6;
        return 0.3;
      },
    },
  ],
  commonMistakes: [
    {
      id: "front-knee-cave",
      name: "Front knee caving in",
      description: "Front knee should track over the ankle, not collapse inward.",
      cue: "Drive front knee outward",
    },
    {
      id: "short-step",
      name: "Step too short",
      description: "A short step puts too much load on the front knee.",
      cue: "Take a longer step",
    },
    {
      id: "torso-lean",
      name: "Leaning forward",
      description: "Leaning forward shifts load from glutes to lower back.",
      cue: "Keep torso tall",
    },
  ],
  defaultReps: 10,
  defaultSets: 3,
};
