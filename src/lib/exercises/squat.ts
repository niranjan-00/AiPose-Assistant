/**
 * Squat — knee & hip flexion cycle.
 *
 * Rep state machine:
 *   ready → descending (knee angle < 140°) → bottom (knee angle < 100°)
 *         → ascending (knee angle > 110°) → rep_completed (knee angle > 160°)
 *
 * Form rules:
 *   - Knee alignment (knees cave in): check knee-to-foot vector
 *   - Torso angle (chest up): angle of shoulder→hip line vs vertical
 *   - Depth (knee angle at bottom)
 *   - Symmetry (left vs right knee angle)
 *   - Back straight (no rounding)
 */
import type { ExerciseDefinition } from "@/types/exercise";
import { angleAt, getKeypoint } from "@/lib/pose/keypoints";

export const SQUAT: ExerciseDefinition = {
  id: "squat",
  name: "Squat",
  description:
    "Lower your hips toward the ground, keeping your weight in your heels and your chest up. Drive through your heels to stand back up.",
  difficulty: "beginner",
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
      min: 70,
      max: 180,
    },
    {
      label: "Right Knee",
      points: ["right_hip", "right_knee", "right_ankle"],
      target: 90,
      tolerance: 15,
      min: 70,
      max: 180,
    },
    {
      label: "Left Hip",
      points: ["left_shoulder", "left_hip", "left_knee"],
      target: 100,
      tolerance: 20,
    },
    {
      label: "Right Hip",
      points: ["right_shoulder", "right_hip", "right_knee"],
      target: 100,
      tolerance: 20,
    },
  ],
  repDetectionRules: [
    {
      // ready → descending: start squat
      from: "ready",
      to: "descending",
      minDwellMs: 250,
      condition: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return false;
        const avg = (lk + rk) / 2;
        return avg < 140;
      },
    },
    {
      // descending → bottom: hit the bottom
      from: "descending",
      to: "bottom",
      minDwellMs: 200,
      condition: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return false;
        const avg = (lk + rk) / 2;
        return avg < 110;
      },
    },
    {
      // bottom → ascending: come back up
      from: "bottom",
      to: "ascending",
      minDwellMs: 150,
      condition: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return false;
        const avg = (lk + rk) / 2;
        return avg > 120;
      },
    },
    {
      // ascending → rep_completed: standing tall
      from: "ascending",
      to: "rep_completed",
      minDwellMs: 200,
      condition: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return false;
        const avg = (lk + rk) / 2;
        return avg > 160;
      },
    },
  ],
  formRules: [
    {
      id: "squat-depth",
      description: "Reach full depth",
      cue: "Go slightly deeper",
      severity: "warning",
      evaluate: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return 0.5;
        const avg = (lk + rk) / 2;
        // At bottom state, encourage depth < 100°.
        if (ctx.state === "bottom" || ctx.state === "ascending") {
          if (avg > 110) return 0.3;
          if (avg > 95) return 0.6;
          return 1;
        }
        return 0.8;
      },
    },
    {
      id: "squat-chest-up",
      description: "Keep your chest up",
      cue: "Keep your chest up",
      severity: "warning",
      evaluate: (ctx) => {
        const ls = getKeypoint(ctx.frame.keypoints, "left_shoulder");
        const rs = getKeypoint(ctx.frame.keypoints, "right_shoulder");
        const lh = getKeypoint(ctx.frame.keypoints, "left_hip");
        const rh = getKeypoint(ctx.frame.keypoints, "right_hip");
        if (!ls || !rs || !lh || !rh) return 0.5;
        if (
          ls.score < 0.3 ||
          rs.score < 0.3 ||
          lh.score < 0.3 ||
          rh.score < 0.3
        )
          return 0.5;
        const midS = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
        const midH = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
        // Torso lean: deviation of shoulder->hip vector from vertical (in screen coords, y down)
        const dx = midS.x - midH.x;
        const dy = midS.y - midH.y;
        // angle from vertical (degrees) — torso leans forward if |dx/dy| is large
        const lean = Math.abs(Math.atan2(dx, dy)) * (180 / Math.PI);
        // 0..15° lean = great; 15..35° = ok; >35° = poor
        if (lean < 15) return 1;
        if (lean < 30) return 0.6;
        return 0.3;
      },
    },
    {
      id: "squat-knee-align",
      description: "Keep knees aligned with feet",
      cue: "Keep your knees aligned with your feet",
      severity: "warning",
      evaluate: (ctx) => {
        // Knee should be roughly above ankle (x-coords within tolerance)
        const lk = getKeypoint(ctx.frame.keypoints, "left_knee");
        const la = getKeypoint(ctx.frame.keypoints, "left_ankle");
        const rk = getKeypoint(ctx.frame.keypoints, "right_knee");
        const ra = getKeypoint(ctx.frame.keypoints, "right_ankle");
        if (!lk || !rk || !la || !ra) return 0.5;
        if (
          lk.score < 0.3 ||
          rk.score < 0.3 ||
          la.score < 0.3 ||
          ra.score < 0.3
        )
          return 0.5;
        const lDelta = Math.abs(lk.x - la.x);
        const rDelta = Math.abs(rk.x - ra.x);
        const avg = (lDelta + rDelta) / 2;
        // normalized coords; <0.04 is great, <0.08 is ok
        if (avg < 0.04) return 1;
        if (avg < 0.08) return 0.6;
        return 0.3;
      },
    },
    {
      id: "squat-symmetry",
      description: "Keep left and right balanced",
      cue: "Balance left and right",
      severity: "info",
      evaluate: (ctx) => {
        const lk = ctx.angles["Left Knee"];
        const rk = ctx.angles["Right Knee"];
        if (Number.isNaN(lk) || Number.isNaN(rk)) return 0.5;
        const delta = Math.abs(lk - rk);
        if (delta < 8) return 1;
        if (delta < 18) return 0.6;
        return 0.3;
      },
    },
  ],
  commonMistakes: [
    {
      id: "knees-cave-in",
      name: "Knees caving inward",
      description:
        "Your knees should track in line with your toes. Caving inward stresses the knee joint.",
      cue: "Push knees outward in line with toes",
    },
    {
      id: "chest-drop",
      name: "Chest dropping forward",
      description:
        "A forward lean puts stress on the lower back. Keep your torso upright.",
      cue: "Keep chest up and tall",
    },
    {
      id: "partial-rep",
      name: "Partial depth",
      description:
        "Going only halfway down limits muscle activation. Aim for hip crease below knee.",
      cue: "Go deeper — hip crease below knee",
    },
    {
      id: "heels-lift",
      name: "Heels lifting off ground",
      description: "Weight should stay in your heels. Lifting heels shifts load to knees.",
      cue: "Keep weight in your heels",
    },
  ],
  defaultReps: 12,
  defaultSets: 3,
};

// Helper used by the engine to compute the torso angle in degrees from vertical.
export function torsoAngleDeg(
  midShoulder: { x: number; y: number },
  midHip: { x: number; y: number },
): number {
  const angle = angleAt(midShoulder, midHip, {
    x: midHip.x,
    y: midHip.y - 0.1,
  });
  return angle;
}
