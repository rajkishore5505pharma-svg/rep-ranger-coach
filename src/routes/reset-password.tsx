import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset Password — RageBit" }, { name: "description", content: "Securely reset your RageBit account password." },
    { property: "og:title", content: "Reset Password — RageBit" }, { property: "og:description", content: "Choose a new password for your RageBit account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ResetPassword,
});
function ResetPassword() {
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => { setValid(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery" || new URLSearchParams(window.location.search).get("type") === "recovery"); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setBusy(true);
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (!user || sessionError) { setMessage("This reset link has expired. Request a new one."); setBusy(false); return; }
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : "Password updated."); setDone(!error); setBusy(false);
  }
  return <div className="rage min-h-dvh bg-background px-5 py-10 text-foreground"><main className="mx-auto max-w-md"><h1 className="font-impact text-4xl uppercase">Reset password</h1>{valid && !done ? <form onSubmit={submit} className="mt-6 space-y-4"><label htmlFor="new-password">New password</label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /><label htmlFor="confirm-password">Confirm password</label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /><Button disabled={busy} className="w-full">{busy ? "Saving…" : "Set new password"}</Button></form> : !done ? <p className="mt-5 text-muted-foreground">Open the password reset link from your email.</p> : null}{message && <p role="status" className="mt-4">{message}</p>}<Button asChild variant="outline" className="mt-6"><Link to="/auth">Back to account</Link></Button></main></div>;
}