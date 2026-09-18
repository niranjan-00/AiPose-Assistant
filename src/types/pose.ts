/**
 * Pose types — MoveNet SinglePose Lightning (17 keypoints).
 *
 * Keypoint names follow MoveNet's convention. Scores are 0..1 confidence.
 */

export type KeypointName =
  | "nose"
  | "left_eye"
  | "right_eye"
  | "left_ear"
  | "right_ear"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle";

export const KEYPOINT_NAMES: readonly KeypointName[] = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
] as const;

/** A single keypoint in normalized video space (0..1). x = horizontal, y = vertical. */
export interface PoseKeypoint {
  name: KeypointName;
  /** 0..1 normalized to video width */
  x: number;
  /** 0..1 normalized to video height */
  y: number;
  /** 0..1 confidence */
  score: number;
}

/** A frame of pose data produced by the pose engine. */
export interface PoseFrame {
  keypoints: PoseKeypoint[];
  /** 0..1 average of visible keypoint scores */
  score: number;
  /** Source video pixel width at capture time */
  videoWidth: number;
  /** Source video pixel height at capture time */
  videoHeight: number;
  /** Monotonic ms timestamp from performance.now() */
  timestamp: number;
}

/** A 2D point with optional confidence. */
export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point {
  width: number;
  height: number;
}

/** A keypoint projected into display (stage) space. */
export interface DisplayKeypoint extends Point {
  name: KeypointName;
  score: number;
}

/** Severity of a coaching message. Drives color + voice priority. */
export type Severity = "info" | "warning" | "error" | "success";

export type AssistantStatus = "good" | "improve";

export interface Suggestion {
  poseSuggestion: string;
  adjustment: string;
  cameraTip: string;
  status: AssistantStatus;
}

export interface SceneAnalysis {
  background: string;
  lighting: string;
  attire: string;
  occasion: string;
  mood: string;
  topColor: string;
  topColorHex: string;
  confidence: number;
}

/** Live pose result used by Pose Studio mode. */
export interface LivePose {
  box: Box | null;
  center: Point | null;
  keypoints: DisplayKeypoint[];
  quality: number;
  score: number;
  suggestion: Suggestion;
  status: AssistantStatus;
}

export interface RgbStats {
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
  luminance: number;
  count: number;
}
