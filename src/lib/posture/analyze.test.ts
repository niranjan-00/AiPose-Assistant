/**
 * Tests for posture analysis rules.
 */
import { describe, it, expect } from "vitest";
import { analyzePosture } from "@/lib/posture/analyze";
import type { PoseFrame, PoseKeypoint } from "@/types/pose";

function kp(
  name: PoseKeypoint["name"],
  x: number,
  y: number,
  score = 1,
): PoseKeypoint {
  return { name, x, y, score };
}

function buildGoodPostureFrame(): PoseFrame {
  return {
    keypoints: [
      kp("nose", 0.5, 0.18),
      kp("left_shoulder", 0.4, 0.32),
      kp("right_shoulder", 0.6, 0.32),
      kp("left_hip", 0.42, 0.55),
      kp("right_hip", 0.58, 0.55),
      kp("left_ear", 0.46, 0.2),
      kp("right_ear", 0.54, 0.2),
    ],
    score: 0.9,
    videoWidth: 1280,
    videoHeight: 720,
    timestamp: 0,
  };
}

describe("analyzePosture", () => {
  it("returns score 0 + noPerson=true when no shoulders visible", () => {
    const frame: PoseFrame = {
      keypoints: [kp("nose", 0.5, 0.5)],
      score: 0.1,
      videoWidth: 1280,
      videoHeight: 720,
      timestamp: 0,
    };
    const result = analyzePosture(frame);
    expect(result.noPerson).toBe(true);
    expect(result.score).toBe(0);
  });

  it("returns high score for good posture", () => {
    const result = analyzePosture(buildGoodPostureFrame());
    expect(result.noPerson).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("detects forward head posture (low head-forward score)", () => {
    const frame = buildGoodPostureFrame();
    // Move nose forward (offset from shoulder center)
    const idx = frame.keypoints.findIndex((k) => k.name === "nose");
    frame.keypoints[idx] = kp("nose", 0.55, 0.18);
    const result = analyzePosture(frame);
    const headRule = result.rules.find((r) => r.id === "head-forward");
    expect(headRule).toBeDefined();
    expect(headRule!.score).toBeLessThan(0.6);
  });

  it("detects shoulder slope", () => {
    const frame = buildGoodPostureFrame();
    // Tilt right shoulder down (y increases)
    const idx = frame.keypoints.findIndex((k) => k.name === "right_shoulder");
    frame.keypoints[idx] = kp("right_shoulder", 0.6, 0.42);
    const result = analyzePosture(frame);
    const shoulderRule = result.rules.find((r) => r.id === "shoulder-level");
    expect(shoulderRule).toBeDefined();
    expect(shoulderRule!.score).toBeLessThan(0.6);
  });
});
