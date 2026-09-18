/**
 * PoseStudio — the original AiPose mode. Live camera + skeleton + pose
 * quality score + scene analysis + photo capture + recording + gallery.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseFrame, SceneAnalysis, LivePose } from "@/types/pose";
import type { CaptureItem } from "@/types/capture";
import { MAX_CAPTURES_IN_MEMORY } from "@/types/capture";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useSettings } from "@/hooks/useSettings";
import { analyzeFrame, EMPTY_ANALYSIS } from "@/lib/scene/analyze";
import { evaluatePose, isPersonPose } from "@/lib/pose/evaluate";
import {
  captureFrameDataUrl,
  downloadUrl,
  formatDuration,
  getRecordingMimeType,
} from "@/lib/capture/recorder";
import { ANALYSIS_INTERVAL_MS } from "@/constants/pose";
import { CameraView } from "@/components/CameraView";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

type CaptureMode = "photo" | "video";

export function PoseStudio() {
  const { settings } = useSettings();
  const [cameraActive, setCameraActive] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [autoCapture, setAutoCapture] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [livePose, setLivePose] = useState<LivePose | null>(null);
  const [analysis, setAnalysis] = useState<SceneAnalysis>(EMPTY_ANALYSIS);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const latestFrameRef = useRef<PoseFrame | null>(null);
  const analysisRef = useRef<SceneAnalysis>(EMPTY_ANALYSIS);
  const lastAnalysisAt = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cam = useCamera({
    active: cameraActive,
    facingMode: settings.camera.facingMode,
    quality: settings.camera.quality,
    mirrored: settings.camera.mirrored,
  });

  // Mirror stream ref for recorder access
  useEffect(() => {
    streamRef.current = cam.stream;
  }, [cam.stream]);

  // Track stage size
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setStageSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const update = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Pose detection with per-frame callback
  const handleFrame = useCallback(
    (frame: PoseFrame) => {
      latestFrameRef.current = frame;
      const ev = evaluatePose({
        frame,
        stageWidth: stageSize.w,
        stageHeight: stageSize.h,
        analysis: analysisRef.current,
      });
      if (!isPersonPose(frame)) {
        setLivePose(null);
        setAnalysis(EMPTY_ANALYSIS);
        analysisRef.current = EMPTY_ANALYSIS;
        return;
      }
      // Build LivePose for overlay (display coords)
      // CameraView will recompute the display coords from raw frame, so we
      // only need the suggestion / quality / score here.
      setLivePose({
        box: null,
        center: null,
        keypoints: [],
        quality: ev.quality,
        score: frame.score,
        suggestion: ev.suggestion,
        status: ev.status,
      });
      // Throttled scene analysis
      const now = performance.now();
      if (now - lastAnalysisAt.current > ANALYSIS_INTERVAL_MS) {
        lastAnalysisAt.current = now;
        const video = cam.videoRef.current;
        if (video && video.videoWidth > 0) {
          const an = analyzeFrame(video, frame);
          setAnalysis(an);
          analysisRef.current = an;
        }
      }
    },
    [stageSize.w, stageSize.h, cam.videoRef],
  );

  const pose = usePoseDetection({
    videoRef: cam.videoRef,
    videoWidth: cam.videoWidth,
    videoHeight: cam.videoHeight,
    active: cameraActive,
    mirrored: settings.camera.mirrored,
    onFrame: handleFrame,
    targetFps: settings.pose.targetFps,
  });

  // Auto-capture
  useEffect(() => {
    if (!autoCapture) return;
    if (captureMode !== "photo") return;
    if (livePose?.status !== "good") return;
    const t = setTimeout(() => {
      if (livePose?.status === "good" && cam.videoRef.current) {
        triggerCapture();
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCapture, captureMode, livePose?.status, cam.videoRef]);

  // Recording timer
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordingMs((m) => m + 250), 250);
    return () => clearInterval(id);
  }, [recording]);

  // Stop recording if camera turns off
  useEffect(() => {
    if (!cameraActive && recording && recorderRef.current) {
      if (recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      setRecording(false);
    }
  }, [cameraActive, recording]);

  function triggerCapture(): void {
    const video = cam.videoRef.current;
    if (!video) return;
    const url = captureFrameDataUrl(video, settings.camera.mirrored);
    if (!url) return;
    const id = `photo-${Date.now()}`;
    const item: CaptureItem = {
      id,
      type: "photo",
      url,
      name: `AiPose-${id}`,
      createdAt: Date.now(),
      analysis: {
        Background: analysis.background,
        Lighting: analysis.lighting,
        Attire: analysis.attire,
        Occasion: analysis.occasion,
      },
      suggestion: livePose?.suggestion.poseSuggestion,
      formScore: livePose?.quality,
    };
    setCaptures((c) => [item, ...c].slice(0, MAX_CAPTURES_IN_MEMORY));
    setSelectedId(id);
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  }

  function startRecording(): void {
    if (!streamRef.current) return;
    const mime = getRecordingMimeType();
    try {
      const r = new MediaRecorder(streamRef.current, { mimeType: mime });
      recorderRef.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      r.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: mime });
        recordChunksRef.current = [];
        const url = URL.createObjectURL(blob);
        const id = `video-${Date.now()}`;
        const item: CaptureItem = {
          id,
          type: "video",
          url,
          name: `AiPose-${id}`,
          createdAt: Date.now(),
          durationMs: recordingMs,
          suggestion: livePose?.suggestion.poseSuggestion,
        };
        setCaptures((c) => [item, ...c].slice(0, MAX_CAPTURES_IN_MEMORY));
        setSelectedId(id);
      };
      r.start(250);
      setRecordingMs(0);
      setRecording(true);
    } catch {
      /* ignore */
    }
  }

  function stopRecording(): void {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  function handleShutter(): void {
    if (captureMode === "video") {
      if (recording) stopRecording();
      else startRecording();
    } else {
      triggerCapture();
    }
  }

  const selected = selectedId
    ? captures.find((c) => c.id === selectedId) ?? captures[0]
    : captures[0];

  const quality = livePose?.quality ?? 0;
  const qualityLabel =
    quality >= 84 ? "Locked" : quality >= 68 ? "Refining" : quality > 0 ? "Needs adjustment" : "No person";

  return (
    <div className="flex h-full flex-col">
      <div ref={stageRef} className="relative flex-1 overflow-hidden">
        <CameraView
          videoRef={cam.videoRef}
          videoWidth={cam.videoWidth}
          videoHeight={cam.videoHeight}
          stageWidth={stageSize.w}
          stageHeight={stageSize.h}
          mirrored={settings.camera.mirrored}
          frame={pose.latest}
          showOverlay={overlayEnabled}
          status={livePose?.status ?? "improve"}
          cameraActive={cameraActive}
        >
          {/* Flash effect */}
          {flash && (
            <div className="pointer-events-none absolute inset-0 animate-camera-flash bg-white" />
          )}

          {/* Header */}
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 pt-safe">
            <div>
              <p className="text-[10px] uppercase tracking-[0.34em] text-white/60">
                AiPose Studio
              </p>
              <h1 className="text-lg font-bold tracking-tight">Pose Studio</h1>
            </div>
            {pose.perf.fps > 0 && settings.camera.showPerfPanel && (
              <div className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-mono text-white/70">
                {pose.perf.fps}fps · {pose.perf.inferenceMs}ms
              </div>
            )}
          </div>

          {/* Quality / Suggestion (top-right) */}
          {cameraActive && livePose && (
            <div className="absolute right-4 top-16 z-10 w-44 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                {qualityLabel}
              </p>
              <p className="mt-0.5 text-2xl font-bold text-lime-300">{quality}</p>
              <p className="mt-1 text-xs text-white/80">
                {livePose.suggestion.poseSuggestion}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">
                {livePose.suggestion.adjustment}
              </p>
            </div>
          )}

          {/* Error banner */}
          {(cam.error || pose.error) && (
            <div className="absolute left-4 right-4 top-24 z-10 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-200">
              {cam.error?.userMessage ?? pose.error}
            </div>
          )}

          {/* Start CTA */}
          {!cameraActive && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Get started
              </p>
              <h2 className="text-2xl font-bold">Real-time pose analysis</h2>
              <p className="max-w-sm text-sm text-white/60">
                Turn on your camera to see live skeleton, pose quality, scene analysis, and capture photos or record video.
              </p>
              <Button variant="primary" size="lg" onClick={() => setCameraActive(true)}>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20">
                  ▶
                </span>
                Start camera
              </Button>
            </div>
          )}

          {/* Bottom dock */}
          <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-3 bg-gradient-to-t from-black to-transparent p-4 pb-safe">
            {/* Capture mode toggle */}
            <div className="flex items-center justify-center gap-2">
              <Segmented
                value={captureMode}
                onChange={(v) => setCaptureMode(v as CaptureMode)}
                options={[
                  { value: "photo", label: "Photo" },
                  { value: "video", label: "Video" },
                ]}
              />
              <IconButton
                label="Toggle skeleton overlay"
                active={overlayEnabled}
                onClick={() => setOverlayEnabled((v) => !v)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="5" r="2" fill="currentColor" />
                  <path d="M12 7v6m-4-2h8m-8 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </IconButton>
              <IconButton
                label="Auto-capture on good pose"
                active={autoCapture}
                onClick={() => setAutoCapture((v) => !v)}
              >
                <span className="text-xs font-bold">A</span>
              </IconButton>
            </div>
            <div className="flex items-center justify-between gap-2">
              {/* Gallery */}
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-1 backdrop-blur-md"
                aria-label="Open gallery"
              >
                <div className="relative h-10 w-8 overflow-hidden rounded-md bg-zinc-800">
                  {captures[0] && (
                    <img
                      src={captures[0].type === "photo" ? captures[0].url : captures[0].thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  {captures.length > 0 && (
                    <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/80 px-1 text-[10px] text-white">
                      {captures.length}
                    </span>
                  )}
                </div>
              </button>

              {/* Shutter */}
              <button
                type="button"
                onClick={handleShutter}
                disabled={!cameraActive}
                aria-label={captureMode === "video" ? (recording ? "Stop recording" : "Start recording") : "Capture photo"}
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 transition-all disabled:opacity-40",
                  recording && "border-red-400",
                  !recording && livePose?.status === "good" && "animate-shutter-ready",
                )}
              >
                <span
                  className={cn(
                    "rounded-full",
                    captureMode === "video"
                      ? recording
                        ? "h-6 w-6 bg-red-500"
                        : "h-5 w-5 bg-red-500"
                      : "h-12 w-12 bg-white",
                  )}
                />
              </button>

              {/* Flip / Settings */}
              <IconButton
                label="Flip camera"
                onClick={() => {
                  // Flip via settings update
                  window.dispatchEvent(new CustomEvent("aipose:flip-camera"));
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12a8 8 0 0112-6.9M20 12a8 8 0 01-12 6.9M4 4l2 2m14 14l-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M9 6L4 4m0 0l5 1M15 18l5 2m0 0l-5-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </IconButton>
            </div>
            {recording && (
              <div className="text-center text-xs font-mono text-red-300">
                REC {formatDuration(recordingMs)}
              </div>
            )}
          </div>
        </CameraView>
      </div>

      {/* Gallery */}
      <Sheet open={galleryOpen} onClose={() => setGalleryOpen(false)} title="Gallery" side="bottom">
        {captures.length === 0 ? (
          <p className="text-sm text-white/50">No captures yet.</p>
        ) : (
          <div className="space-y-4">
            {selected && (
              <div className="space-y-3">
                {selected.type === "video" ? (
                  <video src={selected.url} controls className="w-full rounded-2xl" />
                ) : (
                  <img src={selected.url} alt={selected.name} className="w-full rounded-2xl" />
                )}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-white/60">
                    {new Date(selected.createdAt).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => downloadUrl(selected.url, `${selected.name}.${selected.type === "video" ? "webm" : "jpg"}`)}
                    >
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setCaptures((c) => c.filter((x) => x.id !== selected.id));
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {captures.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "aspect-[3/4] overflow-hidden rounded-md border-2 bg-zinc-900",
                    c.id === selectedId ? "border-lime-300" : "border-transparent",
                  )}
                >
                  {c.type === "photo" ? (
                    <img src={c.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                      Video
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      {/* Bottom info panel when not exercising */}
      <div className="border-t border-white/10 bg-black/80 p-3 backdrop-blur-xl">
        {cameraActive && livePose ? (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Card>
              <p className="text-[10px] uppercase text-white/40">Background</p>
              <p className="font-semibold text-white">{analysis.background}</p>
            </Card>
            <Card>
              <p className="text-[10px] uppercase text-white/40">Lighting</p>
              <p className="font-semibold text-white">{analysis.lighting}</p>
            </Card>
            <Card>
              <p className="text-[10px] uppercase text-white/40">Confidence</p>
              <p className="font-semibold text-white">{Math.round(analysis.confidence * 100)}%</p>
            </Card>
          </div>
        ) : (
          <p className="text-center text-xs text-white/40">
            Start the camera to see live pose analysis
          </p>
        )}
      </div>
    </div>
  );
}
