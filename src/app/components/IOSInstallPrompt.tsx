import { useState, useEffect } from "react";
import { X, Share } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const DISMISSED_KEY = "ff:ios-prompt-dismissed";

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function IOSInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {}
    // Afficher après 3 secondes pour ne pas agresser l'utilisateur
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
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
            zIndex: 9999,
            background: "rgba(20,20,30,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "0.5px solid rgba(255,255,255,0.14)",
            borderRadius: 20,
            padding: "16px 16px 16px 18px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.60)",
          }}
        >
          <button
            onClick={dismiss}
            style={{
              position: "absolute", top: 12, right: 12,
              background: "none", border: "none", cursor: "pointer", padding: 4,
            }}
          >
            <X size={16} color="rgba(255,255,255,0.45)" />
          </button>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <img
              src="/apple-touch-icon.png"
              alt="Fowards"
              style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                Installe Fowards sur ton iPhone
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                Pour recevoir des notifications, appuie sur{" "}
                <Share size={13} style={{ display: "inline", verticalAlign: "middle", marginBottom: 1 }} color="rgba(255,255,255,0.75)" />
                {" "}puis <strong style={{ color: "rgba(255,255,255,0.85)" }}>"Sur l'écran d'accueil"</strong>
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
