/**
 * Coordinate projection — MoveNet produces normalized (0..1) keypoints in
 * source video space. The video is rendered into a stage <div> with
 * `object-fit: cover`. We need to map normalized video coords -> stage px.
 */
import type { Box, DisplayKeypoint, PoseKeypoint, Point } from "@/types/pose";

export interface ProjectionConfig {
  videoWidth: number;
  videoHeight: number;
  stageWidth: number;
  stageHeight: number;
  mirrored: boolean;
}

/**
 * For `object-fit: cover` the video is scaled by max(scaleW, scaleH) and
 * centered. Compute the scale and the (x, y) offset of the visible crop.
 */
export function computeCoverTransform(cfg: ProjectionConfig): {
  scale: number;
  offsetX: number;
  offsetY: number;
} {
  const scaleW = cfg.stageWidth / cfg.videoWidth;
  const scaleH = cfg.stageHeight / cfg.videoHeight;
  const scale = Math.max(scaleW, scaleH);
  const scaledW = cfg.videoWidth * scale;
  const scaledH = cfg.videoHeight * scale;
  const offsetX = (cfg.stageWidth - scaledW) / 2;
  const offsetY = (cfg.stageHeight - scaledH) / 2;
  return { scale, offsetX, offsetY };
}

export function mapKeypoint(
  kp: PoseKeypoint,
  cfg: ProjectionConfig,
  transform?: ReturnType<typeof computeCoverTransform>,
): DisplayKeypoint {
  const t = transform ?? computeCoverTransform(cfg);
  // kp.x is 0..1 of source video width; convert to source px, then to stage px.
  let px = kp.x * cfg.videoWidth * t.scale + t.offsetX;
  const py = kp.y * cfg.videoHeight * t.scale + t.offsetY;
  if (cfg.mirrored) {
    px = cfg.stageWidth - px;
  }
  return { x: px, y: py, name: kp.name, score: kp.score };
}

export function mapManyKeypoints(
  keypoints: ReadonlyArray<PoseKeypoint>,
  cfg: ProjectionConfig,
): DisplayKeypoint[] {
  const t = computeCoverTransform(cfg);
  return keypoints.map((kp) => mapKeypoint(kp, cfg, t));
}

/**
 * Bounding box of all visible keypoints in source normalized coords.
 */
export function getRawBox(
  keypoints: ReadonlyArray<PoseKeypoint>,
  minScore = 0.2,
  padX = 0.02,
  padY = 0.03,
): Box | null {
  const vis = keypoints.filter((k) => k.score >= minScore);
  if (vis.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const k of vis) {
    if (k.x < minX) minX = k.x;
    if (k.y < minY) minY = k.y;
    if (k.x > maxX) maxX = k.x;
    if (k.y > maxY) maxY = k.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const px = Math.max(padX, padX);
  const py = Math.max(padY, padY);
  return {
    x: Math.max(0, minX - px),
    y: Math.max(0, minY - py),
    width: w + 2 * px,
    height: h + 2 * py,
  };
}

/**
 * Project a raw (normalized) box into stage coordinates with padding.
 */
export function getDisplayBox(
  rawBox: Box | null,
  cfg: ProjectionConfig,
  padX = 24,
  padY = 32,
): Box | null {
  if (!rawBox) return null;
  const t = computeCoverTransform(cfg);
  const cornerTL = mapKeypoint(
    { name: "nose", x: rawBox.x, y: rawBox.y, score: 1 },
    cfg,
    t,
  );
  const cornerBR = mapKeypoint(
    {
      name: "nose",
      x: rawBox.x + rawBox.width,
      y: rawBox.y + rawBox.height,
      score: 1,
    },
    cfg,
    t,
  );
  return {
    x: cornerTL.x - padX,
    y: cornerTL.y - padY,
    width: cornerBR.x - cornerTL.x + padX * 2,
    height: cornerBR.y - cornerTL.y + padY * 2,
  };
}

/**
 * Compute the display-space center of the person. Prefer hip midpoint when
 * visible (more stable than the bbox center). Falls back to bbox center
 * weighted toward the lower half (the body's center of gravity is around the
 * hips, slightly below the geometric bbox center).
 */
export function getDisplayCenter(
  keypoints: ReadonlyArray<PoseKeypoint>,
  cfg: ProjectionConfig,
  displayBox: Box | null,
): Point | null {
  const lHip = keypoints.find((k) => k.name === "left_hip");
  const rHip = keypoints.find((k) => k.name === "right_hip");
  if (
    lHip &&
    rHip &&
    lHip.score >= 0.3 &&
    rHip.score >= 0.3
  ) {
    const mid = {
      x: (lHip.x + rHip.x) / 2,
      y: (lHip.y + rHip.y) / 2,
    };
    const mapped = mapKeypoint(
      { name: "nose", x: mid.x, y: mid.y, score: 1 },
      cfg,
    );
    return { x: mapped.x, y: mapped.y };
  }
  if (!displayBox) return null;
  return {
    x: displayBox.x + displayBox.width / 2,
    y: displayBox.y + displayBox.height * 0.55,
  };
}

export function clampBox(
  box: Box,
  width: number,
  height: number,
): Box {
  return {
    x: Math.max(0, Math.min(box.x, width)),
    y: Math.max(0, Math.min(box.y, height)),
    width: Math.max(0, Math.min(box.width, width - box.x)),
    height: Math.max(0, Math.min(box.height, height - box.y)),
  };
}

export function containsPoint(box: Box, p: Point): boolean {
  return (
    p.x >= box.x &&
    p.x <= box.x + box.width &&
    p.y >= box.y &&
    p.y <= box.y + box.height
  );
}
