/**
 * usePoseDetection — wraps TensorFlow.js MoveNet SinglePose Lightning.
 *
 * Refactored from the original App.tsx. Key improvements:
 *   - The detector runs in a rAF loop with throttling to `targetFps`.
 *   - On every detected frame, `onFrame(frame)` is invoked synchronously
 *     so consumers (Pose Studio / Fitness Coach) can react per-frame without
 *     causing React re-renders.
 *   - React state (`latest`) is updated at most ~5 Hz for UI updates,
 *     drastically reducing re-render frequency.
 *   - Tensors are disposed on unmount.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import type { PoseFrame, PoseKeypoint } from "@/types/pose";

export type ModelState = "idle" | "loading" | "ready" | "error";

export interface UsePoseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoWidth: number;
  videoHeight: number;
  active: boolean;
  mirrored: boolean;
  /** Called for every detected frame, synchronously, in the rAF callback */
  onFrame?: (frame: PoseFrame) => void;
  /** Target detection FPS (best effort) */
  targetFps?: number;
}

export interface UsePoseDetectionResult {
  modelState: ModelState;
  error: string | null;
  /** Latest detected pose frame (throttled updates) */
  latest: PoseFrame | null;
  /** Performance metrics */
  perf: {
    fps: number;
    inferenceMs: number;
    backend: string;
  };
  reload: () => void;
}

let sharedDetector: poseDetection.PoseDetector | null = null;

async function getDetector(): Promise<poseDetection.PoseDetector> {
  if (sharedDetector) return sharedDetector;
  try {
    await tf.setBackend("webgl");
  } catch {
    try {
      await tf.setBackend("cpu");
    } catch {
      /* ignore */
    }
  }
  await tf.ready();
  sharedDetector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true,
    } as never,
  );
  return sharedDetector;
}

export function usePoseDetection(
  opts: UsePoseDetectionOptions,
): UsePoseDetectionResult {
  const { videoRef, videoWidth, videoHeight, active, mirrored, onFrame } = opts;
  const [modelState, setModelState] = useState<ModelState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<PoseFrame | null>(null);
  const [perf, setPerf] = useState({ fps: 0, inferenceMs: 0, backend: "" });

  const [reloadKey, setReloadKey] = useState(0);
  const lastDetectRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const fpsFrames = useRef({ last: performance.now(), frames: 0 });
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
    setModelState("loading");
  }, []);

  // Load detector
  useEffect(() => {
    let cancelled = false;
    setModelState("loading");
    setError(null);
    getDetector()
      .then((det) => {
        if (cancelled) return;
        detectorRef.current = det;
        setModelState("ready");
        setPerf((p) => ({
          ...p,
          backend: tf.getBackend() || "unknown",
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setModelState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Detection loop
  useEffect(() => {
    if (!active || modelState !== "ready") return;
    if (!videoRef.current) return;
    if (videoWidth === 0 || videoHeight === 0) return;

    const video = videoRef.current;
    let stopped = false;

    const detectFrame = async () => {
      if (stopped) return;
      const now = performance.now();
      // Throttle to ~targetFps
      const targetFps = opts.targetFps ?? 15;
      const interval = Math.max(33, 1000 / targetFps);
      if (now - lastDetectRef.current >= interval) {
        lastDetectRef.current = now;
        const det = detectorRef.current;
        if (det && video.readyState >= 2) {
          try {
            const t0 = performance.now();
            const poses = await det.estimatePoses(video, {
              maxPoses: 1,
              flipHorizontal: false,
            } as never);
            const t1 = performance.now();
            const pose = poses[0];
            if (pose) {
              // Normalize keypoints to 0..1
              const keypoints: PoseKeypoint[] = pose.keypoints.map((k) => ({
                name: k.name as PoseKeypoint["name"],
                x: video.videoWidth > 0 ? k.x / video.videoWidth : k.x,
                y: video.videoHeight > 0 ? k.y / video.videoHeight : k.y,
                score: k.score ?? 0,
              }));
              const score =
                keypoints.reduce((s, k) => s + k.score, 0) / Math.max(1, keypoints.length);
              const frame: PoseFrame = {
                keypoints,
                score,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                timestamp: now,
              };
              // Per-frame callback for consumers (no React state update)
              onFrameRef.current?.(frame);
              // Throttled UI state update (~5 Hz)
              if (now - lastUiUpdateRef.current > 200) {
                lastUiUpdateRef.current = now;
                setLatest(frame);
              }
              // Update inference perf
              fpsFrames.current.frames++;
              if (now - fpsFrames.current.last > 1000) {
                setPerf((p) => ({
                  ...p,
                  fps: fpsFrames.current.frames,
                  inferenceMs: Math.round(t1 - t0),
                }));
                fpsFrames.current.frames = 0;
                fpsFrames.current.last = now;
              }
            }
          } catch {
            // ignore per-frame errors
          }
        }
      }
      rafRef.current = requestAnimationFrame(detectFrame);
    };
    rafRef.current = requestAnimationFrame(detectFrame);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, modelState, videoRef, videoWidth, videoHeight, mirrored, opts.targetFps]);

  // Dispose shared detector on full unmount
  useEffect(() => {
    return () => {
      if (sharedDetector) {
        sharedDetector.dispose();
        sharedDetector = null;
      }
    };
  }, []);

  return { modelState, error, latest, perf, reload };
}
