/**
 * Pose evaluation — heuristic pose quality scoring + suggestions.
 * Preserved and refactored from the original AiPose App.tsx.
 *
 * The scoring formula is documented below:
 *
 *   quality = 34                              // base
 *           + score * 30                      // avg keypoint confidence
 *           + max(0, 18 - centerOffset * 92)  // centering bonus
 *           + (0.42 < heightRatio < 0.88 ? 15 : -6)   // frame fill
 *           + (widthRatio < 0.72 ? 6 : -6)            // not too wide
 *           + (shoulderSlope < 0.12 ? 9 : -7)         // shoulders level
 *           + (spineLean < 0.24 ? 7 : -5)             // spine vertical
 *           + (anklesVisible || heightRatio < 0.58 ? 4 : -4)  // ankles visible
 *           + (lowLight ? -12 : 4)                     // lighting
 *   clamp 0..100
 *
 * status = quality >= 84 ? "good" : "improve"
 */
import type {
  PoseFrame,
  SceneAnalysis,
  Suggestion,
} from "@/types/pose";
import { PERSON_MIN_AVG_SCORE, PERSON_MIN_KEYPOINTS, TORSO_KEYPOINTS } from "@/constants/pose";
import {
  averageConfidence,
  getKeypoint,
  midPoint,
} from "./keypoints";
import { getRawBox } from "./project";

export interface EvaluatePoseInput {
  frame: PoseFrame;
  stageWidth: number;
  stageHeight: number;
  analysis?: SceneAnalysis;
}

export interface EvaluatePoseOutput {
  quality: number;
  status: "good" | "improve";
  suggestion: Suggestion;
}

export function isPersonPose(frame: PoseFrame): boolean {
  const reliable = frame.keypoints.filter((k) => k.score >= 0.25);
  const avg = averageConfidence(frame.keypoints);
  if (reliable.length < PERSON_MIN_KEYPOINTS) return false;
  if (avg < PERSON_MIN_AVG_SCORE) return false;
  // Must have at least 2 of the 4 torso keypoints visible.
  const torsoVisible = TORSO_KEYPOINTS.filter((n) => {
    const k = getKeypoint(frame.keypoints, n);
    return k && k.score >= 0.22;
  }).length;
  return torsoVisible >= 2;
}

