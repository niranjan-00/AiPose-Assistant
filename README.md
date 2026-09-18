# AiPose Assistant

**An AI-powered real-time fitness, exercise form, posture, and pose coaching platform — running entirely on your device.**

AiPose Assistant uses TensorFlow.js with MoveNet SinglePose Lightning to track 17 body keypoints from your webcam in real time, then layers an exercise engine, rep counter, form analyzer, voice coach, workout builder, posture monitor, and pose comparison system on top. All pose processing happens locally in your browser — no camera frames ever leave your device unless you explicitly capture them.

---

## ✨ Features

### 5 Application Modes

- **Pose Studio** — the original AiPose live camera with skeleton overlay, pose quality scoring, scene analysis (background/lighting/attire), photo capture, video recording, and gallery.
- **Fitness Coach** — pick an exercise and get real-time rep counting, form scoring, joint angle readout, and one cue at a time on the big screen.
- **Workout Mode** — build a custom workout or pick a preset; structured sessions with sets, reps, rest timers, voice cues, and a post-workout summary with calorie estimate.
- **Posture Monitor** — analyze standing/sitting posture across head, shoulders, torso, and hips. Quick check, 5-minute monitoring, or continuous mode.
- **Pose Practice** — pick a target pose (T-Pose, Tree, Warrior, Hands Up, Side) and attempt to match it. Normalized joint-angle similarity score per joint.

### 8 Exercises (extensible)

| Exercise | Difficulty | Target muscles | Rep logic |
|---|---|---|---|
| Squat | Beginner | Legs, glutes, core | Knee angle 180→100→180 |
| Push-up | Intermediate | Chest, arms, core | Elbow angle cycle |
| Plank | Beginner | Core, shoulders | Isometric hold (time-based) |
| Lunge | Intermediate | Legs, glutes | Front-knee angle cycle |
| Bicep Curl | Beginner | Arms | Elbow flexion cycle |
| Shoulder Press | Intermediate | Shoulders, arms | Elbow extension cycle |
| Sit-up | Beginner | Core | Torso-hip-knee angle cycle |
| Jumping Jack | Beginner | Full body, cardio | Ankle spread + wrists-above-shoulders |

Adding a new exercise takes one file (`src/lib/exercises/<name>.ts`) + one line in `src/lib/exercises/index.ts`. The exercise engine handles rep counting, form evaluation, and scoring automatically.

### Real-Time Coaching

- **Rep counting** via a state machine (READY → DESCENDING → BOTTOM → ASCENDING → REP_COMPLETED) with per-state min dwell times to prevent double-counting from frame-by-frame jitter.
- **Form rules** per exercise (e.g. "knees aligned with feet", "chest up", "don't drop hips") — each returns a 0..1 score; failing rules (< 0.6) become coaching cues.
- **Scoring breakdown** with five components: Form, Range of Motion, Symmetry, Tempo, Stability — each documented in `src/lib/exercises/engine.ts`.
- **Coaching engine** with severity levels (info / warning / error / success), per-cue cooldown, and duplicate-message suppression.
- **Voice coach** via SpeechSynthesis — speaks one cue at a time, configurable volume / rate / frequency, never repeats the same text within 4 seconds.

### Privacy-First

- **"Pose processing happens on your device."** displayed in-app.
- **No backend, no auth, no cloud.** Camera frames never leave the browser. The only network calls are to TensorFlow.js model weights (cached after first load) — and even those can be served by the PWA service worker for offline use.
- **Privacy settings** control scene analysis, voice coach, local history, and saved media — each can be toggled independently.
- **Delete-all-data** button wipes IndexedDB stores for settings, workouts, captures, stats, and personal records.

### Mobile-First UX

- Bottom navigation with 7 destinations.
- Camera-first full-screen experience.
- Large rep counter + form score + single most-important cue during exercise.
- Safe-area insets for notch / home-indicator devices.
- Light / Dark / System theme + reduced-motion + high-contrast accessibility options.

### Persistence & Analytics

- **IndexedDB** stores workout history, settings, captures metadata, user stats, and personal records.
- **Dashboard** shows today's stats, weekly activity bar chart, totals, streak, achievements, recent sessions, and per-exercise performance.
- **Export** workout history as JSON or CSV.
- **Achievements**: First Workout, 100 Reps, 7-Day Streak, Perfect Form, 10 Workouts, 1,000 Reps.

### Performance

- `usePoseDetection` hook runs a throttled rAF loop. The `onFrame` callback lets exercise engines react per-frame **without triggering React re-renders**; UI state is updated at most ~5 Hz.
- Heavy mutable state (camera stream, detector, rAF id, FPS counters) lives in `useRef`, not `useState`.
- TensorFlow tensors disposed on unmount; detector shared across mode switches via a module-level singleton.
- WebGL backend with automatic CPU fallback.
- Optional developer performance panel showing FPS, inference time, backend, model.

