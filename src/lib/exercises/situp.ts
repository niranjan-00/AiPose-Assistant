/**
 * Sit-up — torso flexion cycle. Use the angle between shoulder, hip, knee.
 *   ready (torso upright / lying flat, angle ~180°) → descending (curl up, angle < 130°)
 *   → bottom (full sit-up, angle < 90°) → ascending (lowering, > 100°)
 *   → rep_completed (back to flat, > 150°)
 */
import type { ExerciseDefinition } from "@/types/exercise";

export const SITUP: ExerciseDefinition = {
  id: "situp",
  name: "Sit-up",
  description:
    "Lie on your back with knees bent. Curl your torso up toward your thighs, then lower back down with control.",
  difficulty: "beginner",
  targetMuscles: ["core"],
  requiredKeypoints: [
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
  ],
  angleRules: [
    {
      label: "Left Torso",
      points: ["left_shoulder", "left_hip", "left_knee"],
      target: 90,
      tolerance: 25,
    },
    {
      label: "Right Torso",
      points: ["right_shoulder", "right_hip", "right_knee"],
      target: 90,
      tolerance: 25,
    },
  ],
  repDetectionRules: [
    {
      from: "ready",
      to: "descending",
      minDwellMs: 300,
      condition: (ctx) => {
        const lt = ctx.angles["Left Torso"];
        const rt = ctx.angles["Right Torso"];
        if (Number.isNaN(lt) && Number.isNaN(rt)) return false;
        const min = !Number.isNaN(lt) && !Number.isNaN(rt)
          ? Math.min(lt, rt)
          : !Number.isNaN(lt) ? lt : rt!;
        return min < 130;
      },
    },
    {
      from: "descending",
      to: "bottom",
      minDwellMs: 200,
      condition: (ctx) => {
        const lt = ctx.angles["Left Torso"];
        const rt = ctx.angles["Right Torso"];
        if (Number.isNaN(lt) && Number.isNaN(rt)) return false;
        const min = !Number.isNaN(lt) && !Number.isNaN(rt)
          ? Math.min(lt, rt)
          : !Number.isNaN(lt) ? lt : rt!;
        return min < 90;
      },
    },
    {
      from: "bottom",
      to: "ascending",
      minDwellMs: 200,
      condition: (ctx) => {
        const lt = ctx.angles["Left Torso"];
        const rt = ctx.angles["Right Torso"];
        if (Number.isNaN(lt) && Number.isNaN(rt)) return false;
        const max = !Number.isNaN(lt) && !Number.isNaN(rt)
          ? Math.max(lt, rt)
          : !Number.isNaN(lt) ? lt : rt!;
        return max > 100;
      },
    },
    {
      from: "ascending",
      to: "rep_completed",
      minDwellMs: 250,
      condition: (ctx) => {
        const lt = ctx.angles["Left Torso"];
        const rt = ctx.angles["Right Torso"];
        if (Number.isNaN(lt) && Number.isNaN(rt)) return false;
        const min = !Number.isNaN(lt) && !Number.isNaN(rt)
          ? Math.min(lt, rt)
          : !Number.isNaN(lt) ? lt : rt!;
        return min > 150;
      },
    },
  ],
  formRules: [
    {
      id: "situp-full-flex",
      description: "Sit up fully",
      cue: "Curl up all the way",
      severity: "info",
      evaluate: (ctx) => {
        const lt = ctx.angles["Left Torso"];
        const rt = ctx.angles["Right Torso"];
        if (Number.isNaN(lt) && Number.isNaN(rt)) return 0.5;
        const min = Math.min(
          ...(Number.isNaN(lt) ? [] : [lt]),
          ...(Number.isNaN(rt) ? [] : [rt]),
        );
        if (ctx.state === "bottom") {
          if (min > 100) return 0.4;
          return 1;
        }
        return 0.8;
      },
    },
  ],
  commonMistakes: [
    {
      id: "yank-neck",
      name: "Yanking the neck",
      description: "Pulling on your head strains the neck.",
      cue: "Hands lightly behind head",
    },
    {
      id: "partial-situp",
      name: "Partial sit-up",
      description: "Not curling all the way up reduces core activation.",
      cue: "Curl all the way up",
    },
    {
      id: "bouncing-up",
      name: "Bouncing up with momentum",
      description: "Momentum reduces muscle work.",
      cue: "Slow and controlled",
    },
  ],
  defaultReps: 15,
  defaultSets: 3,
};
