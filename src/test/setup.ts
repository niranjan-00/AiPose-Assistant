// Vitest setup — runs before every test file.
import { vi } from "vitest";

// Mock SpeechSynthesis (jsdom doesn't have it)
if (typeof globalThis.speechSynthesis === "undefined") {
  (globalThis as never as { speechSynthesis: unknown }).speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => []),
    pending: false,
    speaking: false,
    paused: false,
    onvoiceschanged: null,
  };
}
if (typeof globalThis.SpeechSynthesisUtterance === "undefined") {
  class MockUtterance {
    text = "";
    volume = 1;
    rate = 1;
    pitch = 1;
    voice = null;
    lang = "";
    onstart = null;
    onend = null;
    onerror = null;
    onboundary = null;
    onpause = null;
    onresume = null;
    onmark = null;
    constructor(text?: string) {
      this.text = text ?? "";
    }
  }
  (globalThis as never as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockUtterance;
}

// Mock MediaRecorder
if (typeof globalThis.MediaRecorder === "undefined") {
  class MockMediaRecorder {
    state = "inactive";
    mimeType: string;
    stream: MediaStream;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onstart: (() => void) | null = null;
    constructor(stream: MediaStream, opts?: { mimeType?: string }) {
      this.stream = stream;
      this.mimeType = opts?.mimeType ?? "video/webm";
    }
    static isTypeSupported() {
      return false;
    }
    start() {
      this.state = "recording";
      this.onstart?.();
    }
    stop() {
      this.state = "inactive";
      this.onstop?.();
    }
  }
  (globalThis as never as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;
}

// Mock URL.createObjectURL / revokeObjectURL
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
}
