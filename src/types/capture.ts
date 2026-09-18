/**
 * Capture types — photo / video items stored in the gallery.
 */
export type CaptureType = "photo" | "video";

export interface CaptureItem {
  id: string;
  type: CaptureType;
  /** Object URL for video, data URL for photo */
  url: string;
  name: string;
  createdAt: number;
  /** ms duration for video */
  durationMs?: number;
  /** Optional analysis (Pose Studio / Fitness Coach snapshot) */
  analysis?: Record<string, string>;
  suggestion?: string;
  thumbnail?: string;
  /** Form score at capture time (Fitness Coach mode) */
  formScore?: number;
  exerciseId?: string;
  repCount?: number;
}

export const MAX_CAPTURES_IN_MEMORY = 30;
