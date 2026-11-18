/** The only place the offline service worker is registered. Never in dev, preview or iframes. */
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;

function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  const h = window.location.hostname.toLowerCase();
  const label = h.split(".")[0];
  if (/\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(h) && (PREVIEW_LABEL.test(label) || /^project--.+-dev$/.test(label))) return true;
  return [/(^|\.)lovableproject\.com$/, /(^|\.)lovableproject-dev\.com$/, /(^|\.)beta\.lovable\.dev$/].some((r) => r.test(h));
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
    return;
  }
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}
