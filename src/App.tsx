/**
 * AiPose Assistant — AI-powered real-time fitness, posture, and pose coaching.
 * App shell with mode selector + bottom navigation.
 */
import { useCallback, useEffect, useState } from "react";
import { SettingsProvider, useSettings } from "@/hooks/useSettings";
import { useApplyTheme } from "@/hooks/useApplyTheme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ModeNav, type AppMode } from "@/components/ModeNav";
import { PoseStudio } from "@/modes/PoseStudio";
import { FitnessCoach } from "@/modes/FitnessCoach";
import { PostureMonitor } from "@/modes/PostureMonitor";
import { PosePractice } from "@/modes/PosePractice";
import { WorkoutMode } from "@/modes/WorkoutMode";
import { Dashboard } from "@/modes/Dashboard";
import { SettingsView } from "@/modes/SettingsView";

const NAV_ITEMS: Array<{ id: AppMode; label: string; icon: React.ReactNode }> = [
  {
    id: "studio",
    label: "Studio",
    icon: <CameraIcon />,
  },
  {
    id: "fitness",
    label: "Coach",
    icon: <DumbbellIcon />,
  },
  {
    id: "workout",
    label: "Workout",
    icon: <TimerIcon />,
  },
  {
    id: "posture",
    label: "Posture",
    icon: <BodyIcon />,
  },
  {
    id: "practice",
    label: "Practice",
    icon: <TargetIcon />,
  },
  {
    id: "dashboard",
    label: "Stats",
    icon: <ChartIcon />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <GearIcon />,
  },
];

function AppShell() {
  const { settings } = useSettings();
  const [mode, setMode] = useState<AppMode>("studio");
  useApplyTheme(settings);

  // Handle flip-camera event from PoseStudio
  useEffect(() => {
    const handler = () => {
      const next = settings.camera.facingMode === "user" ? "environment" : "user";
      // Update via context (handled by useSettings update elsewhere)
      // We use the same event approach to delegate — simpler: flip in this handler
      // by dispatching update through context.
      window.dispatchEvent(
        new CustomEvent("aipose:camera-flipped", { detail: next }),
      );
    };
    window.addEventListener("aipose:flip-camera", handler);
    return () => window.removeEventListener("aipose:flip-camera", handler);
  }, [settings.camera.facingMode]);

  const render = useCallback(() => {
    switch (mode) {
      case "studio":
        return <PoseStudio />;
      case "fitness":
        return <FitnessCoach />;
      case "posture":
        return <PostureMonitor />;
      case "practice":
        return <PosePractice />;
      case "workout":
        return <WorkoutMode />;
      case "dashboard":
        return <Dashboard />;
      case "settings":
        return <SettingsView />;
      default:
        return <PoseStudio />;
    }
  }, [mode]);

  return (
    <div className="flex h-screen flex-col bg-black text-white">
      <main className="flex-1 overflow-hidden">{render()}</main>
      <ModeNav value={mode} onChange={setMode} items={NAV_ITEMS} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AppShell />
      </SettingsProvider>
    </ErrorBoundary>
  );
}

// ===== Icons (inline SVG) =====

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 8a2 2 0 012-2h2l1-2h6l1 2h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="9" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="19" y="9" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="10" width="2" height="4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="10" width="2" height="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 13V9M9 2h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BodyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 6v6m-4-2l4-2 4 2m-6 6l2 6 2-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 14l3-3 4 4 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 1v3m0 16v3M4.2 4.2l2.1 2.1m11.4 11.4l2.1 2.1M1 12h3m16 0h3M4.2 19.8l2.1-2.1m11.4-11.4l2.1-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
  