### PWA

- Installable to home screen (manifest + icons).
- Service worker caches the app shell for offline use after first load.
- Apple-specific meta tags for iOS standalone mode.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Build | Vite 7 + TypeScript 5.9 |
| UI | React 19 + Tailwind CSS v4 |
| Pose AI | TensorFlow.js 4.22 + `@tensorflow-models/pose-detection` (MoveNet SinglePose Lightning) |
| Storage | IndexedDB via `idb-keyval` |
| Voice | Browser SpeechSynthesis API |
| PWA | `vite-plugin-pwa` (Workbox service worker) |
| Tests | Vitest 2.1 + jsdom |
| Lint | ESLint 9 + typescript-eslint |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** (tested on Node 22 LTS)
- **A modern browser** with:
  - WebGL support (for TensorFlow.js GPU acceleration)
  - `getUserMedia` support (camera)
  - IndexedDB support (storage)

Recommended: latest Chrome, Firefox, or Safari (Safari/iOS supports MediaRecorder on 14.3+).

### Installation

```bash
git clone https://github.com/niranjan-00/AiPose-Assistant.git
cd AiPose-Assistant
npm install
```

### Development

```bash
npm run dev          # Start dev server at http://localhost:5173
```

Open the URL, click **Start camera**, and grant camera permission.

### Build

```bash
npm run build        # TypeScript check + Vite production build (single HTML file)
npm run preview      # Preview the production build
```

The build outputs a single `dist/index.html` (inlined JS + CSS) plus the PWA manifest, service worker, and icons as separate assets.

### Lint & Tests

```bash
npm run lint         # ESLint, 0 warnings allowed
npm test             # Vitest run (one-shot)
npm run test:watch   # Vitest watch mode
npm run typecheck    # TypeScript type-check only
```

---

## 📁 Project Structure

```
src/
├── App.tsx                  # App shell: mode selector + bottom nav
├── main.tsx                 # React root + ErrorBoundary
├── index.css               # Tailwind theme + animations
│
├── types/                  # Pure type definitions
│   ├── pose.ts             #   PoseKeypoint, PoseFrame, Severity, etc.
│   ├── exercise.ts         #   ExerciseDefinition, ExerciseState, FormFeedback
│   ├── workout.ts          #   WorkoutSession, WorkoutSummary, UserStats
│   ├── settings.ts         #   Settings, Theme, VideoQuality
│   └── capture.ts          #   CaptureItem
│
├── constants/
│   └── pose.ts             # SKELETON_CONNECTIONS, thresholds, severity colors
│
├── lib/                    # Pure business logic (no React, no DOM)
│   ├── pose/
│   │   ├── keypoints.ts    #   angleAt, jointAngle, getKeypoint, distance
│   │   ├── project.ts     #   mapKeypoint (object-cover transform)
│   │   └── evaluate.ts     #   pose quality scoring + suggestions
│   │
│   ├── exercises/          # The exercise engine + 8 exercise modules
│   │   ├── engine.ts       #   State machine, scoring, rep counter
│   │   ├── squat.ts        #   Squat definition
│   │   ├── pushup.ts
│   │   ├── plank.ts
│   │   ├── lunge.ts
│   │   ├── bicepCurl.ts
│   │   ├── shoulderPress.ts
│   │   ├── situp.ts
│   │   ├── jumpingJack.ts
│   │   └── index.ts        #   EXERCISES registry
│   │
│   ├── coaching/
│   │   └── coach.ts        # pickCoaching: priority + cooldown + dedup
│   │
│   ├── voice/
│   │   └── speech.ts       # SpeechSynthesis wrapper with queue
│   │
│   ├── posture/
│   │   └── analyze.ts      # Head/shoulder/torso/hip analysis
│   │
│   ├── comparison/
│   │   └── pose.ts         # Normalized joint-angle pose comparison
│   │
│   ├── targetPoses/
│   │   └── index.ts        # T-Pose, Tree, Warrior, Hands Up, Side
│   │
│   ├── scene/
│   │   └── analyze.ts      # Background/lighting/attire heuristic
│   │
│   ├── capture/
│   │   └── recorder.ts     # MediaRecorder + photo capture helpers
│   │
│   └── storage/
│       └── db.ts           # IndexedDB CRUD (settings, workouts, stats, etc.)
│
├── hooks/                  # React hooks (stateful wrappers around lib/)
│   ├── useCamera.ts        # getUserMedia + device selection + errors
│   ├── usePoseDetection.ts # MoveNet + rAF loop + throttled state updates
│   ├── useExerciseRunner.ts # Wires the engine to React state + voice
│   ├── useVoiceCoach.ts
│   ├── useSettings.tsx     # Context provider + hook
│   └── useApplyTheme.ts
│
├── components/
│   ├── ErrorBoundary.tsx
│   ├── CameraView.tsx      # Shared video + skeleton overlay
│   ├── FeedbackPanel.tsx
│   ├── RepCounter.tsx
│   ├── ModeNav.tsx         # Bottom navigation
│   ├── DevPanel.tsx
│   └── ui/                 # Button, IconButton, Card, Sheet, Segmented, Stat
│
├── modes/                  # One component per app mode
│   ├── PoseStudio.tsx
│   ├── FitnessCoach.tsx
│   ├── PostureMonitor.tsx
│   ├── PosePractice.tsx
│   ├── WorkoutMode.tsx     # Builder + Session + Rest + Summary screens
│   ├── Dashboard.tsx
│   └── SettingsView.tsx
│
└── test/
    └── setup.ts            # Vitest setup (mocks for SpeechSynthesis, MediaRecorder)
```

