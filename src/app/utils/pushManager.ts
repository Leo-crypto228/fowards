import { projectId, publicAnonKey } from "/utils/supabase/info";

// Clé publique VAPID — doit correspondre à VAPID_PUBLIC_KEY dans les secrets Supabase
const VAPID_PUBLIC_KEY = "BBTFfocDVrURyrKRV0zo71-5At3n8v5WZbzhVNCXNvmI-lXUctToL1wtQwz4F7wQ7aV_5KqxQ0DGYjWvpRF2BmY";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function registerPushSubscription(username: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Si déjà abonné, juste synchroniser avec le backend
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await syncSubscription(username, existing);
      return;
    }

    // Demander la permission (ne montrer le prompt qu'une fois)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await syncSubscription(username, subscription);
  } catch (err) {
    console.warn("Push subscription failed:", err);
  }
}

async function syncSubscription(username: string, subscription: PushSubscription): Promise<void> {
  await fetch(`${BASE}/push/subscribe`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ userId: username, subscription: subscription.toJSON() }),
  }).catch(() => {});
}
