import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";

type AssistantStatus = "good" | "improve";
type FacingMode = "user" | "environment";
type ModelState = "idle" | "loading" | "ready" | "error";
type CaptureMode = "photo" | "video";
type PanelMode = "live" | "analyze" | "photo" | "video" | "pose" | "ai";
type CaptureType = "photo" | "video";

type Point = {
  x: number;
  y: number;
};

type Box = Point & {
  width: number;
  height: number;
};

type DisplayKeypoint = Point & {
  name: string;
  score: number;
};

type Suggestion = {
  poseSuggestion: string;
  adjustment: string;
  cameraTip: string;
  status: AssistantStatus;
};

type SceneAnalysis = {
  background: string;
  lighting: string;
  attire: string;
  occasion: string;
  mood: string;
  topColor: string;
  topColorHex: string;
  confidence: number;
};

type LivePose = {
  box: Box;
  center: Point;
  keypoints: DisplayKeypoint[];
  quality: number;
  score: number;
  suggestion: Suggestion;
  status: AssistantStatus;
};

type RgbStats = {
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
  luminance: number;
  count: number;
};

type CaptureItem = {
  id: string;
  type: CaptureType;
  url: string;
  name: string;
  createdAt: number;
  analysis: SceneAnalysis;
  suggestion: Suggestion;
  thumbnail: string;
  durationMs?: number;
};

const EMPTY_ANALYSIS: SceneAnalysis = {
  background: "Waiting for person",
  lighting: "Waiting for camera",
  attire: "Not detected",
  occasion: "Not detected",
  mood: "Calibrating",
  topColor: "Unknown",
  topColorHex: "#ffffff",
  confidence: 0,
};

const WAITING_SUGGESTION: Suggestion = {
  poseSuggestion: "Step into the frame",
  adjustment: "Show your upper body clearly",
  cameraTip: "Keep camera steady at chest height",
  status: "improve",
};

const SKELETON_CONNECTIONS = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["nose", "left_eye"],
  ["nose", "right_eye"],
] as const;

