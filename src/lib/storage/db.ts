/**
 * IndexedDB storage layer — uses idb-keyval for a tiny KV API.
 *
 * Stores:
 *   - settings: { appearance, camera, pose, voice, privacy, units }
 *   - workouts: WorkoutSummary[] (history)
 *   - captures: CaptureItem[] metadata (no raw frames by default)
 *   - userStats: UserStats (streaks, totals, achievements)
 *   - personalRecords: PersonalRecord[]
 *
 * All storage is opt-in via Settings.privacy.*. The user can clear all data
 * via `clearAllData()`.
 */
import { createStore, get, set, del, clear } from "idb-keyval";
import type { Settings } from "@/types/settings";
import type {
  WorkoutSummary,
  UserStats,
  PersonalRecord,
} from "@/types/workout";
import type { CaptureItem } from "@/types/capture";
import { DEFAULT_SETTINGS } from "@/types/settings";

const settingsStore = createStore("aipose-db", "settings");
const workoutsStore = createStore("aipose-db", "workouts");
const capturesStore = createStore("aipose-db", "captures");
const statsStore = createStore("aipose-db", "userStats");
const prStore = createStore("aipose-db", "personalRecords");

// Settings
export async function loadSettings(): Promise<Settings> {
  try {
    const s = (await get("settings", settingsStore)) as Settings | undefined;
    if (!s) return DEFAULT_SETTINGS;
    // Merge with defaults to handle newly added fields
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      appearance: { ...DEFAULT_SETTINGS.appearance, ...s.appearance },
      camera: { ...DEFAULT_SETTINGS.camera, ...s.camera },
      pose: { ...DEFAULT_SETTINGS.pose, ...s.pose },
      voice: { ...DEFAULT_SETTINGS.voice, ...s.voice },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...s.privacy },
    } as Settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await set("settings", s, settingsStore);
  } catch {
    // Storage may be unavailable in private browsing — fail silently.
  }
}

// Workout history
export async function loadWorkouts(): Promise<WorkoutSummary[]> {
  try {
    return (await get("workouts", workoutsStore)) ?? [];
  } catch {
    return [];
  }
}

export async function saveWorkout(summary: WorkoutSummary): Promise<void> {
  const all = await loadWorkouts();
  all.unshift(summary);
  // Cap at 200 entries
  if (all.length > 200) all.length = 200;
  try {
    await set("workouts", all, workoutsStore);
  } catch {
    /* ignore */
  }
}

export async function clearWorkouts(): Promise<void> {
  try {
    await del("workouts", workoutsStore);
  } catch {
    /* ignore */
  }
}

// Captures metadata
export async function loadCaptures(): Promise<CaptureItem[]> {
  try {
    return (await get("captures", capturesStore)) ?? [];
  } catch {
    return [];
  }
}

export async function saveCaptures(items: CaptureItem[]): Promise<void> {
  try {
    await set("captures", items, capturesStore);
  } catch {
    /* ignore */
  }
}

export async function clearCaptures(): Promise<void> {
  try {
    await del("captures", capturesStore);
  } catch {
    /* ignore */
  }
}

// User stats
export async function loadUserStats(): Promise<UserStats | null> {
  try {
    return (await get("stats", statsStore)) ?? null;
  } catch {
    return null;
  }
}

export async function saveUserStats(stats: UserStats): Promise<void> {
  try {
    await set("stats", stats, statsStore);
  } catch {
    /* ignore */
  }
}

// Personal records
export async function loadPersonalRecords(): Promise<PersonalRecord[]> {
  try {
    return (await get("prs", prStore)) ?? [];
  } catch {
    return [];
  }
}

export async function savePersonalRecords(prs: PersonalRecord[]): Promise<void> {
  try {
    await set("prs", prs, prStore);
  } catch {
    /* ignore */
  }
}

/**
 * Clear ALL locally stored data (settings, workouts, captures, stats, PRs).
 * Used by the "Delete all data" button in Privacy Settings.
 */
export async function clearAllData(): Promise<void> {
  try {
    await Promise.all([
      clear(settingsStore),
      clear(workoutsStore),
      clear(capturesStore),
      clear(statsStore),
      clear(prStore),
    ]);
  } catch {
    /* ignore */
  }
}

/**
 * Export all data as JSON (for download).
 */
export async function exportAllData(): Promise<string> {
  const settings = await loadSettings();
  const workouts = await loadWorkouts();
  const captures = await loadCaptures();
  const stats = await loadUserStats();
  const prs = await loadPersonalRecords();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      settings,
      workouts,
      captures,
      stats,
      personalRecords: prs,
    },
    null,
    2,
  );
}

/**
 * Export workouts as CSV (basic columns).
 */
export async function exportWorkoutsAsCsv(): Promise<string> {
  const workouts = await loadWorkouts();
  const rows = [
    [
      "session_id",
      "name",
      "started_at",
      "ended_at",
      "duration_ms",
      "total_sets",
      "total_reps",
      "avg_form_score",
      "estimated_calories",
    ].join(","),
  ];
  for (const w of workouts) {
    const cells = [
      w.sessionId,
      `"${w.name.replace(/"/g, '""')}"`,
      new Date(w.startedAt).toISOString(),
      new Date(w.endedAt).toISOString(),
      String(w.durationMs),
      String(w.totalSets),
      String(w.totalReps),
      String(w.avgFormScore),
      String(w.estimatedCalories),
    ];
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}