export function evaluatePose(input: EvaluatePoseInput): EvaluatePoseOutput {
  const { frame, stageWidth, stageHeight, analysis } = input;
  const keypoints = frame.keypoints;

  const score = averageConfidence(keypoints);
  const reliable = keypoints.filter((k) => k.score >= 0.25);

  // Bounding box in normalized coords.
  const rawBox = getRawBox(reliable, 0.2, 0.02, 0.03);
  const heightRatio = rawBox?.height ?? 0;
  const widthRatio = rawBox?.width ?? 0;

  // Center offset: distance of bbox center from (0.5, 0.5), normalized.
  const cx = rawBox ? rawBox.x + rawBox.width / 2 : 0.5;
  const cy = rawBox ? rawBox.y + rawBox.height / 2 : 0.5;
  const centerOffset = Math.sqrt(
    (cx - 0.5) * (cx - 0.5) + (cy - 0.5) * (cy - 0.5),
  );

  // Shoulder levelness: slope of line connecting left/right shoulder.
  const lSh = getKeypoint(keypoints, "left_shoulder");
  const rSh = getKeypoint(keypoints, "right_shoulder");
  let shoulderSlope = 0;
  if (lSh && rSh && lSh.score >= 0.3 && rSh.score >= 0.3) {
    const dx = rSh.x - lSh.x;
    const dy = Math.abs(rSh.y - lSh.y);
    shoulderSlope = dx > 0 ? dy / dx : 0;
  }

  // Spine lean: angle of line from mid-shoulders to mid-hips, deviation from vertical.
  let spineLean = 0;
  const hips = [
    getKeypoint(keypoints, "left_hip"),
    getKeypoint(keypoints, "right_hip"),
  ].filter((k) => k && k.score >= 0.3);
  const shoulders = [lSh, rSh].filter(
    (k) => k && k && k.score >= 0.3,
  );
  if (hips.length === 2 && shoulders.length === 2) {
    const midHip = midPoint(hips[0]!, hips[1]!);
    const midSh = midPoint(shoulders[0]!, shoulders[1]!);
    const dx = midHip.x - midSh.x;
    const dy = midHip.y - midSh.y;
    if (dy > 0.001) {
      spineLean = Math.abs(Math.atan2(dx, dy));
    }
  }

  // Ankle visibility
  const lAnkle = getKeypoint(keypoints, "left_ankle");
  const rAnkle = getKeypoint(keypoints, "right_ankle");
  const anklesVisible: boolean =
    (!!lAnkle && lAnkle.score >= 0.3) || (!!rAnkle && rAnkle.score >= 0.3);

  // Lighting
  const lowLight = !!analysis && analysis.lighting.toLowerCase().includes("low light");

  // Quality formula (see file header for the full breakdown).
  let quality =
    34 +
    score * 30 +
    Math.max(0, 18 - centerOffset * 92) +
    (heightRatio > 0.42 && heightRatio < 0.88 ? 15 : -6) +
    (widthRatio < 0.72 ? 6 : -6) +
    (shoulderSlope < 0.12 ? 9 : -7) +
    (spineLean < 0.24 ? 7 : -5) +
    (anklesVisible || heightRatio < 0.58 ? 4 : -4) +
    (lowLight ? -12 : 4);

  quality = Math.max(0, Math.min(100, Math.round(quality)));

  const status = quality >= 84 ? "good" : "improve";
  const suggestion = getSuggestion({
    score,
    centerOffset,
    widthRatio,
    heightRatio,
    shoulderSlope,
    spineLean,
    anklesVisible,
    lowLight,
    analysis,
  });

  // stageWidth/Height kept in the API for future use (debug overlay).
  void stageWidth;
  void stageHeight;

  return { quality, status, suggestion };
}

interface SuggestionInput {
  score: number;
  centerOffset: number;
  widthRatio: number;
  heightRatio: number;
  shoulderSlope: number;
  spineLean: number;
  anklesVisible: boolean;
  lowLight: boolean;
  analysis?: SceneAnalysis;
}

function getSuggestion(s: SuggestionInput): Suggestion {
  if (s.lowLight) {
    return {
      poseSuggestion: "Improve lighting",
      adjustment: "Move toward a brighter light source",
      cameraTip: "Front-lit light gives best results",
      status: "improve",
    };
  }
  if (s.centerOffset > 0.18) {
    return {
      poseSuggestion: "Center yourself",
      adjustment: "Step toward the middle of the frame",
      cameraTip: "Keep the camera at hip height",
      status: "improve",
    };
  }
  if (s.widthRatio > 0.72) {
    return {
      poseSuggestion: "Step back slightly",
      adjustment: "Bring your whole body into view",
      cameraTip: "Camera distance ≈ 1.5 m",
      status: "improve",
    };
  }
  if (s.heightRatio < 0.42) {
    return {
      poseSuggestion: "Move closer",
      adjustment: "Step toward the camera",
      cameraTip: "Full body in frame is ideal",
      status: "improve",
    };
  }
  if (!s.anklesVisible && s.heightRatio >= 0.58) {
    return {
      poseSuggestion: "Show your feet",
      adjustment: "Step back so ankles are visible",
      cameraTip: "Ankles improve pose accuracy",
      status: "improve",
    };
  }
  if (s.shoulderSlope > 0.12) {
    return {
      poseSuggestion: "Level your shoulders",
      adjustment: "Drop the higher shoulder",
      cameraTip: "Stand square to the camera",
      status: "improve",
    };
  }
  if (s.spineLean > 0.24) {
    return {
      poseSuggestion: "Stand tall",
      adjustment: "Straighten your spine",
      cameraTip: "Stack shoulders over hips",
      status: "improve",
    };
  }
  return {
    poseSuggestion: "Hold a balanced pose",
    adjustment: "Angle your body slightly for variety",
    cameraTip: "Breathe and relax your shoulders",
    status: "good",
  };
}
