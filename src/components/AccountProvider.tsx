import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { HISTORY_EVENT, pendingWorkouts, setHistoryOwner } from "@/lib/history";
import { syncWorkouts } from "@/lib/workout-sync";

type AccountState = { user: User | null; ready: boolean; sync: "idle" | "syncing" | "synced" | "error"; retry: () => void };
const AccountContext = createContext<AccountState>({ user: null, ready: false, sync: "idle", retry: () => {} });
export const useAccount = () => useContext(AccountContext);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<AccountState["sync"]>("idle");
  const [retryTick, setRetryTick] = useState(0);
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    let revision = 0;
    async function refresh() {
      const current = ++revision;
      const { data } = await supabase.auth.getUser();
      if (!active || current !== revision) return;
      setHistoryOwner(data.user?.id ?? null);
      setUser(data.user); setReady(true);
    }
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      if (event === "SIGNED_OUT") {
        revision++; setHistoryOwner(null); setUser(null); setReady(true);
      } else { setTimeout(() => { if (active) void refresh(); }, 0); }
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router, queryClient]);

  useEffect(() => {
    if (!user) { setSync("idle"); return; }
    const id = user.id;
    let active = true, busy = false, requested = false;
    async function run() {
      if (!active) return;
      if (busy) { requested = true; return; }
      busy = true; setSync("syncing");
      try {
        await syncWorkouts(id);
        if (active) setSync("synced");
      } catch { if (active) setSync("error"); }
      finally {
        busy = false;
        if (requested && active) { requested = false; void run(); }
      }
    }
    const changed = () => { if (pendingWorkouts(id).length) void run(); };
    const focused = () => { if (document.visibilityState === "visible") void run(); };
    void run();
    window.addEventListener(HISTORY_EVENT, changed);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", focused);
    return () => { active = false; window.removeEventListener(HISTORY_EVENT, changed); window.removeEventListener("online", run); document.removeEventListener("visibilitychange", focused); };
  }, [user?.id, retryTick]);
  return <AccountContext.Provider value={{ user, ready, sync, retry: () => setRetryTick((n) => n + 1) }}>{children}</AccountContext.Provider>;
}