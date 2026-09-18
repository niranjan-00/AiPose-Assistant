/**
 * Jumping Jack — arms + legs spread cycle. Each "rep" = one full jack
 * (arms spread + legs apart, then back together). We count one rep per full
 * spread-and-return cycle.
 *
 * Detection: track wrist-shoulder y-distance and ankle spread.
 *   ready (legs together, arms down)
 *   → descending (legs apart / arms up — widening)
 *   → bottom (max spread — wrists above shoulders AND ankles spread)
 *   → ascending (coming back together)
 *   → rep_completed (back to ready)
 *
 * `cyclesPerRep = 1` (one full jack = one rep).
 */
import type { ExerciseDefinition } from "@/types/exercise";

function ankleSpread(ctx: { keypoints: Map<string, { x: number; y: number; score: number }> }): number {
  const la = ctx.keypoints.get("left_ankle");
  const ra = ctx.keypoints.get("right_ankle");
  if (!la || !ra) return NaN;
  return Math.abs(la.x - ra.x);
}

function wristSpread(ctx: { keypoints: Map<string, { x: number; y: number; score: number }> }): number {
  const lw = ctx.keypoints.get("left_wrist");
  const rw = ctx.keypoints.get("right_wrist");
  if (!lw || !rw) return NaN;
  return Math.abs(lw.x - rw.x);
}

function wristsAboveShoulders(
  ctx: { keypoints: Map<string, { x: number; y: number; score: number }> },
): boolean {
  const lw = ctx.keypoints.get("left_wrist");
  const rw = ctx.keypoints.get("right_wrist");
  const ls = ctx.keypoints.get("left_shoulder");
  const rs = ctx.keypoints.get("right_shoulder");
  if (!lw || !rw || !ls || !rs) return false;
  // Wrists above shoulders in screen coords (y down): y smaller.
  return lw.y < ls.y && rw.y < rs.y;
}

export const JUMPING_JACK: ExerciseDefinition = {
  id: "jumpingJack",
  name: "Jumping Jack",
  description:
    "Start standing with feet together and arms at your sides. Jump your feet apart while raising arms overhead, then return to start.",
  difficulty: "beginner",
  targetMuscles: ["full_body", "cardio"],
  requiredKeypoints: [
    "left_shoulder",
    "right_shoulder",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_ankle",
    "right_ankle",
  ],
  angleRules: [
    {
      label: "Shoulder Spread",
      points: ["left_wrist", "left_shoulder", "right_shoulder"],
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
        const spread = ankleSpread(ctx as never);
        if (Number.isNaN(spread)) return false;
        return spread > 0.18;
      },
    },
    {
      from: "descending",
      to: "bottom",
      minDwellMs: 100,
      condition: (ctx) => {
        return wristsAboveShoulders(ctx as never);
      },
    },
    {
      from: "bottom",
      to: "ascending",
      minDwellMs: 100,
      condition: (ctx) => {
        const spread = wristSpread(ctx as never);
        if (Number.isNaN(spread)) return false;
        // Arms coming back down
        return spread < 0.4;
      },
    },
    {
      from: "ascending",
      to: "rep_completed",
      minDwellMs: 150,
      condition: (ctx) => {
        const spread = ankleSpread(ctx as never);
        if (Number.isNaN(spread)) return false;
        return spread < 0.12;
      },
    },
  ],
  formRules: [
    {
      id: "jack-full-spread",
      description: "Spread arms and legs fully",
      cue: "Reach arms overhead",
      severity: "info",
      evaluate: (ctx) => {
        if (!wristsAboveShoulders(ctx as never)) return 0.5;
        return 1;
      },
    },
    {
      id: "jack-symmetry",
      description: "Keep arms and legs in sync",
      cue: "Symmetrical arm and leg spread",
      severity: "info",
      evaluate: (ctx) => {
        const lw = ctx.keypoints.get("left_wrist");
        const rw = ctx.keypoints.get("right_wrist");
        const la = ctx.keypoints.get("left_ankle");
        const ra = ctx.keypoints.get("right_ankle");
        if (!lw || !rw || !la || !ra) return 0.5;
        // left and right arms should be at similar heights
        const dyArms = Math.abs(lw.y - rw.y);
        // left and right ankles should be similar height
        const dyLegs = Math.abs(la.y - ra.y);
        if (dyArms < 0.05 && dyLegs < 0.05) return 1;
        if (dyArms < 0.1 && dyLegs < 0.1) return 0.6;
        return 0.3;
      },
    },
  ],
  commonMistakes: [
    {
      id: "stiff-arms",
      name: "Stiff arms",
      description: "Not reaching full overhead extension limits ROM.",
      cue: "Reach arms all the way overhead",
    },
    {
      id: "asymmetric-jump",
      name: "Asymmetric jump",
      description: "Uneven leg or arm spread indicates imbalance.",
      cue: "Land symmetrically",
    },
  ],
  defaultReps: 20,
  defaultSets: 3,
  cyclesPerRep: 1,
};
