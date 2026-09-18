/**
 * useCamera — wraps getUserMedia with proper lifecycle, device selection,
 * resolution presets, and error states.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoQuality } from "@/types/settings";
import { VIDEO_QUALITY_PRESETS } from "@/constants/pose";

export type CameraErrorType =
  | "permission_denied"
  | "not_found"
  | "in_use"
  | "unsupported"
  | "unknown";

export interface CameraError {
  type: CameraErrorType;
  message: string;
  userMessage: string;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface UseCameraOptions {
  active: boolean;
  facingMode: "user" | "environment";
  quality: VideoQuality;
  /** Mirror the video preview (for front camera) */
  mirrored?: boolean;
  /** If provided, restrict to this device */
  deviceId?: string;
  audio?: boolean;
}

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  error: CameraError | null;
  devices: CameraDevice[];
  /** Pixel dimensions actually granted by the browser */
  videoWidth: number;
  videoHeight: number;
  ready: boolean;
  refreshDevices: () => Promise<void>;
}

function describeError(err: unknown): CameraError {
  const e = err as DOMException & { name?: string };
  const name = e?.name ?? "UnknownError";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      type: "permission_denied",
      message: String(err),
      userMessage:
        "Camera permission denied. Enable camera access in your browser to use AiPose.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      type: "not_found",
      message: String(err),
      userMessage:
        "No camera found. Connect a camera and reload.",
    };
  }
  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    name === "OverconstrainedError"
  ) {
    return {
      type: "in_use",
      message: String(err),
      userMessage:
        "Camera is being used by another application. Close other camera apps and try again.",
    };
  }
  if (name === "TypeError" || navigator?.mediaDevices === undefined) {
    return {
      type: "unsupported",
      message: String(err),
      userMessage:
        "Your browser does not support camera access. Try Chrome, Firefox, or Safari.",
    };
  }
  return {
    type: "unknown",
    message: String(err),
    userMessage: "Could not start the camera. Please reload and try again.",
  };
}

export function useCamera(opts: UseCameraOptions): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [ready, setReady] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setDevices(cams);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!opts.active) {
      setReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
      }
      return;
    }
    let cancelled = false;
    setReady(false);
    setError(null);
    const v = videoRef.current;

    async function start() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new DOMException("getUserMedia not supported", "TypeError");
        }
        const preset = VIDEO_QUALITY_PRESETS[opts.quality] ?? VIDEO_QUALITY_PRESETS["720p"];
        const constraints: MediaStreamConstraints = {
          audio: opts.audio ?? false,
          video: opts.deviceId
            ? {
                deviceId: { exact: opts.deviceId },
                width: { ideal: preset.width },
                height: { ideal: preset.height },
              }
            : {
                facingMode: opts.facingMode,
                width: { ideal: preset.width },
                height: { ideal: preset.height },
              },
        };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        setStream(s);
        if (v) {
          v.srcObject = s;
          v.onloadedmetadata = () => {
            setVideoWidth(v.videoWidth);
            setVideoHeight(v.videoHeight);
            v.play().then(() => setReady(true)).catch(() => setReady(true));
          };
        }
        await refreshDevices();
      } catch (err) {
        if (!cancelled) {
          setError(describeError(err));
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
      }
      if (v) {
        v.srcObject = null;
      }
      setReady(false);
    };
  }, [opts.active, opts.facingMode, opts.quality, opts.deviceId, opts.audio, refreshDevices, videoRef]);

  return {
    videoRef,
    stream,
    error,
    devices,
    videoWidth,
    videoHeight,
    ready,
    refreshDevices,
  };
}
