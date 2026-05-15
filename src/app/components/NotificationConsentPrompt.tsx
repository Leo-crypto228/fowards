import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { registerPushSubscription, optOutPushNotifications } from "../utils/pushManager";

const ASKED_KEY = "ff:notif-consent-asked";

export function NotificationConsentPrompt({ username }: { username: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;

    // Déjà accordé au niveau navigateur → on s'abonne silencieusement
    if (Notification.permission === "granted") {
      registerPushSubscription(username).catch(() => {});
      return;
    }

    // Déjà refusé au niveau navigateur → rien à faire
    if (Notification.permission === "denied") return;

    // Déjà répondu à notre dialog → respecter le choix
    try {
      if (localStorage.getItem(ASKED_KEY)) return;
    } catch {}

    const t = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(t);
  }, [username]);

  const markAsked = () => {
    try { localStorage.setItem(ASKED_KEY, "1"); } catch {}
    setVisible(false);
  };

  const accept = () => {
    markAsked();
    registerPushSubscription(username).catch(() => {});
  };

  const decline = () => {
    markAsked();
    optOutPushNotifications(username).catch(() => {});
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            position: "fixed",
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            left: 16,
            right: 16,
            zIndex: 9998,
            background: "rgba(20,20,30,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "0.5px solid rgba(255,255,255,0.14)",
            borderRadius: 20,
            padding: "18px 18px 16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.60)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Bell size={20} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                Recevoir des notifications ?
              </p>
              <p style={{ margin: "5px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>
                Maximum <strong style={{ color: "rgba(255,255,255,0.85)" }}>une par jour</strong>,
                {" "}pour ce qui compte vraiment.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={decline}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 12,
                background: "rgba(255,255,255,0.08)", border: "none",
                color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Non merci
            </button>
            <button
              onClick={accept}
              style={{
                flex: 2, padding: "11px 0", borderRadius: 12,
                background: "#fff", border: "none",
                color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Oui, je veux
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