const MIN_KEYPOINT_SCORE = 0.28;
const DETECTION_INTERVAL_MS = 95;
const ANALYSIS_INTERVAL_MS = 850;

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef(0);
  const loopRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);
  const lastAnalysisRef = useRef(0);
  const lastAutoCaptureRef = useRef(0);
  const analysisRef = useRef<SceneAnalysis>(EMPTY_ANALYSIS);
  const latestFrameRef = useRef("/images/pose-reference.jpg");
  const fpsRef = useRef({ last: performance.now(), frames: 0 });

  const [modelState, setModelState] = useState<ModelState>("idle");
  const [modelReloadKey, setModelReloadKey] = useState(0);
  const [modelError, setModelError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [mirrored, setMirrored] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [panelMode, setPanelMode] = useState<PanelMode>("live");
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [livePose, setLivePose] = useState<LivePose | null>(null);
  const [analysis, setAnalysis] = useState<SceneAnalysis>(EMPTY_ANALYSIS);
  const [stageSize, setStageSize] = useState({ width: 1, height: 1 });
  const [videoSize, setVideoSize] = useState({ width: 1, height: 1 });
  const [snapshot, setSnapshot] = useState("/images/pose-reference.jpg");
  const [flash, setFlash] = useState(false);
  const [fps, setFps] = useState(0);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);

  const personVisible = Boolean(livePose);
  const activeSuggestion = livePose?.suggestion ?? WAITING_SUGGESTION;
  const activeStatus = livePose?.status ?? "improve";
  const modelLabel = modelState === "ready" ? "MoveNet ready" : modelState === "loading" ? "Loading MoveNet" : modelState === "error" ? "Model error" : "Model idle";
  const cameraLabel = cameraActive ? (personVisible ? "Person detected" : "Waiting for person") : "Camera off";

  const captureEnabled = captureMode === "video" ? cameraActive : cameraActive && personVisible;

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    let active = true;

    async function loadDetector() {
      try {
        setModelState("loading");
        setModelError("");
        await tf.setBackend("webgl").catch(() => tf.setBackend("cpu"));
        await tf.ready();

        const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        });

        if (!active) {
          detector.dispose();
          return;
        }

        detectorRef.current = detector;
        setModelState("ready");
      } catch (error) {
        if (!active) return;
        setModelError(error instanceof Error ? error.message : "Unable to load pose model");
        setModelState("error");
      }
    }

    loadDetector();

    return () => {
      active = false;
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, [modelReloadKey]);

  const stopCamera = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!cameraActive) {
      stopCamera();
      setLivePose(null);
      setAnalysis(EMPTY_ANALYSIS);
      return;
    }

    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access is not supported in this browser.");
        setCameraActive(false);
        return;
      }

      try {
        setCameraError("");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 1920 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError("Camera permission blocked or unavailable.");
        setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraActive, facingMode, stopCamera]);

  useEffect(() => {
    const updateSize = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      setStageSize({ width: Math.max(1, rect?.width ?? window.innerWidth), height: Math.max(1, rect?.height ?? window.innerHeight) });
    };

    updateSize();
    const observer = stageRef.current ? new ResizeObserver(updateSize) : null;
    if (stageRef.current) observer?.observe(stageRef.current);
    window.addEventListener("resize", updateSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    if (!cameraActive || modelState !== "ready") {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
      return;
    }

    let cancelled = false;

    async function detectFrame(now: number) {
      if (cancelled) return;
      loopRef.current = requestAnimationFrame(detectFrame);

      const detector = detectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2) return;
      if (now - lastDetectRef.current < DETECTION_INTERVAL_MS) return;
      lastDetectRef.current = now;

      const width = video.videoWidth || videoSize.width;
      const height = video.videoHeight || videoSize.height;
      if (width <= 1 || height <= 1) return;
      setVideoSize((current) => (current.width === width && current.height === height ? current : { width, height }));

      try {
        const poses = await detector.estimatePoses(video, { maxPoses: 1, flipHorizontal: false });
        const pose = poses[0];
        if (!pose || !isPersonPose(pose)) {
          setLivePose(null);
          setAnalysis(EMPTY_ANALYSIS);
          return;
        }

        if (now - lastAnalysisRef.current > ANALYSIS_INTERVAL_MS) {
          const nextAnalysis = analyzeFrame(video, pose);
          setAnalysis(nextAnalysis);
          analysisRef.current = nextAnalysis;
          lastAnalysisRef.current = now;
        }

        const evaluation = evaluatePose(pose, { width, height }, analysisRef.current);
        const keypoints = pose.keypoints.map((keypoint) => mapKeypoint(keypoint, { width, height }, stageSize, mirrored));
        const visiblePoints = keypoints.filter((keypoint) => keypoint.score >= MIN_KEYPOINT_SCORE);
        const box = getDisplayBox(visiblePoints, stageSize);
        const center = getDisplayCenter(keypoints, box);

        setLivePose({
          box,
          center,
          keypoints,
          quality: evaluation.quality,
          score: evaluation.score,
          suggestion: evaluation.suggestion,
          status: evaluation.suggestion.status,
        });

        fpsRef.current.frames += 1;
        if (now - fpsRef.current.last > 1000) {
          setFps(fpsRef.current.frames);
          fpsRef.current = { last: now, frames: 0 };
        }
      } catch (error) {
        setModelError(error instanceof Error ? error.message : "Pose detection failed");
      }
    }

    loopRef.current = requestAnimationFrame(detectFrame);

    return () => {
      cancelled = true;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    };
  }, [cameraActive, mirrored, modelState, stageSize, videoSize.height, videoSize.width]);

  const triggerCapture = useCallback(() => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 220);

    const video = videoRef.current;
    if (video && streamRef.current && video.videoWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        if (mirrored) {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        const createdAt = Date.now();
        const item: CaptureItem = {
          id: `photo-${createdAt}`,
          type: "photo",
          url: dataUrl,
          name: `posepilot-photo-${createdAt}.jpg`,
          createdAt,
          analysis: analysisRef.current,
          suggestion: livePose?.suggestion ?? WAITING_SUGGESTION,
          thumbnail: dataUrl,
        };
        latestFrameRef.current = dataUrl;
        setSnapshot(dataUrl);
        setCaptures((current) => [item, ...current].slice(0, 30));
        setSelectedCaptureId(item.id);
      }
    }
  }, [livePose?.suggestion, mirrored]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !cameraActive) {
      setCameraError("Start the camera before recording video.");
      return;
    }

    if (!("MediaRecorder" in window)) {
      setCameraError("Video recording is not supported in this browser.");
      return;
    }

    try {
      const mimeType = getRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const recordingThumbnail = captureFrameDataUrl(videoRef.current, mirrored) ?? latestFrameRef.current;
      recordChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      setRecordingMs(0);
      setCameraError("");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "video/webm" });
        recordChunksRef.current = [];
        const url = URL.createObjectURL(blob);
        const createdAt = Date.now();
        const item: CaptureItem = {
          id: `video-${createdAt}`,
          type: "video",
          url,
          name: `posepilot-video-${createdAt}.webm`,
          createdAt,
          analysis: analysisRef.current,
          suggestion: livePose?.suggestion ?? WAITING_SUGGESTION,
          thumbnail: recordingThumbnail,
          durationMs: Math.max(0, createdAt - recordingStartedAtRef.current),
        };
        setCaptures((current) => [item, ...current].slice(0, 30));
        setSelectedCaptureId(item.id);
        setSnapshot(item.thumbnail);
        setRecording(false);
        setRecordingMs(item.durationMs ?? 0);
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
    } catch {
      setCameraError("Could not start video recording.");
      setRecording(false);
    }
  }, [cameraActive, livePose?.suggestion, mirrored]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
    }
  }, []);

  const handleShutter = useCallback(() => {
    if (captureMode === "video") {
      if (recording) stopRecording();
      else startRecording();
      return;
    }

    triggerCapture();
  }, [captureMode, recording, startRecording, stopRecording, triggerCapture]);

  useEffect(() => {
    if (!recording) return;

    const interval = window.setInterval(() => {
      setRecordingMs(Date.now() - recordingStartedAtRef.current);
    }, 250);

    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    if (!cameraActive && recording) stopRecording();
  }, [cameraActive, recording, stopRecording]);

  useEffect(() => {
    if (!autoCapture || captureMode !== "photo" || !livePose || livePose.status !== "good") return;

    const now = Date.now();
    if (now - lastAutoCaptureRef.current < 4200) return;
    lastAutoCaptureRef.current = now;

    const timeout = window.setTimeout(() => {
      if (livePose.status === "good") triggerCapture();
    }, 850);

    return () => window.clearTimeout(timeout);
  }, [autoCapture, captureMode, livePose?.status, triggerCapture]);

  const selectedCapture = useMemo(() => captures.find((capture) => capture.id === selectedCaptureId) ?? captures[0] ?? null, [captures, selectedCaptureId]);

  const handleDownload = useCallback((item: CaptureItem) => {
    downloadUrl(item.url, item.name);
  }, []);

  const handleSave = useCallback(async (item: CaptureItem) => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const file = new File([blob], item.name, { type: blob.type || (item.type === "photo" ? "image/jpeg" : "video/webm") });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: "PosePilot capture" });
        return;
      }
    } catch {
      // Download is the reliable web fallback when native gallery saving is unavailable.
    }

    downloadUrl(item.url, item.name);
  }, []);

  const handlePanelMode = useCallback(
    (mode: PanelMode) => {
      setPanelMode(mode);

      if (mode === "live" || mode === "analyze" || mode === "photo" || mode === "video" || mode === "pose") {
        setCameraActive(true);
      }

      if (mode === "photo") setCaptureMode("photo");
      if (mode === "video") setCaptureMode("video");
      if (mode === "pose") setOverlayEnabled(true);
      if (mode === "analyze") lastAnalysisRef.current = 0;
      if (mode === "ai" && modelState === "error") setModelReloadKey((current) => current + 1);
    },
    [modelState]
  );

  const handleFlip = () => {
    setFacingMode((current) => {
      const next = current === "environment" ? "user" : "environment";
      setMirrored(next === "user");
      return next;
    });
  };

  const qualityLabel = useMemo(() => {
    if (!personVisible) return "No person";
    if ((livePose?.quality ?? 0) >= 84) return "Locked";
    if ((livePose?.quality ?? 0) >= 68) return "Refining";
    return "Needs adjustment";
  }, [livePose?.quality, personVisible]);

  return (
    <main ref={stageRef} className="relative min-h-screen overflow-hidden bg-black text-white selection:bg-lime-300 selection:text-black">
      <div className="absolute inset-0">
        <img
          src="/images/pose-reference.jpg"
          alt="Fallback camera preview"
          className={`h-full w-full object-cover transition-opacity duration-500 ${cameraActive ? "opacity-0" : "opacity-55"}`}
        />
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${cameraActive ? "opacity-100" : "opacity-0"} ${
            mirrored ? "-scale-x-100" : ""
          }`}
          muted
          playsInline
          autoPlay
          onLoadedMetadata={(event) => {
            const target = event.currentTarget;
            setVideoSize({ width: target.videoWidth || 1, height: target.videoHeight || 1 });
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_0%,rgba(0,0,0,0.15)_48%,rgba(0,0,0,0.76)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-black/8 to-black/90" />
      </div>

      {overlayEnabled && livePose ? <PersonOverlay pose={livePose} analysis={analysis} width={stageSize.width} height={stageSize.height} /> : <WaitingOverlay cameraActive={cameraActive && !livePose} />}

      {flash && <div className="pointer-events-none absolute inset-0 z-50 animate-camera-flash bg-white" />}

      <header className="absolute left-4 top-4 z-30 max-w-[520px] md:left-8 md:top-7">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/64">Real-time camera app</p>
        <h1 className="mt-2 text-4xl font-black uppercase leading-[0.88] tracking-[-0.08em] text-white drop-shadow-2xl md:text-7xl">
          PosePilot AI
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-white/76 md:text-base">
          The AR guide appears only after a person is detected, then updates pose, outfit, scene, and occasion live.
        </p>
      </header>

      <AnalysisPanel
        activeSuggestion={activeSuggestion}
        activeStatus={activeStatus}
        analysis={analysis}
        cameraLabel={cameraLabel}
        captureMode={captureMode}
        capturesCount={captures.length}
        confidence={personVisible ? Math.round((livePose?.score ?? 0) * 100) : 0}
        fps={fps}
        modelLabel={modelLabel}
        overlayEnabled={overlayEnabled}
        panelMode={panelMode}
        personVisible={personVisible}
        quality={livePose?.quality ?? 0}
        qualityLabel={qualityLabel}
        recording={recording}
        recordingMs={recordingMs}
      />

      {!cameraActive && (
        <div className="absolute inset-x-4 top-1/2 z-30 mx-auto max-w-md -translate-y-1/2 text-center md:inset-x-0">
          <div className="rounded-[30px] border border-white/16 bg-black/58 p-6 shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-200">Live detection is off</p>
            <p className="mt-3 text-2xl font-bold text-white">Start camera to detect a real person.</p>
            <p className="mt-3 text-sm leading-6 text-white/64">No body marks are drawn on the fallback frame. The outline and skeleton appear only when MoveNet sees a person.</p>
            <button
              className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:scale-105"
              onClick={() => setCameraActive(true)}
              type="button"
            >
              Start real-time analysis
            </button>
          </div>
        </div>
      )}

      {(cameraError || modelError) && (
        <div className="absolute left-4 right-4 top-40 z-40 rounded-2xl border border-yellow-300/30 bg-yellow-950/80 p-4 text-sm text-yellow-100 backdrop-blur-xl md:left-8 md:right-auto md:max-w-md">
          {cameraError || modelError}
        </div>
      )}

      <CameraDock
        autoCapture={autoCapture}
        cameraActive={cameraActive}
        captureMode={captureMode}
        captureEnabled={captureEnabled}
        capturesCount={captures.length}
        modelState={modelState}
        panelMode={panelMode}
        personVisible={personVisible}
        recording={recording}
        recordingMs={recordingMs}
        snapshot={snapshot}
        status={activeStatus}
        onAutoCapture={() => setAutoCapture((current) => !current)}
        onCameraToggle={() => setCameraActive((current) => !current)}
        onCapture={handleShutter}
        onGalleryOpen={() => setGalleryOpen(true)}
        onFlip={handleFlip}
        onPanelMode={handlePanelMode}
      />

      {galleryOpen && (
        <GalleryDrawer
          captures={captures}
          selectedCapture={selectedCapture}
          onClose={() => setGalleryOpen(false)}
          onDownload={handleDownload}
          onSave={handleSave}
          onSelect={setSelectedCaptureId}
        />
      )}
    </main>
  );
}

function AnalysisPanel({
  activeSuggestion,
  activeStatus,
  analysis,
  cameraLabel,
  captureMode,
  capturesCount,
  confidence,
  fps,
  modelLabel,
  overlayEnabled,
  panelMode,
  personVisible,
  quality,
  qualityLabel,
  recording,
  recordingMs,
}: {
  activeSuggestion: Suggestion;
  activeStatus: AssistantStatus;
  analysis: SceneAnalysis;
  cameraLabel: string;
  captureMode: CaptureMode;
  capturesCount: number;
  confidence: number;
  fps: number;
  modelLabel: string;
  overlayEnabled: boolean;
  panelMode: PanelMode;
  personVisible: boolean;
  quality: number;
  qualityLabel: string;
  recording: boolean;
  recordingMs: number;
}) {
  const panelTitle =
    panelMode === "analyze"
      ? "Scene analysis"
      : panelMode === "photo"
        ? "Photo capture"
        : panelMode === "video"
          ? "Video recording"
          : panelMode === "pose"
            ? "Pose guide"
            : panelMode === "ai"
              ? "AI engine"
              : "Real-time pose cue";

  const panelDetail =
    panelMode === "video"
      ? recording
        ? `Recording ${formatDuration(recordingMs)}`
        : "Press shutter to record"
      : panelMode === "photo"
        ? `${capturesCount} saved capture${capturesCount === 1 ? "" : "s"}`
        : panelMode === "pose"
          ? overlayEnabled
            ? "AR skeleton enabled"
            : "AR skeleton hidden"
          : panelMode === "ai"
            ? modelLabel
            : captureMode === "video"
              ? "Video mode active"
              : cameraLabel;

  return (
    <section className="absolute bottom-36 left-4 right-4 z-30 md:bottom-auto md:left-auto md:right-8 md:top-7 md:w-[390px]">
      <div className="rounded-[28px] border border-white/15 bg-black/52 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/48">Live output</p>
            <p className="mt-1 text-xl font-semibold text-white">{panelTitle}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">{panelDetail}</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${activeStatus === "good" ? "bg-lime-300 text-black" : "bg-yellow-300 text-black"}`}>
            {activeStatus}
          </div>
        </div>

        <div aria-live="polite" className="mt-4 space-y-2 font-mono text-[13px] leading-6 text-white/88">
          <p>
            <span className="text-white/48">Pose Suggestion:</span> {activeSuggestion.poseSuggestion}
          </p>
          <p>
            <span className="text-white/48">Adjustment:</span> {activeSuggestion.adjustment}
          </p>
          <p>
            <span className="text-white/48">Camera Tip:</span> {activeSuggestion.cameraTip}
          </p>
          <p>
            <span className="text-white/48">Status:</span> {activeSuggestion.status}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4 text-xs text-white/64">
          <Detected label="Background" value={analysis.background} />
          <Detected label="Lighting" value={analysis.lighting} />
          <Detected label="Attire" value={analysis.attire} />
          <Detected label="Occasion" value={analysis.occasion} />
          <Detected label="Mood" value={analysis.mood} />
          <Detected label="Top color" value={analysis.topColor} color={analysis.topColorHex} />
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/42">
            <span>{qualityLabel}</span>
            <span>{personVisible ? `${Math.round(quality)}%` : "hidden"}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/12">
            <div className={`h-full rounded-full ${activeStatus === "good" ? "bg-lime-300" : "bg-yellow-300"}`} style={{ width: `${personVisible ? Math.max(8, quality) : 0}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] uppercase tracking-[0.14em] text-white/48">
            <span>{modelLabel}</span>
            <span>{cameraLabel}</span>
            <span>{personVisible ? `${confidence}% conf / ${fps} fps` : "overlay off"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PersonOverlay({ pose, analysis, width, height }: { pose: LivePose; analysis: SceneAnalysis; width: number; height: number }) {
  const visibleKeypoints = pose.keypoints.filter((keypoint) => keypoint.score >= MIN_KEYPOINT_SCORE);
  const keypointByName = new Map(pose.keypoints.map((keypoint) => [keypoint.name, keypoint]));
  const silhouette = getSilhouettePath(pose.box, width, height);
  const accent = pose.status === "good" ? "#b8ff5a" : analysis.occasion.includes("Travel") ? "#62d9ff" : "#f5c84c";
  const axisLength = Math.max(110, Math.min(220, pose.box.height * 0.35));
  const forward = { x: pose.center.x + axisLength * 0.74, y: pose.center.y + axisLength * 0.92 };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          <marker id="arrow-red-live" markerHeight="11" markerWidth="11" orient="auto" refX="9" refY="5.5">
            <path d="M0,0 L10,5.5 L0,11 Z" fill="#ff4b42" />
          </marker>
          <marker id="arrow-green-live" markerHeight="11" markerWidth="11" orient="auto" refX="9" refY="5.5">
            <path d="M0,0 L10,5.5 L0,11 Z" fill="#91ef54" />
          </marker>
          <marker id="arrow-blue-live" markerHeight="11" markerWidth="11" orient="auto" refX="9" refY="5.5">
            <path d="M0,0 L10,5.5 L0,11 Z" fill="#1688ff" />
          </marker>
          <filter id="live-glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path className="animate-outline-draw" d={silhouette} fill="rgba(255,255,255,0.025)" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" />

        <g filter="url(#live-glow)" stroke={accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
          {SKELETON_CONNECTIONS.map(([from, to]) => {
            const a = keypointByName.get(from);
            const b = keypointByName.get(to);
            if (!a || !b || a.score < MIN_KEYPOINT_SCORE || b.score < MIN_KEYPOINT_SCORE) return null;
            return <line key={`${from}-${to}`} x1={a.x} x2={b.x} y1={a.y} y2={b.y} />;
          })}
          {visibleKeypoints.map((keypoint) => (
            <circle key={keypoint.name} cx={keypoint.x} cy={keypoint.y} r="7" fill={accent} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
          ))}
        </g>

        <g fontFamily="Inter, ui-sans-serif, system-ui" fontSize="20" fontWeight="900">
          <circle cx={pose.center.x} cy={pose.center.y} r="12" fill="#91ef54" filter="url(#live-glow)" />
          <line
            x1={pose.center.x}
            x2={pose.center.x}
            y1={pose.center.y}
            y2={pose.center.y - axisLength}
            stroke="#91ef54"
            strokeDasharray="16 10"
            strokeWidth="5"
            markerEnd="url(#arrow-green-live)"
          />
          <line
            x1={pose.center.x}
            x2={pose.center.x + axisLength}
            y1={pose.center.y}
            y2={pose.center.y}
            stroke="#ff4b42"
            strokeDasharray="16 10"
            strokeWidth="5"
            markerEnd="url(#arrow-red-live)"
          />
          <line
            x1={pose.center.x}
            x2={forward.x}
            y1={pose.center.y}
            y2={forward.y}
            stroke="#1688ff"
            strokeDasharray="16 10"
            strokeWidth="5"
            markerEnd="url(#arrow-blue-live)"
          />
          <text x={pose.center.x + 18} y={pose.center.y - axisLength + 42} fill="#91ef54">
            Up +Y
          </text>
          <text x={pose.center.x + axisLength - 14} y={pose.center.y - 18} fill="#ff4b42">
            Right +X
          </text>
          <text x={forward.x + 12} y={forward.y + 8} fill="#1688ff">
            Forward -Z
          </text>
        </g>

        {pose.status === "good" ? (
          <g className="animate-lock-pulse" fontFamily="Inter, ui-sans-serif, system-ui" fontWeight="900">
            <circle cx={pose.center.x} cy={pose.center.y} r={Math.max(70, pose.box.width * 0.42)} fill="none" stroke="#b8ff5a" strokeOpacity="0.55" strokeWidth="7" />
            <text x={pose.box.x} y={Math.max(32, pose.box.y - 22)} fill="#b8ff5a" fontSize="24">
              PERFECT HOLD
            </text>
          </g>
        ) : (
          <g className="animate-nudge-arrow" fontFamily="Inter, ui-sans-serif, system-ui" fontWeight="900">
            <path
              d={`M ${pose.box.x - 38} ${pose.box.y + pose.box.height * 0.28} C ${pose.box.x - 82} ${pose.box.y + pose.box.height * 0.42}, ${pose.box.x - 74} ${
                pose.box.y + pose.box.height * 0.56
              }, ${pose.box.x - 28} ${pose.box.y + pose.box.height * 0.66}`}
              fill="none"
              stroke={accent}
              strokeLinecap="round"
              strokeWidth="7"
              markerEnd="url(#arrow-green-live)"
            />
            <text x={Math.max(18, pose.box.x - 158)} y={Math.max(36, pose.box.y + 24)} fill={accent} fontSize="20">
              refine pose
            </text>
          </g>
        )}
      </svg>

      <div className="absolute bottom-[286px] left-5 hidden rounded-2xl border border-white/20 bg-black/48 p-4 text-sm shadow-2xl backdrop-blur-xl md:block">
        <p className="font-bold uppercase tracking-[0.18em] text-white">Live camera axes</p>
        <AxisLine color="bg-red-400" label="+X Right" />
        <AxisLine color="bg-lime-300" label="+Y Up" />
        <AxisLine color="bg-blue-400" label="-Z Forward" />
      </div>
    </div>
  );
}

function WaitingOverlay({ cameraActive }: { cameraActive: boolean }) {
  if (!cameraActive) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <div className="text-center">
        <div className="mx-auto h-24 w-24 rounded-full border border-white/18 bg-white/5 backdrop-blur-sm">
          <div className="h-full w-full animate-scan-ring rounded-full border-2 border-dashed border-white/42" />
        </div>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.24em] text-white/72">Waiting for person</p>
        <p className="mt-2 text-xs text-white/50">Overlay is hidden until a body is detected.</p>
      </div>
    </div>
  );
}

function CameraDock({
  autoCapture,
  cameraActive,
  captureMode,
  captureEnabled,
  capturesCount,
  modelState,
  panelMode,
  personVisible,
  recording,
  recordingMs,
  snapshot,
  status,
  onAutoCapture,
  onCameraToggle,
  onCapture,
  onGalleryOpen,
  onFlip,
  onPanelMode,
}: {
  autoCapture: boolean;
  cameraActive: boolean;
  captureMode: CaptureMode;
  captureEnabled: boolean;
  capturesCount: number;
  modelState: ModelState;
  panelMode: PanelMode;
  personVisible: boolean;
  recording: boolean;
  recordingMs: number;
  snapshot: string;
  status: AssistantStatus;
  onAutoCapture: () => void;
  onCameraToggle: () => void;
  onCapture: () => void;
  onGalleryOpen: () => void;
  onFlip: () => void;
  onPanelMode: (mode: PanelMode) => void;
}) {
  const modes: Array<{ key: PanelMode; label: string }> = [
    { key: "live", label: "Live" },
    { key: "analyze", label: "Analyze" },
    { key: "photo", label: "Photo" },
    { key: "video", label: "Video" },
    { key: "pose", label: "Pose" },
    { key: "ai", label: modelState === "ready" ? "AI Ready" : "AI" },
  ];

  return (
    <footer className="absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-4 pb-4 pt-3 backdrop-blur-xl md:pb-6">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <div className="flex w-28 items-center gap-3 md:w-52">
          <button className="relative" onClick={onGalleryOpen} type="button">
            <img src={snapshot} alt="Latest capture thumbnail" className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/20" />
            <span className="absolute -right-2 -top-2 rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-black text-black">{capturesCount}</span>
          </button>
          <div className="hidden md:block">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/58">Latest capture</p>
            <button className="mt-1 text-left text-xs text-white/42 hover:text-white" onClick={onGalleryOpen} type="button">
              View and save gallery
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 text-xs font-bold uppercase tracking-[0.16em] text-white/45 md:gap-3 md:text-sm">
            {modes.map((mode) => (
              <button
                key={mode.key}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${panelMode === mode.key ? "bg-yellow-300 text-black" : "hover:bg-white/10 hover:text-white"}`}
                onClick={() => onPanelMode(mode.key)}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-5">
            <IconButton active={cameraActive} onClick={onCameraToggle} title="Start or stop camera">
              {cameraActive ? "Stop" : "Start"}
            </IconButton>
            <button
              aria-label={captureMode === "video" ? (recording ? "Stop video recording" : "Start video recording") : "Take photo"}
              className={`relative grid h-[76px] w-[76px] place-items-center rounded-full border-[5px] border-white bg-white/10 shadow-[0_0_38px_rgba(255,255,255,0.35)] transition ${
                captureEnabled ? "hover:scale-105" : "cursor-not-allowed opacity-45"
              } ${status === "good" || recording ? "animate-shutter-ready" : ""}`}
              disabled={!captureEnabled}
              onClick={onCapture}
              type="button"
            >
              <span className={`${captureMode === "video" ? (recording ? "h-8 w-8 rounded-lg bg-red-500" : "h-[54px] w-[54px] rounded-full bg-red-500") : "h-[54px] w-[54px] rounded-full bg-white"}`} />
              {recording && <span className="absolute -bottom-6 text-[10px] font-black uppercase tracking-[0.16em] text-red-300">{formatDuration(recordingMs)}</span>}
            </button>
            <IconButton active={autoCapture} onClick={onAutoCapture} title="Toggle auto capture">
              Auto
            </IconButton>
          </div>
        </div>

        <div className="flex w-28 justify-end gap-2 md:w-52">
          <IconButton onClick={onFlip} title="Flip camera">
            Flip
          </IconButton>
          <IconButton active={personVisible} onClick={() => onPanelMode("pose")} title="Show pose guide">
            Pose
          </IconButton>
        </div>
      </div>
    </footer>
  );
}

