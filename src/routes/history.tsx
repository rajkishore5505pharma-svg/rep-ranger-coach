import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWorkout, exerciseOf, loadHistory, type Exercise, type Workout } from "@/lib/history";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Workout History — RageBit" },
      { name: "description", content: "Your saved push-up and squat workouts, reps and form badges over time." },
      { property: "og:title", content: "Workout History — RageBit" },
      { property: "og:description", content: "Track your push-up and squat progress over time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});

const fmtDate = (t: number) =>
  new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function History() {
  const [all, setAll] = useState<Workout[]>([]);
  const [filter, setFilter] = useState<"all" | Exercise>("all");
  useEffect(() => setAll(loadHistory()), []);
  const items = filter === "all" ? all : all.filter((w) => exerciseOf(w) === filter);
  const setItems = setAll;

  const total = items.reduce((n, w) => n + w.reps, 0);
  const best = items.reduce((n, w) => Math.max(n, w.reps), 0);
  const recent = [...items].slice(0, 14).reverse();
  const max = Math.max(1, ...recent.map((w) => w.reps));

  return (
    <div className="rage min-h-dvh bg-background px-4 pb-8 text-foreground">
      <header className="flex items-center gap-2 py-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link to="/"><ArrowLeft /></Link>
        </Button>
        <h1 className="text-2xl font-black uppercase tracking-tight">
          HISTORY
        </h1>
      </header>

      <div className="mb-3 flex gap-2" role="tablist">
        {([["all", "All"], ["pushups", "Push-Ups"], ["squats", "Squats"], ["plank", "Plank"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`flex-1 rounded-sm border-2 px-2 py-2 font-mono text-xs font-extrabold uppercase tracking-wider active:translate-y-px ${filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[["Workouts", items.length], ["Total reps", total], ["Best", best]].map(([l, v]) => (
          <div key={l} className="rounded-sm border border-border bg-card p-3 text-center">
            <div className="text-3xl font-mono font-extrabold tabular-nums text-primary neon-glow">{v}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      {recent.length > 1 && (
        <div className="mt-4 rounded-sm border border-border bg-card p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Reps per workout</div>
          <div className="flex h-28 items-end gap-1.5">
            {recent.map((w) => (
              <div key={w.id} className="flex-1 bg-primary" style={{ height: `${(w.reps / max) * 100}%`, minHeight: 4 }} />
            ))}
          </div>
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {items.length === 0 && (
          <li className="rounded-sm border border-border bg-card p-6 text-center text-muted-foreground">
            No workouts yet. Finish a workout and tap Save to see it here.
          </li>
        )}
        {items.map((w) => (
          <li key={w.id} className="rounded-sm border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs font-extrabold uppercase tracking-wider text-primary">{exerciseOf(w) === "squats" ? "Squats" : exerciseOf(w) === "plank" ? "Plank" : "Push-Ups"}</div>
                <div className="text-sm text-muted-foreground">{fmtDate(w.startedAt)} · {fmtDur(w.endedAt - w.startedAt)}</div>
                <div className="text-3xl font-mono font-extrabold tabular-nums">{w.reps} <span className="text-sm font-bold text-muted-foreground">{exerciseOf(w) === "plank" ? "sec" : "reps"}</span>
                  {w.reps > 0 && <span className="ml-2 font-mono text-xs font-bold text-secondary">{Math.min(100, Math.round(((w.badges["Good Form"] ?? 0) / Math.max(1, Object.values(w.badges).reduce((a, b) => a + (b ?? 0), 0))) * 100))}% clean</span>}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete workout"
                onClick={() => { deleteWorkout(w.id); setItems(loadHistory()); }}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
              <span className="rounded-sm bg-secondary px-2.5 py-1 text-secondary-foreground">Good Form ×{w.badges["Good Form"] ?? 0}</span>
              <span className="rounded-sm bg-destructive/80 px-2.5 py-1 text-destructive-foreground">Go Lower ×{w.badges["Go Lower"] ?? 0}</span>
              {exerciseOf(w) === "squats" ? (
                <span className="rounded-sm bg-destructive/80 px-2.5 py-1 text-destructive-foreground">Chest Up ×{w.badges["Chest Up"] ?? 0}</span>
              ) : (
                <>
              <span className="rounded-sm bg-destructive/80 px-2.5 py-1 text-destructive-foreground">
                Hips Sagging ×{(w.badges as Record<string, number>)["Hips Sagging"] ?? (w.badges as Record<string, number>)["Spine Sagging"] ?? 0}
              </span>
              <span className="rounded-sm bg-destructive/80 px-2.5 py-1 text-destructive-foreground">Hips Piking ×{w.badges["Hips Piking"] ?? 0}</span>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
