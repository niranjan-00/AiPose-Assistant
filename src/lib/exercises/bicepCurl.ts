/**
 * Bicep Curl — elbow flexion cycle (dumbbell or bodyweight).
 * Detects: descend (elbow > 90 → arm straightening) → ready (elbow > 150)
 * Actually: rep completes when curl comes UP (elbow < 60) then DOWN (elbow > 150).
 */
import type { ExerciseDefinition } from "@/types/exercise";

export const BICEP_CURL: ExerciseDefinition = {
  id: "bicepCurl",
  name: "Bicep Curl",
  description:
    "Start with arms extended by your sides. Curl your hands up toward your shoulders by bending your elbows. Lower back down with control.",
  difficulty: "beginner",
  targetMuscles: ["arms"],
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
      min: 30,
      max: 180,
    },
    {
      label: "Right Elbow",
      points: ["right_shoulder", "right_elbow", "right_wrist"],
      target: 90,
      tolerance: 30,
      min: 30,
      max: 180,
    },
  ],
  repDetectionRules: [
    {
      // ready → descending (arm curling up = elbow closing). We name it "descending"
      // to match the generic state machine; for bicep curl the "down" phase is the
      // contraction. The labels are abstract — the rep completes when the cycle
      // returns to ready.
      from: "ready",
      to: "descending",
      minDwellMs: 200,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return false;
        const min = !Number.isNaN(le) && !Number.isNaN(re)
          ? Math.min(le, re)
          : !Number.isNaN(le) ? le : re!;
        return min < 110;
      },
    },
    {
      // descending → bottom (curl at top)
      from: "descending",
      to: "bottom",
      minDwellMs: 200,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return false;
        const min = !Number.isNaN(le) && !Number.isNaN(re)
          ? Math.min(le, re)
          : !Number.isNaN(le) ? le : re!;
        return min < 70;
      },
    },
    {
      // bottom → ascending (lowering the weight)
      from: "bottom",
      to: "ascending",
      minDwellMs: 150,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return false;
        const max = !Number.isNaN(le) && !Number.isNaN(re)
          ? Math.max(le, re)
          : !Number.isNaN(le) ? le : re!;
        return max > 90;
      },
    },
    {
      // ascending → rep_completed (arm back to straight)
      from: "ascending",
      to: "rep_completed",
      minDwellMs: 200,
      condition: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return false;
        const min = !Number.isNaN(le) && !Number.isNaN(re)
          ? Math.min(le, re)
          : !Number.isNaN(le) ? le : re!;
        return min > 150;
      },
    },
  ],
  formRules: [
    {
      id: "curl-range",
      description: "Complete full range of motion",
      cue: "Curl all the way up and down",
      severity: "info",
      evaluate: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) && Number.isNaN(re)) return 0.5;
        // Check curl reached full flexion at bottom AND full extension at top
        if (ctx.state === "bottom") {
          const min = Math.min(
            ...(Number.isNaN(le) ? [] : [le]),
            ...(Number.isNaN(re) ? [] : [re]),
          );
          if (min > 80) return 0.5;
          return 1;
        }
        return 0.8;
      },
    },
    {
      id: "curl-symmetry",
      description: "Curl both arms together",
      cue: "Curl both arms in sync",
      severity: "info",
      evaluate: (ctx) => {
        const le = ctx.angles["Left Elbow"];
        const re = ctx.angles["Right Elbow"];
        if (Number.isNaN(le) || Number.isNaN(re)) return 0.5;
        const delta = Math.abs(le - re);
        if (delta < 12) return 1;
        if (delta < 25) return 0.6;
        return 0.3;
      },
    },
    {
      id: "curl-elbow-fixed",
      description: "Keep elbows pinned to your sides",
      cue: "Keep elbows at your sides",
      severity: "warning",
      evaluate: (ctx) => {
        // Elbow should stay near the hip (y-coord close)
        const le = ctx.keypoints.get("left_elbow");
        const re = ctx.keypoints.get("right_elbow");
        const lh = ctx.keypoints.get("left_hip");
        const rh = ctx.keypoints.get("right_hip");
        if (!le || !re || !lh || !rh) return 0.5;
        const lDelta = Math.abs(le.y - lh.y);
        const rDelta = Math.abs(re.y - rh.y);
        const avg = (lDelta + rDelta) / 2;
        if (avg < 0.05) return 1;
        if (avg < 0.12) return 0.6;
        return 0.3;
      },
    },
  ],
  commonMistakes: [
    {
      id: "swing",
      name: "Swinging the weight",
      description: "Using momentum reduces muscle activation and risks injury.",
      cue: "Slow and controlled",
    },
    {
      id: "elbow-move",
      name: "Elbows moving forward",
      description: "Elbows should stay pinned to your sides throughout.",
      cue: "Pin elbows at your sides",
    },
    {
      id: "partial-rep",
      name: "Partial reps",
      description: "Not extending fully limits gains.",
      cue: "Full extension at the bottom",
    },
  ],
  defaultReps: 12,
  defaultSets: 3,
};
