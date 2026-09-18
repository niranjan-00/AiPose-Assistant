/**
 * Scene analysis — preserved heuristic from the original App.tsx.
 *
 * Pixel sampling on a small canvas produces:
 *   - background classification (7 buckets via HSL)
 *   - lighting classification (low/balanced/bright)
 *   - top color detection (hex + name)
 *   - attire / occasion / mood phrases
 *   - confidence (0..1) — how sure we are of the person's pixel region
 *
 * The whole pass runs every ~1.2s (vs detection every ~65ms).
 */
import type { Box, PoseFrame, RgbStats, SceneAnalysis } from "@/types/pose";

export const EMPTY_ANALYSIS: SceneAnalysis = {
  background: "Indoor room",
  lighting: "Soft balanced light",
  attire: "",
  occasion: "Casual portrait",
  mood: "Relaxed and natural",
  topColor: "",
  topColorHex: "#888888",
  confidence: 0.22,
};

export function classifyLighting(luminance: number): string {
  if (luminance < 72) return "Low light";
  if (luminance > 184) return "Bright light";
  return "Soft balanced light";
}

export function classifyBackground(s: RgbStats): string {
  const { h, s: sat, l } = s;
  if (sat < 0.12 && l > 0.85) return "Bright studio or outdoor";
  if (sat < 0.12 && l > 0.6) return "Plain indoor wall";
  if (sat < 0.12 && l > 0.35) return "Indoor dim room";
  if (sat < 0.12) return "Background blocked";
  if (l > 0.55 && (h < 30 || h > 30)) return "Warm indoor room";
  if (l > 0.55 && (h > 80 && h < 160)) return "Outdoor greenery";
  if (l > 0.7) return "Bright outdoor scene";
  return "Indoor room";
}

export function classifyColor(s: RgbStats): { name: string; hex: string } {
  const { h, s: sat, l } = s;
  let name: string;
  if (l < 0.1) name = "black";
  else if (l > 0.92 && sat < 0.05) name = "white";
  else if (sat < 0.1 && l < 0.4) name = "dark gray";
  else if (sat < 0.1) name = "gray";
  else if (sat < 0.18 && l < 0.3) name = "black";
  else if (sat < 0.18 && l > 0.7) name = "white";
  else if (h < 18 || h > 340) name = "red";
  else if (h < 40) name = "brown";
  else if (h < 70) name = "yellow";
  else if (h < 160) name = "green";
  else if (h < 250) name = "blue";
  else if (h < 290) name = "purple";
  else name = "pink";
  return { name, hex: rgbToHex(s.r, s.g, s.b) };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN:
        h = (gN - bN) / d + (gN < bN ? 6 : 0);
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      default:
        h = (rN - gN) / d + 4;
    }
    h *= 60;
  }
  return [h, s, l];
}

export function toStats(r: number, g: number, b: number, count: number): RgbStats {
  const [h, s, l] = rgbToHsl(r, g, b);
  return {
    r,
    g,
    b,
    h,
    s,
    l,
    luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b,
    count,
  };
}

export function averagePixels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean,
  stride = 2,
): RgbStats {
  let r = 0,
    g = 0,
    b = 0,
    count = 0;
  try {
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;
    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        if (!predicate(x, y)) continue;
        const idx = (y * width + x) * 4;
        r += data[idx]!;
        g += data[idx + 1]!;
        b += data[idx + 2]!;
        count++;
      }
    }
  } catch {
    /* canvas not readable */
  }
  if (count === 0) return toStats(128, 128, 128, 0);
  return toStats(r / count, g / count, b / count, count);
}

