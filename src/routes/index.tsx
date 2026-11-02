import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Crown, Lock, Dumbbell, Flame, History, MessageCircle, Timer, Trophy, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadHistory, type Workout } from "@/lib/history";
import { achievements, rankFor, totalReps } from "@/lib/progress";
import hero from "@/assets/gym-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RageBit — AI Workout Tracker with Ranks & Achievements" },
      { name: "description", content: "Start a workout, let your camera count reps and check form, and climb the ranks." },
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
  const [picking, setPicking] = useState(false);
  useEffect(() => setHistory(loadHistory()), []);

  const total = totalReps(history);
  const { rank, next, progress, level } = rankFor(total);
  const list = achievements(history);
  const got = list.filter((a) => a.unlocked).length;

  return (
    <div className="rage min-h-dvh bg-background text-foreground">
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img src={hero} alt="Athlete doing a push-up in a dark gym" width={1024} height={1280} className="absolute inset-0 -z-10 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/10" />
        <div className="mx-auto flex min-h-[78dvh] max-w-md flex-col px-5 pt-5 pb-8">
          <header className="flex items-center justify-between">
            <span className="font-impact text-3xl uppercase tracking-wide">
              RAGE<span className="text-primary">BIT</span>
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

          <div className="mt-auto">
            <div className="hazard mb-4 h-2 w-24" />
            <p className="font-mono text-xs font-extrabold uppercase tracking-[0.35em] text-primary">No excuses. No mercy.</p>
            <h1 className="mt-2 font-impact text-7xl leading-[0.88] uppercase">
              Earn<br />every<br /><span className="text-primary">rep.</span>
            </h1>
            <p className="mt-3 max-w-[18rem] text-sm text-muted-foreground">Your camera counts the reps and calls out bad form. Lie to yourself, not to the machine.</p>
            <button
              onClick={() => setPicking(true)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm border-2 border-primary bg-primary py-4 font-impact text-2xl uppercase tracking-wider text-primary-foreground shadow-[4px_4px_0_0_var(--foreground)] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              <Flame className="size-6" /> Start Workout
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-md flex-col gap-6 px-5 pb-10">
        {/* Rank */}
        <section className="rounded-sm border-2 border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-sm bg-primary">
              <Crown className="size-8 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Rank · Lv {level}</p>
              <p className="font-impact text-3xl uppercase">{rank.name}</p>
              <p className="font-mono text-xs tabular-nums text-muted-foreground">{total} lifetime reps</p>
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden border border-border bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
            {next ? `${next.min - total} reps to ${next.name}` : "Max rank reached. Legend."}
          </p>
        </section>

        {/* Achievements */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-impact text-2xl uppercase tracking-wide">Achievements</h2>
            <span className="font-mono text-xs font-extrabold tabular-nums text-primary">{got}/{list.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {list.map((a) => (
              <div
                key={a.id}
                className={`rounded-sm border-2 p-4 ${a.unlocked ? "border-secondary/70 bg-secondary/10" : "border-border bg-card/40 opacity-55"}`}
              >
                {a.unlocked ? <Trophy className="size-5 text-secondary" /> : <Lock className="size-5 text-muted-foreground" />}
                <p className="mt-2 text-sm font-black uppercase">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Workout picker */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-end bg-background/80 backdrop-blur-sm animate-in fade-in" onClick={() => setPicking(false)}>
          <div
            role="dialog"
            aria-label="Choose your workout"
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-md rounded-t-sm border-t-4 border-primary bg-card p-5 pb-8 animate-in slide-in-from-bottom duration-300"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-impact text-3xl uppercase">Pick your poison</h2>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setPicking(false)}><X /></Button>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/pushups"
                className="group flex items-center gap-4 rounded-sm border-2 border-primary bg-background p-4 transition-transform active:scale-[0.98]"
              >
                <div className="flex size-14 items-center justify-center rounded-sm bg-primary text-primary-foreground"><Zap className="size-7" /></div>
                <div className="flex-1">
                  <p className="font-impact text-2xl uppercase">Push-Ups</p>
                  <p className="text-xs text-muted-foreground">Depth meter · hip check · rep counter</p>
                </div>
                <ChevronRight className="text-primary transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/plank"
                className="group flex items-center gap-4 rounded-sm border-2 border-primary bg-background p-4 transition-transform active:scale-[0.98]"
              >
                <div className="flex size-14 items-center justify-center rounded-sm bg-primary text-primary-foreground"><Timer className="size-7" /></div>
                <div className="flex-1">
                  <p className="font-impact text-2xl uppercase">Plank</p>
                  <p className="text-xs text-muted-foreground">Hip line meter · sag/pike check · hold timer</p>
                </div>
                <ChevronRight className="text-primary transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/squats"
                className="group flex items-center gap-4 rounded-sm border-2 border-primary bg-background p-4 transition-transform active:scale-[0.98]"
              >
                <div className="flex size-14 items-center justify-center rounded-sm bg-primary text-primary-foreground"><Dumbbell className="size-7" /></div>
                <div className="flex-1">
                  <p className="font-impact text-2xl uppercase">Squats</p>
                  <p className="text-xs text-muted-foreground">Hip depth meter · back angle · rep counter</p>
                </div>
                <ChevronRight className="text-primary transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

