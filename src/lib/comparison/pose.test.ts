/**
 * Tests for pose comparison (Pose Practice mode).
 */
import { describe, it, expect } from "vitest";
import { comparePoses, buildTargetPoseFromFrame } from "@/lib/comparison/pose";
import { T_POSE } from "@/lib/targetPoses";
import type { PoseFrame, PoseKeypoint } from "@/types/pose";

function kp(
  name: PoseKeypoint["name"],
  x: number,
  y: number,
  score = 1,
): PoseKeypoint {
  return { name, x, y, score };
}

describe("comparePoses", () => {
  it("returns 100% when user matches target exactly", () => {
    const frame: PoseFrame = {
      keypoints: T_POSE.keypoints,
      score: 1,
      videoWidth: 1280,
      videoHeight: 720,
      timestamp: 0,
    };
    const result = comparePoses(frame, T_POSE);
    expect(result.overall).toBeGreaterThan(95);
    expect(result.insufficient).toBe(false);
  });

  it("returns lower similarity when joints differ significantly", () => {
    // Build a frame with elbows bent (NOT a T-pose) — clearly different.
    const frame: PoseFrame = {
      keypoints: [
        kp("nose", 0.5, 0.18),
        kp("left_shoulder", 0.4, 0.32),
        kp("right_shoulder", 0.6, 0.32),
        kp("left_elbow", 0.4, 0.42), // below shoulder, not out to side
        kp("right_elbow", 0.6, 0.42),
        kp("left_wrist", 0.4, 0.32), // folded up near shoulder
        kp("right_wrist", 0.6, 0.32),
        kp("left_hip", 0.43, 0.55),
        kp("right_hip", 0.57, 0.55),
        kp("left_knee", 0.43, 0.78),
        kp("right_knee", 0.57, 0.78),
        kp("left_ankle", 0.43, 0.95),
        kp("right_ankle", 0.57, 0.95),
      ],
      score: 1,
      videoWidth: 1280,
      videoHeight: 720,
      timestamp: 0,
    };
    const result = comparePoses(frame, T_POSE);
    expect(result.overall).toBeLessThan(80);
    // Some joints should be marked "adjust"
    expect(result.joints.some((j) => j.status === "adjust")).toBe(true);
  });

  it("returns insufficient=true when key joints are missing", () => {
    const frame: PoseFrame = {
      keypoints: [kp("nose", 0.5, 0.5)],
      score: 0.1,
      videoWidth: 1280,
      videoHeight: 720,
      timestamp: 0,
    };
    const result = comparePoses(frame, T_POSE);
    expect(result.insufficient).toBe(true);
  });

  it("buildTargetPoseFromFrame returns a target with the right keypoints", () => {
    const frame: PoseFrame = {
      keypoints: [kp("nose", 0.5, 0.5)],
      score: 1,
      videoWidth: 1280,
      videoHeight: 720,
      timestamp: 0,
    };
    const target = buildTargetPoseFromFrame("test", "Test", "desc", frame);
    expect(target.id).toBe("test");
    expect(target.name).toBe("Test");
    expect(target.keypoints).toHaveLength(1);
  });
});
