import { supabase } from "@/integrations/supabase/client";
import { acknowledgePending, exerciseOf, historyOwner, pendingWorkouts, replaceCloudHistory, type Exercise, type Workout } from "./history";

/** RLS enforces ownership for every browser request; queues and caches are account-scoped. */
export async function syncWorkouts(id: string) {
  const sent = pendingWorkouts(id);
  if (sent.length) {
    const { error } = await supabase.from("workouts").upsert(sent.map(({ workout: w, deleted }) => ({
      user_id: id, id: w.id, started_at: w.startedAt, ended_at: w.endedAt, reps: w.reps,
      exercise: exerciseOf(w), badges: w.badges, deleted,
    })), { onConflict: "user_id,id" });
    if (error) throw error;
    acknowledgePending(id, sent);
  }
  const workouts: Workout[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("workouts").select("*").eq("user_id", id).eq("deleted", false)
      .order("started_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw error;
    for (const row of data) workouts.push({ id: row.id, startedAt: row.started_at, endedAt: row.ended_at,
      reps: row.reps, exercise: row.exercise as Exercise, badges: row.badges as Workout["badges"] });
    if (data.length < 500) break;
  }
  if (historyOwner() === id) replaceCloudHistory(id, workouts);
}