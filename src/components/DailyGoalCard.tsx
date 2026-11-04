import { useEffect, useState } from "react";
import { Check, Flame, Minus, Pencil, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Workout } from "@/lib/history";
import { DEFAULT_DAILY_GOAL, GOAL_MAX, GOAL_MIN, GOAL_STEP, clampGoal, goalStreak, today } from "@/lib/progress";

const KEY = "ragebit-daily-goal";

/** Today's reps against a user-set daily goal, with a ring and goal streak. */
export function DailyGoalCard({ history }: { history: Workout[] }) {
  const [goal, setGoal] = useState(DEFAULT_DAILY_GOAL);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    if (saved) setGoal(clampGoal(saved));
  }, []);
  const change = (g: number) => {
    const next = clampGoal(g);
    setGoal(next);
    localStorage.setItem(KEY, String(next));
  };

  const t = today(history, goal);
  const streak = goalStreak(history, goal);
  const R = 34, C = 2 * Math.PI * R;

  return (
    <section className={`rounded-sm border-2 bg-card p-5 ${t.hit ? "border-secondary" : "border-primary"}`} aria-label="Daily goal">
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90">
            <circle cx="40" cy="40" r={R} fill="none" strokeWidth="8" className="stroke-muted" />
            <circle
              cx="40" cy="40" r={R} fill="none" strokeWidth="8" strokeLinecap="butt"
              strokeDasharray={C} strokeDashoffset={C * (1 - t.progress)}
              className={`transition-[stroke-dashoffset] duration-700 ${t.hit ? "stroke-secondary" : "stroke-primary"}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {t.hit ? <Check className="size-8 text-secondary" /> : (
              <span className="font-mono text-lg font-extrabold tabular-nums">{Math.round(t.progress * 100)}%</span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-mono text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            <Target className="size-3.5" /> Today's goal
          </p>
          <p className="font-impact text-3xl uppercase tabular-nums">
            {t.reps}<span className="text-muted-foreground"> / {goal}</span>
          </p>
          <p className={`font-mono text-xs font-bold uppercase ${t.hit ? "text-secondary" : "text-muted-foreground"}`}>
            {t.hit ? "Goal crushed." : `${t.left} reps to go`}
            {t.plankSeconds > 0 && <span className="text-muted-foreground"> · {t.plankSeconds}s plank</span>}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label={editing ? "Done editing goal" : "Edit daily goal"} onClick={() => setEditing((e) => !e)}>
          {editing ? <Check /> : <Pencil />}
        </Button>
      </div>

      {editing && (
        <div className="mt-4 flex items-center gap-3 border-t-2 border-border pt-4 animate-in fade-in">
          <span className="flex-1 text-sm font-bold uppercase">Reps per day</span>
          <Button variant="outline" size="icon" className="size-10 rounded-sm border-2 border-primary active:translate-y-0.5" aria-label="Lower goal" disabled={goal <= GOAL_MIN} onClick={() => change(goal - GOAL_STEP)}><Minus /></Button>
          <span className="w-14 text-center font-mono text-2xl font-extrabold tabular-nums">{goal}</span>
          <Button variant="outline" size="icon" className="size-10 rounded-sm border-2 border-primary active:translate-y-0.5" aria-label="Raise goal" disabled={goal >= GOAL_MAX} onClick={() => change(goal + GOAL_STEP)}><Plus /></Button>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground">
        <Flame className={`size-3.5 ${streak > 0 ? "text-primary" : ""}`} />
        {streak > 0 ? `${streak}-day goal streak` : "Hit your goal to start a streak"}
        <span className="ml-auto">Push-ups + squats</span>
      </p>
    </section>
  );
}
