/**
 * Dashboard — shows today's workout, weekly activity, totals, streaks,
 * personal records, and recent sessions.
 *
 * Uses IndexedDB-stored workout history. No backend, no fake data.
 */
import { useEffect, useState } from "react";
import type { DashboardData } from "@/types/workout";
import type { Achievement } from "@/types/workout";
import {
  exportAllData,
  exportWorkoutsAsCsv,
  loadPersonalRecords,
  loadUserStats,
  loadWorkouts,
} from "@/lib/storage/db";
import { EXERCISES } from "@/lib/exercises";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDuration, downloadUrl } from "@/lib/capture/recorder";
import { cn } from "@/utils/cn";

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-workout",
    name: "First Workout",
    description: "Complete your first workout",
    icon: "🎯",
    isUnlocked: (s) => s.totalWorkouts >= 1,
  },
  {
    id: "100-reps",
    name: "100 Reps",
    description: "Reach 100 total reps",
    icon: "💯",
    isUnlocked: (s) => s.totalReps >= 100,
  },
  {
    id: "7-day-streak",
    name: "7-Day Streak",
    description: "Work out 7 days in a row",
    icon: "🔥",
    isUnlocked: (s) => s.currentStreakDays >= 7 || s.bestStreakDays >= 7,
  },
  {
    id: "perfect-form",
    name: "Perfect Form",
    description: "Hit 95%+ form score on a set",
    icon: "✨",
    isUnlocked: (s) =>
      Object.values(s.perExerciseBest).some((v) => v && v.formScore >= 95),
  },
  {
    id: "10-workouts",
    name: "10 Workouts",
    description: "Complete 10 workouts",
    icon: "🏆",
    isUnlocked: (s) => s.totalWorkouts >= 10,
  },
  {
    id: "1000-reps",
    name: "1,000 Reps",
    description: "Reach 1,000 total reps",
    icon: "🚀",
    isUnlocked: (s) => s.totalReps >= 1000,
  },
];

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function load() {
      const workouts = await loadWorkouts();
      const stats = (await loadUserStats()) ?? null;
      const prs = await loadPersonalRecords();

      // Build today + weekly
      const today = new Date().toISOString().slice(0, 10);
      const todayWorkouts = workouts.filter(
        (w) => new Date(w.startedAt).toISOString().slice(0, 10) === today,
      );
      const todayTotals = todayWorkouts.reduce(
        (acc, w) => ({
          reps: acc.reps + w.totalReps,
          activeMs: acc.activeMs + w.durationMs,
          formSum: acc.formSum + w.avgFormScore,
          count: acc.count + 1,
        }),
        { reps: 0, activeMs: 0, formSum: 0, count: 0 },
      );

      const weekly: DashboardData["weekly"] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        const dayWs = workouts.filter(
          (w) => new Date(w.startedAt).toISOString().slice(0, 10) === dayStr,
        );
        weekly.push({
          date: dayStr,
          workoutCount: dayWs.length,
          totalReps: dayWs.reduce((s, w) => s + w.totalReps, 0),
          activeMs: dayWs.reduce((s, w) => s + w.durationMs, 0),
          avgFormScore: dayWs.length > 0
            ? Math.round(dayWs.reduce((s, w) => s + w.avgFormScore, 0) / dayWs.length)
            : 0,
        });
      }

      // Per-exercise performance
      const perExMap = new Map<string, { sessions: number; totalReps: number; formSum: number; bestForm: number }>();
      for (const w of workouts) {
        for (const ex of w.exercises) {
          const cur = perExMap.get(ex.exerciseId) ?? {
            sessions: 0,
            totalReps: 0,
            formSum: 0,
            bestForm: 0,
          };
          cur.sessions += 1;
          cur.totalReps += ex.totalReps;
          cur.formSum += ex.avgFormScore;
          cur.bestForm = Math.max(cur.bestForm, ex.bestFormScore);
          perExMap.set(ex.exerciseId, cur);
        }
      }

      const perExercisePerformance = Array.from(perExMap.entries()).map(([id, v]) => ({
        exerciseId: id as never,
        sessions: v.sessions,
        totalReps: v.totalReps,
        avgFormScore: Math.round(v.formSum / Math.max(1, v.sessions)),
        bestFormScore: v.bestForm,
      })).sort((a, b) => b.totalReps - a.totalReps);

      setData({
        today: {
          workoutCount: todayTotals.count,
          totalReps: todayTotals.reps,
          activeMs: todayTotals.activeMs,
          avgFormScore: todayTotals.count > 0 ? Math.round(todayTotals.formSum / todayTotals.count) : 0,
        },
        weekly,
        totals: {
          workouts: stats?.totalWorkouts ?? 0,
          reps: stats?.totalReps ?? 0,
          activeMs: stats?.totalActiveMs ?? 0,
          avgFormScore: workouts.length > 0
            ? Math.round(workouts.reduce((s, w) => s + w.avgFormScore, 0) / workouts.length)
            : 0,
          currentStreakDays: stats?.currentStreakDays ?? 0,
          bestStreakDays: stats?.bestStreakDays ?? 0,
        },
        recentSessions: workouts.slice(0, 10),
        perExercisePerformance,
        personalRecords: prs,
        achievements: ACHIEVEMENTS,
      });
    }
    load();
  }, []);

  async function handleExportJson() {
    const data = await exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `aipose-export-${Date.now()}.json`);
  }

  async function handleExportCsv() {
    const csv = await exportWorkoutsAsCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `aipose-workouts-${Date.now()}.csv`);
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-white/50">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-zinc-950 p-4 pb-safe">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-white/50">
            Dashboard
          </p>
          <h1 className="text-2xl font-bold">Your progress</h1>
        </div>

        {/* Today's stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Today" value={data.today.workoutCount} unit="workouts" />
          <StatCard label="Today" value={data.today.totalReps} unit="reps" />
          <StatCard label="Today" value={formatDuration(data.today.activeMs)} />
          <StatCard label="Today form" value={`${data.today.avgFormScore}%`} accent={data.today.avgFormScore >= 75 ? "brand" : "default"} />
        </div>

        {/* Weekly activity chart */}
        <Card title="Weekly Activity">
          <div className="flex h-32 items-end justify-between gap-2">
            {data.weekly.map((d) => {
              const max = Math.max(...data.weekly.map((x) => x.totalReps), 50);
              const h = d.totalReps === 0 ? 4 : Math.max(8, (d.totalReps / max) * 100);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn(
                      "w-full rounded-t-md",
                      d.totalReps > 0 ? "bg-lime-300" : "bg-white/10",
                    )}
                    style={{ height: `${h}%` }}
                    aria-label={`${d.date}: ${d.totalReps} reps`}
                  />
                  <span className="text-[9px] text-white/40">
                    {new Date(d.date).toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Streak + totals */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Streak" value={data.totals.currentStreakDays} unit="days" accent="brand" />
          <StatCard label="Best streak" value={data.totals.bestStreakDays} unit="days" />
          <StatCard label="Total workouts" value={data.totals.workouts} />
          <StatCard label="Total reps" value={data.totals.reps} />
        </div>

        {/* Achievements */}
        <Card title="Achievements">
          {data.achievements.length === 0 ? (
            <p className="text-sm text-white/50">No achievements yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {data.achievements.map((a) => {
                const unlocked = data.totals.workouts > 0 || data.totals.reps > 0;
                const isUnlocked = unlocked && (
                  (a.id === "first-workout" && data.totals.workouts >= 1) ||
                  (a.id === "100-reps" && data.totals.reps >= 100) ||
                  (a.id === "7-day-streak" && (data.totals.currentStreakDays >= 7 || data.totals.bestStreakDays >= 7)) ||
                  (a.id === "perfect-form" && false) ||
                  (a.id === "10-workouts" && data.totals.workouts >= 10) ||
                  (a.id === "1000-reps" && data.totals.reps >= 1000)
                );
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border p-3 text-center",
                      isUnlocked
                        ? "border-lime-300/40 bg-lime-300/10"
                        : "border-white/10 bg-white/5 opacity-50",
                    )}
                  >
                    <span className="text-2xl">{a.icon}</span>
                    <span className="text-[10px] font-semibold text-white">
                      {a.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Per-exercise performance */}
        {data.perExercisePerformance.length > 0 && (
          <Card title="Exercise Performance">
            <div className="space-y-2">
              {data.perExercisePerformance.map((p) => {
                const def = EXERCISES[p.exerciseId];
                if (!def) return null;
                return (
                  <div key={p.exerciseId} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                    <div>
                      <p className="text-sm font-bold">{def.name}</p>
                      <p className="text-[10px] text-white/50">
                        {p.sessions} sessions · {p.totalReps} total reps
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-lime-300">{p.avgFormScore}%</p>
                      <p className="text-[10px] text-white/50">best {p.bestFormScore}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Recent sessions */}
        {data.recentSessions.length > 0 && (
          <Card title="Recent Sessions">
            <div className="space-y-2">
              {data.recentSessions.slice(0, 5).map((s) => (
                <div key={s.sessionId} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-bold">{s.name}</p>
                    <p className="text-[10px] text-white/50">
                      {new Date(s.startedAt).toLocaleDateString()} · {formatDuration(s.durationMs)} · {s.totalReps} reps
                    </p>
                  </div>
                  <p className="text-sm font-bold text-lime-300">{s.avgFormScore}%</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Data export */}
        <Card title="Data Export">
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExportJson}>Export JSON</Button>
            <Button size="sm" onClick={handleExportCsv}>Export CSV</Button>
          </div>
        </Card>

        {data.recentSessions.length === 0 && (
          <p className="text-center text-sm text-white/50">
            No workout history yet. Complete your first workout to start tracking progress.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, accent = "default" }: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: "default" | "brand";
}) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/50">{label}</p>
      <p className={cn(
        "text-xl font-bold",
        accent === "brand" ? "text-lime-300" : "text-white",
      )}>
        {value}
        {unit && <span className="ml-1 text-sm text-white/50">{unit}</span>}
      </p>
    </Card>
  );
}
