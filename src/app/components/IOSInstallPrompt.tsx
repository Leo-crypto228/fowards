import { useState, useEffect } from "react";
import { X, Share, MoreHorizontal } from "lucide-react";
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

type BrowserType = "safari" | "chrome" | "google";

function detectBrowser(): BrowserType {
  const ua = navigator.userAgent;
  if (/GSA\//.test(ua)) return "google";   // Google app (GSA)
  if (/CriOS\//.test(ua)) return "chrome"; // Chrome for iOS
  return "safari";
}

const STEP_STYLE = {
  display: "flex" as const,
  alignItems: "center" as const,
  gap: 8,
};

const NUM_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  color: "#fff",
  background: "rgba(255,255,255,0.15)",
  borderRadius: 99,
  width: 18,
  height: 18,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexShrink: 0,
};

const LABEL_STYLE = { fontSize: 12, color: "rgba(255,255,255,0.6)" };
const STRONG = { color: "#fff" };
const ICON_STYLE = { display: "inline" as const, verticalAlign: "middle" as const, marginBottom: 1 };

function SafariSteps() {
  return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LABEL_STYLE}>
          Appuie sur <MoreHorizontal size={13} style={ICON_STYLE} color="#fff" />{" "}
          <strong style={STRONG}>en haut de Safari</strong>
        </span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LABEL_STYLE}>Choisis <strong style={STRONG}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LABEL_STYLE}>
          Puis <strong style={STRONG}>"En voir plus"</strong> → <strong style={STRONG}>"Sur l'écran d'accueil"</strong>
        </span>
      </div>
    </>
  );
}

function ChromeSteps() {
  return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LABEL_STYLE}>
          Appuie sur <Share size={13} style={ICON_STYLE} color="#fff" />{" "}
          <strong style={STRONG}>en haut de Chrome</strong>
        </span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LABEL_STYLE}>Choisis <strong style={STRONG}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LABEL_STYLE}>
          Puis <strong style={STRONG}>"En voir plus"</strong> → <strong style={STRONG}>"Sur l'écran d'accueil"</strong>
        </span>
      </div>
    </>
  );
}

function GoogleSteps() {
  return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LABEL_STYLE}>
          Appuie sur <Share size={13} style={ICON_STYLE} color="#fff" />{" "}
          <strong style={STRONG}>en haut de Google</strong>
        </span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LABEL_STYLE}>Choisis <strong style={STRONG}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LABEL_STYLE}>
          Puis <strong style={STRONG}>"En voir plus"</strong> → <strong style={STRONG}>"Sur l'écran d'accueil"</strong>
        </span>
      </div>
    </>
  );
}

export function IOSInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [browser, setBrowser] = useState<BrowserType>("safari");

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {}
    setBrowser(detectBrowser());
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
              <div style={{ margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 5 }}>
                {browser === "safari" && <SafariSteps />}
                {browser === "chrome" && <ChromeSteps />}
                {browser === "google" && <GoogleSteps />}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
