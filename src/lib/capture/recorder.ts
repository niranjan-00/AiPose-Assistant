/**
 * MediaRecorder + photo capture helpers.
 * Preserved and refactored from the original AiPose App.tsx.
 */

export function getRecordingMimeType(): string {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return "video/webm";
}

export function downloadUrl(url: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function captureFrameDataUrl(
  video: HTMLVideoElement,
  mirrored: boolean,
  quality = 0.85,
): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function formatSeconds(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return formatDuration(ms);
}

/**
 * Revoke object URLs to avoid memory leaks. Walks an array of CaptureItem.
 */
export function revokeCaptureUrls(
  items: Array<{ url: string; type: string }>,
): void {
  for (const it of items) {
    if (it.type === "video" && it.url.startsWith("blob:")) {
      URL.revokeObjectURL(it.url);
    }
  }
}
