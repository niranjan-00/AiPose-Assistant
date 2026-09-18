/**
 * DevPanel — small floating overlay showing FPS / inference time / backend.
 * Toggled by Settings.camera.showPerfPanel.
 */
interface DevPanelProps {
  fps: number;
  inferenceMs: number;
  backend: string;
  model: string;
}

export function DevPanel({ fps, inferenceMs, backend, model }: DevPanelProps) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-40 rounded-lg border border-white/15 bg-black/70 px-3 py-2 font-mono text-[10px] leading-tight text-white/80 backdrop-blur">
      <div>FPS: {fps}</div>
      <div>Inference: {inferenceMs}ms</div>
      <div>Backend: {backend}</div>
      <div>Model: {model}</div>
    </div>
  );
}
