/**
 * Settings — appearance, camera, voice coach, privacy, data management.
 */
export type Theme = "light" | "dark" | "system";

export type VideoQuality = "480p" | "720p" | "1080p" | "max";

export type FeedbackFrequency = "minimal" | "balanced" | "verbose";

export type Units = "metric" | "imperial";

export interface Settings {
  appearance: {
    theme: Theme;
    reducedMotion: boolean;
    highContrast: boolean;
  };
  camera: {
    quality: VideoQuality;
    facingMode: "user" | "environment";
    mirrored: boolean;
    /** Show FPS overlay */
    showPerfPanel: boolean;
  };
  pose: {
    /** 0..1 minimum keypoint confidence */
    minConfidence: number;
    /** 0..1 sensitivity multiplier (higher = stricter) */
    sensitivity: number;
    /** Detection FPS target */
    targetFps: number;
  };
  voice: {
    enabled: boolean;
    volume: number; // 0..1
    rate: number; // 0.5..2
    frequency: FeedbackFrequency;
  };
  privacy: {
    /** Allow scene analysis (frame sampling) */
    sceneAnalysis: boolean;
    /** Allow voice coach */
    voiceCoach: boolean;
    /** Persist workout history locally */
    analytics: boolean;
    /** Persist captured media locally */
    savedMedia: boolean;
  };
  units: Units;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: {
    theme: "dark",
    reducedMotion: false,
    highContrast: false,
  },
  camera: {
    quality: "720p",
    facingMode: "user",
    mirrored: true,
    showPerfPanel: false,
  },
  pose: {
    minConfidence: 0.3,
    sensitivity: 1.0,
    targetFps: 15,
  },
  voice: {
    enabled: false,
    volume: 0.8,
    rate: 1.0,
    frequency: "balanced",
  },
  privacy: {
    sceneAnalysis: true,
    voiceCoach: true,
    analytics: true,
    savedMedia: true,
  },
  units: "metric",
};
