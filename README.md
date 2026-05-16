# PosePilot AI ✈️🧘‍♂️

Real-time AI-powered pose detection and camera assistant built with React 19, TypeScript, TensorFlow.js, and Vite.

PosePilot AI uses the **MoveNet SinglePose Lightning** model from TensorFlow.js to detect human body keypoints in real-time through your device camera. It overlays an AR skeleton, evaluates pose quality, provides live suggestions for improvement, analyzes the scene (background, lighting, attire, mood), and supports photo/video capture with an in-app gallery.

---

## ✨ Features

*   **Real-time Pose Detection** — MoveNet SinglePose Lightning runs at ~10 fps via WebGL (with automatic CPU fallback).
*   **AR Skeleton Overlay** — Keypoints and bone connections drawn dynamically over the detected person with glow effects.
*   **Pose Quality Evaluation** — Real-time scoring ($0-100\%$) displaying states: `"Locked"`, `"Refining"`, or `"Needs adjustment"`.
*   **Live AI Suggestions** — Pose suggestions, structural adjustment tips, and camera framing tips updated in real-time.
*   **Scene Analysis** — Intelligent pixel-sampling to detect background type, lighting condition, attire, occasion, mood, and dominant clothing color.
*   **Photo Capture & Auto-Capture** — Take snapshots manually with a single tap, or enable Auto-Capture to snap a photo the moment pose quality hits "good" status. Images are saved as JPEG data URLs.
*   **Video Recording** — Record WebM video clips via the MediaRecorder API featuring precise live duration tracking.
*   **Gallery Drawer** — Slide-in drawer to browse, download, share, or delete captured photos and videos (up to 30 items).
*   **Front/Rear Camera Toggle** — Seamlessly switch between user-facing and environment-facing cameras with automatic mirroring logic.
*   **Robust Error Handling** — React `ErrorBoundary` gracefully catches rendering crashes, alongside dismissible banner overlays for camera and model loading errors.
*   **Responsive Design** — Full-screen, immersive camera UI completely optimized for both mobile and desktop viewports.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 19 + TypeScript 5.9 |
| **Build System** | Vite 7 + `vite-plugin-singlefile` |
| **Styling** | Tailwind CSS 4 |
| **Pose Detection** | TensorFlow.js 4.22 + `@tensorflow-models/pose-detection` 2.1 |
| **Backends** | `@tensorflow/tfjs-backend-webgl`, `@tensorflow/tfjs-backend-cpu` |
| **Utilities** | `clsx` + `tailwind-merge` |

---

## 📂 Project Structure

```text
ai-pose-assistant-prompt/
├── index.html                  # HTML entry point
├── package.json                # Dependencies and scripts
├── vite.config.ts              # Vite + Tailwind + singlefile config
├── tsconfig.json               # TypeScript configuration
├── public/
│   └── images/
│       └── pose-reference.jpg  # Fallback image when camera is off
└── src/
    ├── index.css               # Tailwind imports + custom keyframe animations
    ├── main.tsx                # React root with ErrorBoundary wrapper
    ├── App.tsx                 # Main app + all components + helper functions
    └── utils/
        └── cn.ts               # clsx + tailwind-merge utility
