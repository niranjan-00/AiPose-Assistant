/**
 * Unit tests for the pose math primitives used by every exercise.
 */
import { describe, it, expect } from "vitest";
import {
  angleAt,
  averageConfidence,
  distance,
  getKeypoint,
  isKeypointVisible,
  jointAngle,
  midPoint,
  signedAngleAt,
} from "@/lib/pose/keypoints";
import type { PoseKeypoint } from "@/types/pose";

function kp(name: PoseKeypoint["name"], x: number, y: number, score = 1): PoseKeypoint {
  return { name, x, y, score };
}

describe("angleAt", () => {
  it("returns 180° for collinear points", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    const c = { x: 2, y: 0 };
    expect(angleAt(a, b, c)).toBeCloseTo(180, 1);
  });

  it("returns 90° for perpendicular vectors", () => {
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 0 };
    const c = { x: 0, y: 1 };
    expect(angleAt(a, b, c)).toBeCloseTo(90, 1);
  });

  it("returns 0° for coincident points (degenerate)", () => {
    const p = { x: 1, y: 1 };
    expect(angleAt(p, p, p)).toBeNaN();
  });

  it("returns NaN for undefined inputs", () => {
    expect(angleAt(undefined, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNaN();
  });
});

describe("signedAngleAt", () => {
  it("returns positive for clockwise (screen coords, y down)", () => {
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 0 };
    const c = { x: 0, y: 1 };
    const ang = signedAngleAt(a, b, c);
    expect(ang).toBeGreaterThan(0);
    expect(ang).toBeCloseTo(90, 1);
  });

  it("returns negative for counter-clockwise", () => {
    const a = { x: 0, y: 1 };
    const b = { x: 0, y: 0 };
    const c = { x: 1, y: 0 };
    const ang = signedAngleAt(a, b, c);
    expect(ang).toBeLessThan(0);
    expect(ang).toBeCloseTo(-90, 1);
  });
});

describe("distance / midPoint", () => {
  it("distance computes Euclidean distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it("midPoint computes midpoint", () => {
    const m = midPoint({ x: 0, y: 0 }, { x: 2, y: 4 });
    expect(m).toEqual({ x: 1, y: 2 });
  });
});

describe("keypoint helpers", () => {
  const kps: PoseKeypoint[] = [
    kp("nose", 0.5, 0.5, 0.9),
    kp("left_shoulder", 0.3, 0.4, 0.2),
    kp("right_shoulder", 0.7, 0.4, 0.8),
  ];

  it("getKeypoint finds by name", () => {
    expect(getKeypoint(kps, "nose")?.x).toBe(0.5);
    expect(getKeypoint(kps, "left_knee")).toBeUndefined();
  });

  it("isKeypointVisible respects minScore", () => {
    expect(isKeypointVisible(kps, "nose", 0.3)).toBe(true);
    expect(isKeypointVisible(kps, "left_shoulder", 0.3)).toBe(false);
    expect(isKeypointVisible(kps, "right_shoulder", 0.5)).toBe(true);
  });
});

describe("jointAngle", () => {
  it("computes joint angle in degrees", () => {
    const kps: PoseKeypoint[] = [
      kp("left_shoulder", 0, 0),
      kp("left_elbow", 1, 0),
      kp("left_wrist", 1, 1),
    ];
    const ang = jointAngle(kps, "left_shoulder", "left_elbow", "left_wrist", 0.3);
    expect(ang).toBeCloseTo(90, 1);
  });

  it("returns NaN if any keypoint is below confidence threshold", () => {
    const kps: PoseKeypoint[] = [
      kp("left_shoulder", 0, 0, 0.1),
      kp("left_elbow", 1, 0),
      kp("left_wrist", 1, 1),
    ];
    expect(jointAngle(kps, "left_shoulder", "left_elbow", "left_wrist", 0.3)).toBeNaN();
  });
});

describe("averageConfidence", () => {
  it("averages keypoint scores", () => {
    const kps: PoseKeypoint[] = [
      kp("nose", 0, 0, 0.5),
      kp("left_shoulder", 0, 0, 1.0),
    ];
    expect(averageConfidence(kps)).toBeCloseTo(0.75, 3);
  });

  it("returns 0 for empty array", () => {
    expect(averageConfidence([])).toBe(0);
  });
});