export function getScaledTorsoRect(
  frame: PoseFrame,
  w: number,
  h: number,
): Box | null {
  const ls = frame.keypoints.find((k) => k.name === "left_shoulder");
  const rs = frame.keypoints.find((k) => k.name === "right_shoulder");
  const lh = frame.keypoints.find((k) => k.name === "left_hip");
  const rh = frame.keypoints.find((k) => k.name === "right_hip");
  if (!ls || !rs || !lh || !rh) return null;
  if (
    ls.score < 0.2 ||
    rs.score < 0.2 ||
    lh.score < 0.2 ||
    rh.score < 0.2
  )
    return null;
  const minX = Math.min(ls.x, rs.x, lh.x, rh.x) * w;
  const maxX = Math.max(ls.x, rs.x, lh.x, rh.x) * w;
  const minY = Math.min(ls.y, rs.y, lh.y, rh.y) * h;
  const maxY = Math.max(ls.y, rs.y, lh.y, rh.y) * h;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getScaledLegRect(
  frame: PoseFrame,
  w: number,
  h: number,
): Box | null {
  const lh = frame.keypoints.find((k) => k.name === "left_hip");
  const rh = frame.keypoints.find((k) => k.name === "right_hip");
  const lk = frame.keypoints.find((k) => k.name === "left_knee");
  const rk = frame.keypoints.find((k) => k.name === "right_knee");
  if (!lh || !rh || !lk || !rk) return null;
  if (lh.score < 0.2 || rh.score < 0.2 || lk.score < 0.2 || rk.score < 0.2)
    return null;
  const minX = Math.min(lh.x, rh.x, lk.x, rk.x) * w;
  const maxX = Math.max(lh.x, rh.x, lk.x, rk.x) * w;
  const minY = Math.min(lh.y, rh.y, lk.y, rk.y) * h;
  const maxY = Math.max(lh.y, rh.y, lk.y, rk.y) * h;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getRawBoxFromKeypoints(
  frame: PoseFrame,
  minScore = 0.2,
  padX = 0.02,
  padY = 0.03,
): Box | null {
  const vis = frame.keypoints.filter((k) => k.score >= minScore);
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
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    width: maxX - minX + 2 * padX,
    height: maxY - minY + 2 * padY,
  };
}

export function containsPoint(box: Box, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

/**
 * Full scene analysis. Pure function of (video, frame) — no DOM side effects
 * beyond reading pixel data.
 */
export function analyzeFrame(
  video: HTMLVideoElement,
  frame: PoseFrame,
): SceneAnalysis {
  if (!video.videoWidth || !video.videoHeight) return EMPTY_ANALYSIS;
  const targetW = 160;
  const scale = targetW / video.videoWidth;
  const targetH = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return EMPTY_ANALYSIS;
  ctx.drawImage(video, 0, 0, targetW, targetH);

  const rawBox = getRawBoxFromKeypoints(frame);
  const torsoBox = getScaledTorsoRect(frame, targetW, targetH);
  const legBox = getScaledLegRect(frame, targetW, targetH);

  // Background = pixels outside the (padded) person box.
  const bgStats = averagePixels(
    ctx,
    targetW,
    targetH,
    (x, y) => {
      if (!rawBox) return true;
      const nx = x / targetW;
      const ny = y / targetH;
      const padX = 0.04;
      const padY = 0.05;
      return (
        nx < rawBox.x - padX ||
        nx > rawBox.x + rawBox.width + padX ||
        ny < rawBox.y - padY ||
        ny > rawBox.y + rawBox.height + padY
      );
    },
  );

  const topStats = torsoBox
    ? averagePixels(ctx, targetW, targetH, (x, y) =>
        containsPoint(torsoBox, x, y),
      )
    : bgStats;

  const bottomStats = legBox
    ? averagePixels(ctx, targetW, targetH, (x, y) =>
        containsPoint(legBox, x, y),
      )
    : bgStats;

  const background = classifyBackground(bgStats);
  const lighting = classifyLighting(bgStats.luminance);
  const colorTop = classifyColor(topStats);
  const colorBottom = classifyColor(bottomStats);

  // Attire phrase
  let attire: string;
  if (colorTop.name === colorBottom.name) {
    attire = `${describeShade(topStats.l)} ${colorTop.name} outfit`;
  } else {
    attire = `${colorTop.name} top with ${colorBottom.name} bottoms`;
  }

  // Occasion
  let occasion = "Casual portrait";
  if (background.includes("Outdoor") || background.includes("Bright studio")) {
    occasion = "Travel or outdoor portrait";
  } else if (colorTop.name === "white" || colorTop.name === "gray") {
    occasion = "Professional profile";
  } else if (lighting === "Bright light" && colorTop.name === "yellow") {
    occasion = "Casual social photo";
  } else if (attire.includes("dark")) {
    occasion = "Fitness or profile shot";
  }

  // Mood
  let mood = "Relaxed and natural";
  if (lighting === "Low light") mood = "Needs brighter light";
  else if (lighting === "Bright light" && background.includes("Bright")) {
    mood = "Fresh and lively";
  } else if (colorTop.name === "white") {
    mood = "Confident and polished";
  } else if (background.includes("Outdoor")) {
    mood = "Open and expressive";
  }

  // Confidence: how much of the scene's pixels fall in the torso + leg boxes.
  const torsoCount = topStats.count;
  const legCount = bottomStats.count;
  const total = (targetW * targetH) / 4; // stride=2 → /4
  const confidence = Math.max(
    0.22,
    Math.min(0.96, (torsoCount + legCount) / Math.max(1, total)),
  );

  return {
    background,
    lighting,
    attire,
    occasion,
    mood,
    topColor: colorTop.name,
    topColorHex: colorTop.hex,
    confidence,
  };
}

function describeShade(l: number): string {
  if (l < 0.2) return "dark";
  if (l < 0.45) return "muted";
  if (l < 0.7) return "";
  if (l < 0.85) return "soft";
  return "bright";
}
