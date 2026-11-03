import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const DISMISS_KEY = "ragebit-install-dismissed";

/** "Add to home screen" card; hidden once installed, dismissed, or opened from the icon. */
export function InstallCard() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const inFrame = window.self !== window.top;
    if (standalone || inFrame || localStorage.getItem(DISMISS_KEY)) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setShow(true);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setShow(false);
  }

  return (
    <section className="relative rounded-sm border-2 border-primary bg-card p-4">
      <button onClick={dismiss} aria-label="Hide install tip" className="absolute right-2 top-2 p-1 text-muted-foreground active:text-foreground">
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <img src="/icon-192.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-sm border border-border" />
        <div className="min-w-0">
          <p className="font-impact text-xl uppercase leading-tight">Put RageBit on your home screen</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Opens full-screen like a real app — no address bar, more room for the camera.
          </p>
        </div>
      </div>
      {prompt ? (
        <Button onClick={install} className="mt-3 h-12 w-full rounded-sm border-2 border-primary font-black uppercase tracking-wider active:translate-y-0.5">
          <Download /> Install app
        </Button>
      ) : (
        <p className="mt-3 flex items-center gap-2 rounded-sm bg-muted px-3 py-2 font-mono text-xs font-bold uppercase tracking-wide">
          <Smartphone className="size-4 shrink-0 text-primary" />
          {ios ? "Tap Share, then “Add to Home Screen”" : "Open the browser menu ⋮, then “Add to Home screen”"}
        </p>
      )}
    </section>
  );
}
