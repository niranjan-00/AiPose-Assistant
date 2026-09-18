/**
 * CameraView — shared video element + skeleton overlay for all camera-based
 * modes. Receives pose frame data from the parent (who runs the pose engine).
 *
 * Visualizes:
 *   - keypoints (circles with confidence glow)
 *   - bones (lines, filtered by score)
 *   - skeleton from SKELETON_CONNECTIONS
 *   - status colors: success = good, warning = adjust
 */
import { type ReactNode, useMemo } from "react";
import type { PoseFrame, DisplayKeypoint } from "@/types/pose";
import { SKELETON_CONNECTIONS } from "@/constants/pose";
import { mapManyKeypoints, getDisplayBox, getDisplayCenter, getRawBox } from "@/lib/pose/project";

export interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoWidth: number;
  videoHeight: number;
  stageWidth: number;
  stageHeight: number;
  mirrored: boolean;
  /** Latest pose frame to render; null = no person detected */
  frame: PoseFrame | null;
  /** Show/hide skeleton overlay */
  showOverlay: boolean;
  /** Status color override ("good" | "improve") */
  status?: "good" | "improve";
  /** Children rendered on top of overlay */
  children?: ReactNode;
  /** Reference fallback image when camera is off */
  fallback?: string;
  cameraActive: boolean;
}

export function CameraView({
  videoRef,
  videoWidth,
  videoHeight,
  stageWidth,
  stageHeight,
  mirrored,
  frame,
  showOverlay,
  status = "improve",
  children,
  fallback = "/images/pose-reference.jpg",
  cameraActive,
}: CameraViewProps) {
  const displayKeypoints: DisplayKeypoint[] = useMemo(() => {
    if (!frame || stageWidth === 0 || stageHeight === 0) return [];
    return mapManyKeypoints(frame.keypoints, {
      videoWidth,
      videoHeight,
      stageWidth,
      stageHeight,
      mirrored,
    });
  }, [frame, stageWidth, stageHeight, videoWidth, videoHeight, mirrored]);

  const displayBox = useMemo(() => {
    if (!frame) return null;
    const raw = getRawBox(frame.keypoints, 0.2, 0.02, 0.03);
    return getDisplayBox(raw, {
      videoWidth,
      videoHeight,
      stageWidth,
      stageHeight,
      mirrored,
    });
  }, [frame, stageWidth, stageHeight, videoWidth, videoHeight, mirrored]);

  const center = useMemo(() => {
    if (!frame || stageWidth === 0) return null;
    return getDisplayCenter(
      frame.keypoints,
      { videoWidth, videoHeight, stageWidth, stageHeight, mirrored },
      displayBox,
    );
  }, [frame, stageWidth, stageHeight, videoWidth, videoHeight, mirrored, displayBox]);

  const kpByName = useMemo(() => {
    const m = new Map<string, DisplayKeypoint>();
    for (const kp of displayKeypoints) m.set(kp.name, kp);
    return m;
  }, [displayKeypoints]);

  const accentColor = status === "good" ? "#b8ff5a" : "#f5c84c";

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Fallback image when camera off */}
      {!cameraActive && (
        <img
          src={fallback}
          alt="Reference pose"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
          aria-hidden="true"
        />
      )}

      {/* Video element (always present so ref is stable) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover ${
          mirrored ? "-scale-x-100" : ""
        } ${!cameraActive ? "opacity-0" : ""}`}
        aria-hidden="true"
      />

      {/* Subtle gradient overlay for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

      {/* Skeleton overlay */}
      {showOverlay && cameraActive && displayKeypoints.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${stageWidth} ${stageHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter id="kp-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Bones */}
          {SKELETON_CONNECTIONS.map(([from, to], i) => {
            const a = kpByName.get(from);
            const b = kpByName.get(to);
            if (!a || !b) return null;
            if (a.score < 0.25 || b.score < 0.25) return null;
            const avg = (a.score + b.score) / 2;
            const opacity = Math.min(1, avg * 1.4);
            return (
              <line
                key={`bone-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={accentColor}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={opacity}
              />
            );
          })}

          {/* Keypoints */}
          {displayKeypoints
            .filter((k) => k.score >= 0.25)
            .map((k) => {
              const isMajor =
                k.name.includes("shoulder") ||
                k.name.includes("hip") ||
                k.name.includes("knee") ||
                k.name.includes("ankle");
              return (
                <circle
                  key={`kp-${k.name}`}
                  cx={k.x}
                  cy={k.y}
                  r={isMajor ? 6 : 4}
                  fill={accentColor}
                  filter="url(#kp-glow)"
                  opacity={Math.min(1, k.score * 1.4)}
                />
              );
            })}

          {/* Center marker */}
          {center && (
            <circle
              cx={center.x}
              cy={center.y}
              r={8}
              fill="none"
              stroke={accentColor}
              strokeWidth={1.5}
              opacity={0.6}
            />
          )}
        </svg>
      )}

      {children}
    </div>
  );
}