function GalleryDrawer({
  captures,
  selectedCapture,
  onClose,
  onDownload,
  onSave,
  onSelect,
}: {
  captures: CaptureItem[];
  selectedCapture: CaptureItem | null;
  onClose: () => void;
  onDownload: (item: CaptureItem) => void;
  onSave: (item: CaptureItem) => void | Promise<void>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="absolute inset-0 z-50 bg-black/74 p-4 backdrop-blur-xl md:p-8">
      <div className="mx-auto flex h-full max-w-6xl flex-col rounded-[28px] border border-white/14 bg-zinc-950/92 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-4 md:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-yellow-300">Gallery</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">View, download, or save captures</h2>
          </div>
          <button className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-white/80 hover:bg-white hover:text-black" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {captures.length === 0 ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <p className="text-xl font-bold text-white">No captures yet.</p>
              <p className="mt-2 text-sm text-white/56">Start the camera, wait for a person, then press the shutter.</p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 p-4 md:grid-cols-[1fr_320px] md:p-5">
            <div className="min-h-0 overflow-hidden rounded-[24px] bg-black">
              {selectedCapture?.type === "video" ? (
                <video src={selectedCapture.url} className="h-full max-h-full w-full object-contain" controls playsInline />
              ) : (
                <img src={selectedCapture?.url} alt="Selected capture" className="h-full max-h-full w-full object-contain" />
              )}
            </div>

            <aside className="flex min-h-0 flex-col">
              {selectedCapture && (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Selected</p>
                  <p className="mt-1 text-sm font-semibold text-white">{new Date(selectedCapture.createdAt).toLocaleString()}</p>
                  <p className="mt-2 text-xs text-white/54">{selectedCapture.type === "video" ? `Video ${formatDuration(selectedCapture.durationMs ?? 0)}` : "Photo capture"}</p>
                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-black" onClick={() => onDownload(selectedCapture)} type="button">
                      Download
                    </button>
                    <button className="flex-1 rounded-full bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-black" onClick={() => onSave(selectedCapture)} type="button">
                      Save
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/58">
                    <Detected label="Background" value={selectedCapture.analysis.background} />
                    <Detected label="Attire" value={selectedCapture.analysis.attire} />
                    <Detected label="Occasion" value={selectedCapture.analysis.occasion} />
                    <Detected label="Status" value={selectedCapture.suggestion.status} />
                  </div>
                </div>
              )}

              <div className="mt-4 grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto md:grid-cols-2">
                {captures.map((capture) => (
                  <button
                    key={capture.id}
                    className={`relative overflow-hidden rounded-2xl border bg-black ${selectedCapture?.id === capture.id ? "border-yellow-300" : "border-white/10"}`}
                    onClick={() => onSelect(capture.id)}
                    type="button"
                  >
                    <img src={capture.thumbnail} alt={`${capture.type} thumbnail`} className="aspect-[3/4] w-full object-cover opacity-88" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black uppercase text-white">{capture.type}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Detected({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="uppercase tracking-[0.18em] text-white/36">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-semibold text-white/82">
        {color && <span className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ backgroundColor: color }} />}
        {value}
      </p>
    </div>
  );
}

function AxisLine({ color, label }: { color: string; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-3 text-white/74">
      <span className={`h-1 w-9 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function IconButton({ active, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      className={`grid min-h-12 min-w-12 place-items-center rounded-full border px-3 text-xs font-bold uppercase tracking-[0.12em] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45 ${
        active ? "border-yellow-300 bg-yellow-300 text-black" : "border-white/15 bg-white/10 text-white/78 hover:border-white/35"
      } ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

function isPersonPose(pose: poseDetection.Pose) {
  const reliable = pose.keypoints.filter((keypoint) => (keypoint.score ?? 0) >= MIN_KEYPOINT_SCORE);
  const average = reliable.reduce((sum, keypoint) => sum + (keypoint.score ?? 0), 0) / Math.max(1, reliable.length);
  const hasTorso = ["left_shoulder", "right_shoulder", "left_hip", "right_hip"].filter((name) => isKeypointVisible(getKeypoint(pose, name), 0.22)).length >= 2;

  return reliable.length >= 5 && average >= 0.34 && hasTorso;
}

function evaluatePose(pose: poseDetection.Pose, videoSize: { width: number; height: number }, analysis: SceneAnalysis) {
  const rawBox = getRawBox(pose.keypoints, videoSize.width, videoSize.height);
  const reliable = pose.keypoints.filter((keypoint) => (keypoint.score ?? 0) >= MIN_KEYPOINT_SCORE);
  const score = reliable.reduce((sum, keypoint) => sum + (keypoint.score ?? 0), 0) / Math.max(1, reliable.length);
  const centerX = (rawBox.x + rawBox.width / 2) / videoSize.width;
  const centerOffset = Math.abs(centerX - 0.5);
  const bodyHeightRatio = rawBox.height / videoSize.height;
  const bodyWidthRatio = rawBox.width / videoSize.width;
  const leftShoulder = getKeypoint(pose, "left_shoulder");
  const rightShoulder = getKeypoint(pose, "right_shoulder");
  const leftHip = getKeypoint(pose, "left_hip");
  const rightHip = getKeypoint(pose, "right_hip");
  const leftAnkle = getKeypoint(pose, "left_ankle");
  const rightAnkle = getKeypoint(pose, "right_ankle");
  const shoulderWidth = distance(leftShoulder, rightShoulder) || rawBox.width || 1;
  const shoulderSlope = isKeypointVisible(leftShoulder) && isKeypointVisible(rightShoulder) ? Math.abs((leftShoulder!.y - rightShoulder!.y) / shoulderWidth) : 0.2;
  const spineLean = isKeypointVisible(leftShoulder) && isKeypointVisible(rightShoulder) && isKeypointVisible(leftHip) && isKeypointVisible(rightHip)
    ? Math.abs((midPoint(leftShoulder!, rightShoulder!).x - midPoint(leftHip!, rightHip!).x) / shoulderWidth)
    : 0.18;
  const anklesVisible = isKeypointVisible(leftAnkle, 0.22) || isKeypointVisible(rightAnkle, 0.22);
  const lowLight = analysis.lighting.toLowerCase().includes("low");

  let quality = 34 + score * 30;
  quality += Math.max(0, 18 - centerOffset * 92);
  quality += bodyHeightRatio > 0.42 && bodyHeightRatio < 0.88 ? 15 : -6;
  quality += bodyWidthRatio < 0.72 ? 6 : -6;
  quality += shoulderSlope < 0.12 ? 9 : -7;
  quality += spineLean < 0.24 ? 7 : -5;
  quality += anklesVisible || bodyHeightRatio < 0.58 ? 4 : -4;
  quality += lowLight ? -12 : 4;
  quality = clamp(quality, 0, 100);

  const status: AssistantStatus = quality >= 84 ? "good" : "improve";
  const suggestion = getSuggestion({
    status,
    analysis,
    centerOffset,
    centerX,
    bodyHeightRatio,
    bodyWidthRatio,
    shoulderSlope,
    spineLean,
    anklesVisible,
    lowLight,
  });

  return { quality, score, suggestion };
}

function getSuggestion({
  status,
  analysis,
  centerOffset,
  centerX,
  bodyHeightRatio,
  bodyWidthRatio,
  shoulderSlope,
  spineLean,
  anklesVisible,
  lowLight,
}: {
  status: AssistantStatus;
  analysis: SceneAnalysis;
  centerOffset: number;
  centerX: number;
  bodyHeightRatio: number;
  bodyWidthRatio: number;
  shoulderSlope: number;
  spineLean: number;
  anklesVisible: boolean;
  lowLight: boolean;
}): Suggestion {
  if (status === "good") {
    if (analysis.occasion.includes("Professional")) {
      return {
        poseSuggestion: "Perfect, hold this confident pose",
        adjustment: "Keep chin level",
        cameraTip: "Hold camera steady",
        status,
      };
    }

    if (analysis.occasion.includes("Travel")) {
      return {
        poseSuggestion: "Perfect, hold this open pose",
        adjustment: "Keep background visible",
        cameraTip: "Hold this frame",
        status,
      };
    }

    return {
      poseSuggestion: "Perfect, hold this pose",
      adjustment: "Keep shoulders relaxed",
      cameraTip: "Hold camera steady",
      status,
    };
  }

  if (lowLight) {
    return {
      poseSuggestion: "Turn toward brighter light",
      adjustment: "Lift your chin a little",
      cameraTip: "Face a window or lamp",
      status,
    };
  }

  if (centerOffset > 0.16) {
    return {
      poseSuggestion: "Center yourself in frame",
      adjustment: `Move ${centerX < 0.5 ? "right" : "left"} a little`,
      cameraTip: "Keep your body inside the guide",
      status,
    };
  }

  if (bodyHeightRatio > 0.88 || bodyWidthRatio > 0.72) {
    return {
      poseSuggestion: "Step back a little",
      adjustment: "Leave space around your body",
      cameraTip: "Show head and feet if possible",
      status,
    };
  }

  if (bodyHeightRatio < 0.36) {
    return {
      poseSuggestion: "Move closer to camera",
      adjustment: "Fill more of the frame",
      cameraTip: "Keep camera vertical",
      status,
    };
  }

  if (!anklesVisible && bodyHeightRatio > 0.56) {
    return {
      poseSuggestion: "Step back slightly",
      adjustment: "Show more of your legs",
      cameraTip: "Tilt camera down a little",
      status,
    };
  }

  if (shoulderSlope > 0.13) {
    return {
      poseSuggestion: "Level your shoulders",
      adjustment: "Lift the lower shoulder slightly",
      cameraTip: "Keep camera straight",
      status,
    };
  }

  if (spineLean > 0.25) {
    return {
      poseSuggestion: "Stand a bit taller",
      adjustment: "Bring chest over hips",
      cameraTip: "Keep camera at chest height",
      status,
    };
  }

  if (analysis.occasion.includes("Professional")) {
    return {
      poseSuggestion: "Turn your body 20 deg right",
      adjustment: "Keep your shoulders relaxed",
      cameraTip: "Move camera slightly lower",
      status,
    };
  }

  if (analysis.occasion.includes("Travel")) {
    return {
      poseSuggestion: "Open your shoulders to the scene",
      adjustment: "Angle your body slightly",
      cameraTip: "Leave background space",
      status,
    };
  }

  return {
    poseSuggestion: "Angle your body slightly",
    adjustment: "Relax one shoulder",
    cameraTip: "Keep yourself centered",
    status,
  };
}

function analyzeFrame(video: HTMLVideoElement, pose: poseDetection.Pose): SceneAnalysis {
  const sourceWidth = video.videoWidth || 1;
  const sourceHeight = video.videoHeight || 1;
  const width = 160;
  const height = Math.max(90, Math.round((sourceHeight / sourceWidth) * width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return EMPTY_ANALYSIS;

  context.drawImage(video, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const scaleX = width / sourceWidth;
  const scaleY = height / sourceHeight;
  const rawBox = getRawBox(pose.keypoints, sourceWidth, sourceHeight);
  const scaledBox = {
    x: rawBox.x * scaleX,
    y: rawBox.y * scaleY,
    width: rawBox.width * scaleX,
    height: rawBox.height * scaleY,
  };

  const background = averagePixels(image, (x, y) => {
    const pad = 8;
    return x < scaledBox.x - pad || x > scaledBox.x + scaledBox.width + pad || y < scaledBox.y - pad || y > scaledBox.y + scaledBox.height + pad;
  });

  const torsoRect = getScaledTorsoRect(pose, scaleX, scaleY, scaledBox, width, height);
  const legRect = getScaledLegRect(pose, scaleX, scaleY, scaledBox, width, height);
  const top = averagePixels(image, (x, y) => containsPoint(torsoRect, x, y));
  const bottom = averagePixels(image, (x, y) => containsPoint(legRect, x, y));

  const lighting = classifyLighting(background.luminance || top.luminance);
  const backgroundLabel = classifyBackground(background);
  const topColor = classifyColor(top);
  const bottomColor = classifyColor(bottom);
  const attire = classifyAttire(topColor, bottomColor, top, bottom);
  const occasion = inferOccasion(backgroundLabel, attire, lighting);
  const mood = inferMood(occasion, lighting, backgroundLabel);
  const confidence = clamp((background.count + top.count + bottom.count) / 3600, 0.22, 0.96);

  return {
    background: backgroundLabel,
    lighting,
    attire,
    occasion,
    mood,
    topColor,
    topColorHex: rgbToHex(top.r, top.g, top.b),
    confidence,
  };
}

function getKeypoint(pose: poseDetection.Pose, name: string) {
  return pose.keypoints.find((keypoint) => keypoint.name === name);
}

function isKeypointVisible(keypoint?: poseDetection.Keypoint, minimum = MIN_KEYPOINT_SCORE) {
  return Boolean(keypoint && (keypoint.score ?? 0) >= minimum);
}

function distance(a?: poseDetection.Keypoint, b?: poseDetection.Keypoint) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midPoint(a: poseDetection.Keypoint, b: poseDetection.Keypoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function mapKeypoint(keypoint: poseDetection.Keypoint, videoSize: { width: number; height: number }, stageSize: { width: number; height: number }, mirrored: boolean): DisplayKeypoint {
  const scale = Math.max(stageSize.width / videoSize.width, stageSize.height / videoSize.height);
  const renderedWidth = videoSize.width * scale;
  const renderedHeight = videoSize.height * scale;
  const offsetX = (stageSize.width - renderedWidth) / 2;
  const offsetY = (stageSize.height - renderedHeight) / 2;
  const sourceX = mirrored ? videoSize.width - keypoint.x : keypoint.x;

  return {
    name: keypoint.name ?? "point",
    score: keypoint.score ?? 0,
    x: sourceX * scale + offsetX,
    y: keypoint.y * scale + offsetY,
  };
}

function getRawBox(keypoints: poseDetection.Keypoint[], width: number, height: number): Box {
  const visible = keypoints.filter((keypoint) => (keypoint.score ?? 0) >= 0.2);
  if (!visible.length) return { x: width * 0.35, y: height * 0.15, width: width * 0.3, height: height * 0.7 };

  const xMin = Math.min(...visible.map((point) => point.x));
  const xMax = Math.max(...visible.map((point) => point.x));
  const yMin = Math.min(...visible.map((point) => point.y));
  const yMax = Math.max(...visible.map((point) => point.y));
  const padX = Math.max(18, (xMax - xMin) * 0.2);
  const padY = Math.max(24, (yMax - yMin) * 0.14);
  const x = clamp(xMin - padX, 0, width);
  const y = clamp(yMin - padY, 0, height);
  const right = clamp(xMax + padX, 0, width);
  const bottom = clamp(yMax + padY, 0, height);

  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

function getDisplayBox(points: DisplayKeypoint[], stageSize: { width: number; height: number }): Box {
  if (!points.length) return { x: stageSize.width * 0.35, y: stageSize.height * 0.18, width: stageSize.width * 0.3, height: stageSize.height * 0.62 };

  const xMin = Math.min(...points.map((point) => point.x));
  const xMax = Math.max(...points.map((point) => point.x));
  const yMin = Math.min(...points.map((point) => point.y));
  const yMax = Math.max(...points.map((point) => point.y));
  const padX = Math.max(34, (xMax - xMin) * 0.24);
  const padY = Math.max(42, (yMax - yMin) * 0.16);
  const x = clamp(xMin - padX, -40, stageSize.width + 40);
  const y = clamp(yMin - padY, -40, stageSize.height + 40);
  const right = clamp(xMax + padX, -40, stageSize.width + 40);
  const bottom = clamp(yMax + padY, -40, stageSize.height + 40);

  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

function getDisplayCenter(keypoints: DisplayKeypoint[], box: Box): Point {
  const leftHip = keypoints.find((keypoint) => keypoint.name === "left_hip" && keypoint.score >= MIN_KEYPOINT_SCORE);
  const rightHip = keypoints.find((keypoint) => keypoint.name === "right_hip" && keypoint.score >= MIN_KEYPOINT_SCORE);
  if (leftHip && rightHip) return { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };

  return { x: box.x + box.width / 2, y: box.y + box.height * 0.55 };
}

function getSilhouettePath(box: Box, width: number, height: number) {
  const x = clamp(box.x - box.width * 0.08, -60, width + 60);
  const y = clamp(box.y - box.height * 0.04, -60, height + 60);
  const w = box.width * 1.16;
  const h = box.height * 1.08;
  const cx = x + w / 2;
  const top = y;
  const head = h * 0.16;
  const shoulderY = y + h * 0.25;
  const hipY = y + h * 0.58;
  const kneeY = y + h * 0.8;
  const bottom = y + h;

  return [
    `M ${cx} ${top}`,
    `C ${x + w * 0.24} ${top}, ${x + w * 0.22} ${top + head}, ${x + w * 0.24} ${shoulderY}`,
    `C ${x + w * 0.07} ${shoulderY + h * 0.04}, ${x + w * 0.08} ${hipY - h * 0.1}, ${x + w * 0.2} ${hipY}`,
    `C ${x + w * 0.12} ${kneeY}, ${x + w * 0.16} ${bottom}, ${x + w * 0.38} ${bottom}`,
    `C ${x + w * 0.46} ${bottom - h * 0.02}, ${x + w * 0.54} ${bottom - h * 0.02}, ${x + w * 0.62} ${bottom}`,
    `C ${x + w * 0.84} ${bottom}, ${x + w * 0.88} ${kneeY}, ${x + w * 0.8} ${hipY}`,
    `C ${x + w * 0.92} ${hipY - h * 0.1}, ${x + w * 0.93} ${shoulderY + h * 0.04}, ${x + w * 0.76} ${shoulderY}`,
    `C ${x + w * 0.78} ${top + head}, ${x + w * 0.76} ${top}, ${cx} ${top}`,
    "Z",
  ].join(" ");
}

function getScaledTorsoRect(pose: poseDetection.Pose, scaleX: number, scaleY: number, fallback: Box, width: number, height: number): Box {
  const points = [getKeypoint(pose, "left_shoulder"), getKeypoint(pose, "right_shoulder"), getKeypoint(pose, "left_hip"), getKeypoint(pose, "right_hip")].filter((point): point is poseDetection.Keypoint => isKeypointVisible(point, 0.2));
  if (points.length < 2) {
    return clampBox({ x: fallback.x + fallback.width * 0.25, y: fallback.y + fallback.height * 0.28, width: fallback.width * 0.5, height: fallback.height * 0.24 }, width, height);
  }

  const xMin = Math.min(...points.map((point) => point.x * scaleX));
  const xMax = Math.max(...points.map((point) => point.x * scaleX));
  const yMin = Math.min(...points.map((point) => point.y * scaleY));
  const yMax = Math.max(...points.map((point) => point.y * scaleY));

  return clampBox({ x: xMin - 6, y: yMin + 4, width: xMax - xMin + 12, height: Math.max(14, yMax - yMin - 2) }, width, height);
}

function getScaledLegRect(pose: poseDetection.Pose, scaleX: number, scaleY: number, fallback: Box, width: number, height: number): Box {
  const points = [getKeypoint(pose, "left_hip"), getKeypoint(pose, "right_hip"), getKeypoint(pose, "left_knee"), getKeypoint(pose, "right_knee")].filter((point): point is poseDetection.Keypoint => isKeypointVisible(point, 0.18));
  if (points.length < 2) {
    return clampBox({ x: fallback.x + fallback.width * 0.25, y: fallback.y + fallback.height * 0.58, width: fallback.width * 0.5, height: fallback.height * 0.24 }, width, height);
  }

  const xMin = Math.min(...points.map((point) => point.x * scaleX));
  const xMax = Math.max(...points.map((point) => point.x * scaleX));
  const yMin = Math.min(...points.map((point) => point.y * scaleY));
  const yMax = Math.max(...points.map((point) => point.y * scaleY));

  return clampBox({ x: xMin - 5, y: yMin + 2, width: xMax - xMin + 10, height: Math.max(16, yMax - yMin + 16) }, width, height);
}

function averagePixels(image: ImageData, predicate: (x: number, y: number) => boolean): RgbStats {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const { data, width, height } = image;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (!predicate(x, y)) continue;
      const index = (y * width + x) * 4;
      r += data[index];
      g += data[index + 1];
      b += data[index + 2];
      count += 1;
    }
  }

  if (!count) return toStats(120, 120, 120, 0);
  return toStats(r / count, g / count, b / count, count);
}

function toStats(r: number, g: number, b: number, count: number): RgbStats {
  const hsl = rgbToHsl(r, g, b);
  return {
    r,
    g,
    b,
    h: hsl.h,
    s: hsl.s,
    l: hsl.l,
    luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b,
    count,
  };
}

function classifyLighting(luminance: number) {
  if (luminance < 72) return "Low light";
  if (luminance > 184) return "Bright light";
  return "Soft balanced light";
}

function classifyBackground(background: RgbStats) {
  if (background.count < 20) return "Background blocked";
  if (background.s < 0.13 && background.l < 0.42) return "Indoor dim room";
  if (background.s < 0.14) return "Plain indoor wall";
  if (background.h >= 78 && background.h <= 165 && background.s > 0.18) return "Outdoor greenery";
  if (background.h >= 180 && background.h <= 235 && background.l > 0.42) return "Bright outdoor scene";
  if (background.h >= 18 && background.h <= 58 && background.s > 0.16) return "Warm indoor room";
  if (background.l > 0.72) return "Bright studio or outdoor";
  return "Indoor room";
}

function classifyColor(color: RgbStats) {
  if (color.l < 0.18) return "black";
  if (color.l > 0.82 && color.s < 0.22) return "white";
  if (color.s < 0.13) return color.l < 0.45 ? "dark gray" : "gray";
  if (color.h < 18 || color.h >= 342) return "red";
  if (color.h < 45) return "brown";
  if (color.h < 68) return "yellow";
  if (color.h < 165) return "green";
  if (color.h < 250) return "blue";
  if (color.h < 292) return "purple";
  return "pink";
}

function classifyAttire(topColor: string, bottomColor: string, top: RgbStats, bottom: RgbStats) {
  const darkTop = top.l < 0.32;
  const darkBottom = bottom.l < 0.34;
  const vivid = top.s > 0.34 || bottom.s > 0.34;

  if (darkTop && darkBottom) return `dark smart casual outfit`;
  if (darkTop && !vivid) return `dark ${bottomColor} casual outfit`;
  if (vivid) return `bright ${topColor} casual outfit`;
  if (topColor === "white" || topColor === "gray") return `neutral ${topColor} outfit`;
  return `${topColor} top with ${bottomColor} bottoms`;
}

function inferOccasion(background: string, attire: string, lighting: string) {
  if (background.includes("Outdoor") || background.includes("greenery")) return "Travel or outdoor portrait";
  if (attire.includes("smart") && !lighting.includes("Low")) return "Professional profile";
  if (attire.includes("bright")) return "Casual social photo";
  if (background.includes("studio")) return "Fitness or profile shot";
  return "Casual portrait";
}

function inferMood(occasion: string, lighting: string, background: string) {
  if (lighting.includes("Low")) return "Needs brighter light";
  if (occasion.includes("Professional")) return "Confident and polished";
  if (occasion.includes("Travel")) return "Open and expressive";
  if (background.includes("Outdoor")) return "Fresh and lively";
  return "Relaxed and natural";
}

function containsPoint(box: Box, x: number, y: number) {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

function clampBox(box: Box, width: number, height: number): Box {
  const x = clamp(box.x, 0, width - 1);
  const y = clamp(box.y, 0, height - 1);
  const right = clamp(box.x + box.width, x + 1, width);
  const bottom = clamp(box.y + box.height, y + 1, height);
  return { x, y, width: right - x, height: bottom - y };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    if (max === bn) h = 60 * ((rn - gn) / delta + 4);
  }

  return { h: h < 0 ? h + 360 : h, s, l };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getRecordingMimeType() {
  const supportedTypes = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function downloadUrl(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function captureFrameDataUrl(video: HTMLVideoElement | null, mirrored: boolean) {
  if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  if (mirrored) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}