---

## 🧠 Exercise Algorithm Documentation

### Rep Detection (state machine)

Every exercise defines `repDetectionRules` — a list of transitions between states. Each transition has:

- `from`: the state to transition FROM (e.g. `"ready"`)
- `to`: the state to transition TO (e.g. `"descending"`)
- `condition(ctx)`: a predicate over the current pose frame
- `minDwellMs`: minimum time the user must spend in `from` before transitioning (prevents jitter)

The 5 states are: `ready → descending → bottom → ascending → rep_completed`. After `rep_completed`, the engine immediately resets to `ready` for the next rep.

A rep is only counted when the full cycle completes. This is the key fix vs. naive angle-threshold counting — angle jitter at the bottom of a squat doesn't double-count.

### Confidence Gating

When average keypoint confidence drops below `REP_MIN_CONFIDENCE` (0.4), the state machine pauses — no transitions fire, no reps are counted, and the UI shows "Move into view" instead of misleading cues. This prevents garbage counts when the user is partially out of frame or in low light.

### Form Rules

Each exercise defines `formRules` — per-frame checks that return a 0..1 score. Rules that score below 0.6 become coaching cues. Example from `squat.ts`:

```ts
{
  id: "squat-chest-up",
  description: "Keep your chest up",
  cue: "Keep your chest up",
  severity: "warning",
  evaluate: (ctx) => {
    // Angle of shoulder→hip vector vs. vertical (screen coords, y down)
    const lean = Math.abs(Math.atan2(dx, dy)) * (180 / Math.PI);
    if (lean < 15) return 1;      // upright: perfect
    if (lean < 30) return 0.6;     // mild lean: ok
    return 0.3;                    // heavy lean: poor
  },
}
```

### Score Breakdown

The form score (0..100) is a weighted average of five components:

| Component | Weight | How it's calculated |
|---|---|---|
| Form | 35% | Average of all form rule scores for the frame |
| Range of Motion | 20% | How close the primary joint angle gets to its `target` |
| Symmetry | 15% | Left-vs-right angle delta (smaller = better) |
| Tempo | 15% | Average rep duration vs. 1.5–4s ideal band |
| Stability | 15% | Standard deviation of angle history over last 6 frames |

Per-rep scores are tracked and averaged across the session. See `computeScoreBreakdown` in `src/lib/exercises/engine.ts` for the exact formula.

### Coaching Engine

`pickCoaching(state, { feedback, repDelta, now })` returns at most one message per frame:

1. If a rep just completed and the success cooldown has elapsed → emit "Good rep."
2. Otherwise, sort feedback by severity (error > warning > info) then by score (worst first).
3. For each feedback item, check per-rule cooldown (default 2.5 s) and text-dedup (3 s).
4. Return the first eligible cue, or `null`.

The voice coach applies an additional layer: same text won't be spoken within 4 seconds, and frequency (minimal/balanced/verbose) filters by severity.

---

## 🌐 Browser Requirements

| Feature | Required for | Support |
|---|---|---|
| WebGL | TensorFlow.js GPU acceleration | All modern browsers |
| getUserMedia | Camera access | All modern browsers (HTTPS only) |
| IndexedDB | Workout history, settings | All modern browsers |
| MediaRecorder | Video recording in Pose Studio | Chrome, Firefox, Safari 14.3+ |
| SpeechSynthesis | Voice coach | Chrome, Firefox, Safari |
| PWA install | Add to home screen | Chrome, Edge, Safari (iOS) |

