import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Crown, Flame, History, Lock, MessageCircle, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadHistory, type Workout } from "@/lib/history";
import { achievements, rankFor, totalReps } from "@/lib/progress";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RageBit — AI Workout Tracker with Ranks & Achievements" },
      { name: "description", content: "Pick an exercise, let your camera count reps and check form, and climb the ranks." },
      { property: "og:title", content: "RageBit — AI Workout Tracker" },
      { property: "og:description", content: "Camera rep counting, live form checks, ranks and achievements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const [history, setHistory] = useState<Workout[]>([]);
  useEffect(() => setHistory(loadHistory()), []);

  const total = totalReps(history);
  const { rank, next, progress, level } = rankFor(total);
  const list = achievements(history);
  const got = list.filter((a) => a.unlocked).length;

  return (
    <div className="rage min-h-dvh bg-background text-foreground" style={{ backgroundImage: "var(--gradient-hero)" }}>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-5 pt-6 pb-10">
        <header className="flex items-center justify-between">
          <span className="text-2xl font-black italic tracking-tight">
            RAGE<span className="text-primary neon-glow">BIT</span>
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="Workout history" asChild>
              <Link to="/history"><History /></Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Open AI coach chat" asChild>
              <Link to="/chat"><MessageCircle /></Link>
            </Button>
          </div>
        </header>

        <section>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary">Train. Rank up. Rage.</p>
          <h1 className="mt-2 text-5xl leading-[0.95] font-black italic tracking-tight">
            Every rep<br />
            <span className="text-primary neon-glow">counts.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Your camera counts reps and checks your form live.</p>
        </section>

        <section className="rounded-3xl border border-border bg-card/80 p-5 backdrop-blur" style={{ boxShadow: "var(--shadow-neon)" }}>
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundImage: "var(--gradient-rank)" }}>
              <Crown className="size-8 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rank · Lv {level}</p>
              <p className="text-2xl font-black">{rank.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{total} lifetime reps</p>
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, backgroundImage: "var(--gradient-rank)" }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            {next ? `${next.min - total} reps to ${next.name}` : "Max rank reached. Legend."}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Choose your workout</h2>
          <Link
            to="/pushups"
            className="group relative overflow-hidden rounded-3xl border border-primary/50 bg-card p-5 transition-transform active:scale-[0.98]"
            style={{ boxShadow: "var(--shadow-neon)" }}
          >
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Zap className="size-7" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-black">Push-Ups</p>
                <p className="text-xs text-muted-foreground">Depth meter · hip check · rep counter</p>
              </div>
              <ChevronRight className="text-primary transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
          <div aria-disabled className="rounded-3xl border border-border bg-card/50 p-5 opacity-60">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Lock className="size-6" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-black">Squats</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Achievements</h2>
            <span className="text-xs font-bold text-primary tabular-nums">{got}/{list.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {list.map((a) => (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 ${a.unlocked ? "border-secondary/60 bg-secondary/10" : "border-border bg-card/40 opacity-55"}`}
              >
                {a.unlocked ? <Trophy className="size-5 text-secondary" /> : <Lock className="size-5 text-muted-foreground" />}
                <p className="mt-2 text-sm font-bold">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Flame className="size-3.5 text-primary" /> Save a workout to rank up
        </p>
      </div>
    </div>
  );
}
