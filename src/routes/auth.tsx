import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Cloud, LogOut, RefreshCw, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/components/AccountProvider";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { guestHistory, saveWorkout, setHistoryOwner } from "@/lib/history";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Your Account — RageBit" },
    { name: "description", content: "Sign in to RageBit to save your workout history across devices and manage your athlete profile." },
    { property: "og:title", content: "Your Account — RageBit" },
    { property: "og:description", content: "Your athlete profile and private synced workout history." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Account,
});

function Account() {
  const { user, ready, sync, retry } = useAccount();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => { setGuestCount(guestHistory().length); }, []);
  useEffect(() => {
    let active = true;
    setProfileReady(false); setAvatar(""); setName(""); setMessage(""); setError("");
    if (!user) return;
    async function load() {
      const { data, error: failure } = await supabase.from("profiles").select("*").eq("id", user?.id ?? "").single();
      if (!active) return;
      if (failure) { setError("Could not load your profile. Please try again."); return; }
      setName(data.display_name); setProfileReady(true);
      if (data.avatar_path) {
        const { data: image } = await supabase.storage.from("avatars").createSignedUrl(data.avatar_path, 3600);
        if (active) setAvatar(image?.signedUrl ?? "");
      }
    }
    void load(); return () => { active = false; };
  }, [user?.id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("Check your email for a password reset link.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setMessage(data.session ? "Account created." : "Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setPassword("");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in. Try again."); }
    finally { setBusy(false); }
  }
  async function social(provider: "google" | "lovable") {
    setError("");
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` });
    if (result.error) setError(result.error.message);
  }
  async function saveProfile(file?: File) {
    if (!user || !profileReady) return;
    setBusy(true); setError(""); setMessage("");
    try {
      let path: string | undefined;
      if (file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
        if (file.size > 2 * 1024 * 1024) throw new Error("Choose a photo smaller than 2 MB.");
        path = `${user.id}/${crypto.randomUUID()}`;
        const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
        if (error) throw error;
      }
      const { error } = await supabase.from("profiles").update({ display_name: name.trim(), updated_at: new Date().toISOString(), ...(path ? { avatar_path: path } : {}) }).eq("id", user.id);
      if (error) throw error;
      if (path) {
        const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
        setAvatar(data?.signedUrl ?? "");
      }
      setMessage("Profile saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your profile."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    await queryClient.cancelQueries(); queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { setError(error.message); setBusy(false); return; }
    setHistoryOwner(null);
    await navigate({ to: "/auth", replace: true }); setBusy(false);
  }
  return <div className="rage min-h-dvh bg-background text-foreground">
    <main className="mx-auto max-w-md px-5 pb-10">
      <header className="flex items-center gap-3 py-5"><Button variant="ghost" size="icon" asChild aria-label="Back home"><Link to="/"><ArrowLeft /></Link></Button><span className="font-impact text-2xl">RAGE<span className="text-primary">BIT</span></span></header>
      <div className="hazard mb-6 h-2 w-20" />
      <h1 className="font-impact text-4xl uppercase">{user ? "Your corner" : "Keep your gains"}</h1>
      {!ready ? <p className="mt-6 text-muted-foreground">Loading account…</p> : user ? <>
        <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
        <div className="my-6 flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-sm border-2 border-primary bg-card">{avatar ? <img src={avatar} alt="Your avatar" className="size-full object-cover" /> : <UserRound className="size-9 text-primary" />}</div>
          <div><label className="cursor-pointer text-sm font-bold text-primary" htmlFor="avatar"><Upload className="mr-2 inline size-4" />Change photo</label><input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy || !profileReady} onChange={(e) => { const file = e.target.files?.[0]; if (file) void saveProfile(file); e.target.value = ""; }} /><p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP · max 2 MB</p></div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void saveProfile(); }} className="space-y-3"><label htmlFor="display-name" className="text-xs font-bold uppercase">Display name</label><Input id="display-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} disabled={!profileReady} /><Button className="w-full" disabled={busy || !profileReady}>Save profile</Button></form>
        <section className="my-6 border-y border-border py-5"><div className="flex items-center gap-2 font-bold"><Cloud className="size-5 text-primary" />{sync === "syncing" ? "Syncing workouts…" : sync === "error" ? "Workouts waiting to sync" : "Workout history synced"}</div>{sync === "error" && <Button variant="outline" className="mt-3" onClick={retry}><RefreshCw />Retry sync</Button>}
          {guestCount > 0 && <div className="mt-4"><p className="text-sm text-muted-foreground">{guestCount} guest workouts on this device.</p><Button variant="outline" className="mt-2" onClick={() => { for (const w of guestHistory()) saveWorkout(w); setMessage("Guest workouts added to your sync queue. Originals stay on this device."); }}><Upload />Import guest workouts</Button></div>}
        </section><Button variant="outline" className="w-full" disabled={busy} onClick={() => void signOut()}><LogOut />Sign out</Button>
      </> : <>
        <p className="mt-2 text-sm text-muted-foreground">Your profile. Your workouts. Any device.</p>
        <div className="my-6 flex gap-2"><Button variant={mode === "login" ? "default" : "outline"} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Sign in</Button><Button variant={mode === "signup" ? "default" : "outline"} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Create account</Button></div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && <div><label htmlFor="name" className="text-xs font-bold uppercase">Display name</label><Input id="name" autoComplete="nickname" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="mt-2" /></div>}
          <div><label htmlFor="email" className="text-xs font-bold uppercase">Email</label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" /></div>
          {mode !== "forgot" && <div><label htmlFor="password" className="text-xs font-bold uppercase">Password</label><Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" /></div>}
          <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</Button>
        </form>
        <Button variant="link" className="px-0" onClick={() => { setMode("forgot"); setMessage(""); setError(""); }}>Forgot password?</Button>
        <div className="my-4 border-t border-border pt-5 space-y-3"><Button variant="outline" className="w-full" onClick={() => void social("google")}>Continue with Google</Button><Button type="button" className="lovable-auth-button w-full" onClick={() => void social("lovable")}>Continue with Lovable</Button></div>
        <Button variant="ghost" asChild className="w-full"><Link to="/">Continue without an account</Link></Button>
      </>}
      {message && <p role="status" className="mt-4 text-sm text-secondary">{message}</p>}{error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </main>
  </div>;
}