The app gracefully degrades: if MediaRecorder isn't supported, photo capture still works; if SpeechSynthesis isn't available, on-screen cues still appear; if WebGL is unavailable, TensorFlow falls back to the CPU backend.

---

## 🔒 Camera Permissions

On first use, your browser will prompt for camera permission. Grant access to use any camera-based mode. AiPose only accesses the camera while a camera-based mode is active — closing the tab or navigating to Settings/Dashboard stops the stream immediately.

If you deny permission, the app shows a clear message: "Camera permission denied. Enable camera access in your browser to use AiPose."

---

## 🔐 Privacy

AiPose is built privacy-first:

- **No backend, no analytics SDK, no auth.** The only outbound network call is to TensorFlow.js model weights (cached after first load).
- **No camera frames uploaded.** Pose detection runs locally via TensorFlow.js; frames are processed in-memory and discarded unless the user explicitly captures a photo or video.
- **IndexedDB stores only**: settings, workout summaries (sets/reps/form scores/durations), captures metadata (URLs to blobs, no raw frames), and aggregated stats.
- **Privacy settings** let you toggle scene analysis, voice coach, local history, and saved media independently.
- **Delete all data** button in Settings → Data Management wipes every IndexedDB store.

For full transparency, all storage code lives in `src/lib/storage/db.ts`.

---

## 🧪 Testing

The Vitest suite covers the pure business logic:

```
src/lib/pose/keypoints.test.ts       # 14 tests: angle math, keypoint lookups, confidence
src/lib/exercises/engine.test.ts     # 8 tests: squat/push-up rep cycles, low-confidence suppression, coach cooldown
src/lib/posture/analyze.test.ts      # 4 tests: no-person, good posture, head-forward, shoulder slope
src/lib/comparison/pose.test.ts      # 4 tests: exact match, different pose, insufficient keypoints, target builder
```

Run:

```bash
npm test             # one-shot
npm run test:watch   # watch mode
```

Edge cases covered:
- Missing keypoints / low confidence (no rep counted, no cue shown)
- Person partially out of frame
- State-machine jitter (min dwell times prevent double-counting)
- Coach cooldown (same cue not repeated within 2.5 s)
- Symmetric vs. asymmetric poses

---

## 🎯 Implementation Priority (delivered)

This upgrade was implemented in priority order:

1. ✅ Architecture cleanup (modular folders, error boundary, `cn()` utility)
2. ✅ Performance (ref-based state, throttled UI updates, single detector instance)
3. ✅ Pose engine abstraction (`usePoseDetection` hook)
4. ✅ Exercise engine (state machine, form rules, scoring)
5. ✅ Squat detection + rep counting + form correction
6. ✅ Push-up, Lunge, Jumping Jack, Plank + 4 more exercises (8 total)
7. ✅ Workout mode (builder, session, rest timer, summary)
8. ✅ Voice coaching
9. ✅ Posture monitoring
10. ✅ Pose comparison
11. ✅ Dashboard + analytics + IndexedDB
12. ✅ PWA + accessibility + tests

---

## 🗺 Future Roadmap

- Multi-pose detection (when a suitable TensorFlow.js multi-pose model is practical on mobile)
- BlazePose option (33 keypoints, 3D) for higher-accuracy form analysis
- Slow-motion video review
- Workout sharing / leaderboards (opt-in, with explicit user consent)
- Calorie estimate refinement (using actual body weight + MET values per exercise)
- Wearable heart-rate integration (Bluetooth)
- Local workout history graphs (line chart for form score trend over weeks)

---

## 🤝 Contributing

PRs welcome. Before submitting:

1. `npm run lint` must pass with 0 warnings.
2. `npm test` must pass.
3. `npm run build` must succeed.
4. If you add a new exercise, add at least one test in `src/lib/exercises/engine.test.ts` covering its rep cycle.
5. If you add a new component, prefer extending an existing UI primitive (`Button`, `Card`, `Sheet`, etc.) over re-implementing styles.

---

## 📄 License

This project inherits the license of the upstream `niranjan-00/AiPose-Assistant` repository. See `LICENSE` if present, or contact the maintainer.

---

## 🙏 Acknowledgements

- [TensorFlow.js](https://www.tensorflow.org/js) and the [pose-detection model](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection) team
- [MoveNet](https://blog.tensorflow.org/2021/05/next-generation-pose-detection-with-movenet.html) — the real-time single-person pose model
- The original AiPose Assistant project for the camera + scene-analysis foundation

---

**Disclaimer:** AiPose Assistant provides computer-vision guidance, not medical advice. Exercise and posture feedback is based on heuristic joint-angle analysis and should not replace a qualified fitness or medical professional. Calorie estimates are approximate MET-based calculations, not precise measurements.
