/**
 * Push-up — elbow flexion + body straightness cycle.
 *
 * Rep state machine:
 *   ready → descending (elbow angle < 120°) → bottom (elbow angle < 90°)
 *         → ascending (elbow angle > 100°) → rep_completed (elbow angle > 150°)
 *
 * Form rules:
 *   - Body straightness (no sagging hips)
 *   - Depth (chest to ground)
 *   - Elbow angle (not too tucked or flared)
 *   - Symmetry (left vs right elbow angle)
 */
import type { ExerciseDefinition } from "@/types/exercise";
import { getKeypoint, midPoint } from "@/lib/pose/keypoints";

export const PUSHUP: ExerciseDefinition = {
  id: "pushup",
  name: "Push-up",
  description:
    "Start in a plank position. Lower your chest to the ground by bending your elbows, then press back up. Keep your body in a straight line from head to heels.",
  difficulty: "intermediate",
  targetMuscles: ["chest", "arms", "core"],
  requiredKeypoints: [
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_ankle",
    "right_ankle",
  ],
  angleRules: [
    {
      label: "Left Elbow",
      points: ["left_shoulder", "left_elbow", "left_wrist"],
      target: 90,
      tolerance: 15,
    },
    {
      label: "Right Elbow",
      points: ["right_shoulder", "right_elbow", "right_wrist"],
      target: 90,
      tolerance: 15,
    },
    {
      label: "Left Body",
      points: ["left_shoulder", "left_hip", "left_ankle"],
      target: 180,
      tolerance: 20,
    },
    {
      label: "Right Body",
      points: ["right_shoulder", "right_hip", "right_ankle"],
      target: 180,
      tolerance: 20,
    },
  ],
  repDetectionRules: [
    {
      from: "ready",
      to: "descending",
      minDwellMs: 250,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) || Number.isNaN(re)) return false;
        return (le + re) / 2 < 130;
      },
    },
    {
      from: "descending",
      to: "bottom",
      minDwellMs: 200,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) || Number.isNaN(re)) return false;
        return (le + re) / 2 < 95;
      },
    },
    {
      from: "bottom",
      to: "ascending",
      minDwellMs: 150,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) || Number.isNaN(re)) return false;
        return (le + re) / 2 > 110;
      },
    },
    {
      from: "ascending",
      to: "rep_completed",
      minDwellMs: 200,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) || Number.isNaN(re)) return false;
        return (le + re) / 2 > 155;
      },
    },
  ],
  formRules: [
    {
      id: "pushup-body-straight",
      description: "Keep your body in a straight line",
      cue: "Don't let your hips drop",
      severity: "error",
      evaluate: (ctx) => {
        // angle at hip should be ~180 (shoulder-hip-ankle collinear)
        const lb = ctx.angles["Left Body"];
        const rb = ctx.angles["Right Body"];
        if (Number.isNaN(lb) && Number.isNaN(rb)) return 0.5;
        const avg = !Number.isNaN(lb) && !Number.isNaN(rb)
          ? (lb + rb) / 2
          : !Number.isNaN(lb) ? lb : rb!;
        if (avg > 170) return 1;
        if (avg > 150) return 0.6;
        return 0.2;
      },
    },
    {
      id: "pushup-depth",
      description: "Lower chest fully",
      cue: "Lower your chest further",
      severity: "warning",
      evaluate: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) || Number.isNaN(re)) return 0.5;
        const avg = (le + re) / 2;
        if (ctx.state === "bottom" || ctx.state === "ascending") {
          if (avg > 95) return 0.3;
          if (avg > 80) return 0.6;
          return 1;
        }
        return 0.8;
      },
    },
    {
      id: "pushup-elbow-tuck",
      description: "Keep elbows close to body",
      cue: "Keep your elbows closer",
      severity: "info",
      evaluate: (ctx) => {
        // Elbow flares when wrist is far outside shoulder
        const ls = getKeypoint(ctx.frame.keypoints, "left_shoulder");
        const rs = getKeypoint(ctx.frame.keypoints, "right_shoulder");
        const lw = getKeypoint(ctx.frame.keypoints, "left_wrist");
        const rw = getKeypoint(ctx.frame.keypoints, "right_wrist");
        if (!ls || !rs || !lw || !rw) return 0.5;
        if (
          ls.score < 0.3 ||
          rs.score < 0.3 ||
          lw.score < 0.3 ||
          rw.score < 0.3
        )
          return 0.5;
        const midS = midPoint(ls, rs);
        const midW = midPoint(lw, rw);
        const shoulderWidth = Math.abs(rs.x - ls.x);
        const wristOffset = Math.abs(midW.x - midS.x);
        const ratio = shoulderWidth > 0 ? wristOffset / shoulderWidth : 0;
        // ratio < 0.5 → elbows tucked; >1 → elbows flared
        if (ratio < 0.5) return 1;
        if (ratio < 0.9) return 0.6;
        return 0.3;
      },
    },
    {
      id: "pushup-symmetry",
      description: "Keep left and right balanced",
      cue: "Balance left and right",
      severity: "info",
      evaluate: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) || Number.isNaN(re)) return 0.5;
        const delta = Math.abs(le - re);
        if (delta < 8) return 1;
        if (delta < 18) return 0.6;
        return 0.3;
      },
    },
  ],
  commonMistakes: [
    {
      id: "sagging-hips",
      name: "Hips sagging",
      description: "Letting hips drop puts strain on the lower back and reduces core activation.",
      cue: "Squeeze glutes, keep hips in line",
    },
    {
      id: "pike-up",
      name: "Hips piking up",
      description: "Hips rising above shoulder line reduces range of motion.",
      cue: "Keep body straight",
    },
    {
      id: "partial-depth",
      name: "Partial depth",
      description: "Not lowering chest enough reduces muscle activation.",
      cue: "Chest to the ground",
    },
    {
      id: "elbow-flare",
      name: "Elbows flaring out",
      description: "Flared elbows stress the shoulder joint.",
      cue: "Tuck elbows 45° from torso",
    },
  ],
  defaultReps: 10,
  defaultSets: 3,
};
