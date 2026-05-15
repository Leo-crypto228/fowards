import { useState, useEffect } from "react";
import { X, Share, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  shouldShowInstallTuto,
  markInstallTutoShown,
  detectBrowser,
  type BrowserType,
} from "../utils/installTutoSchedule";

const STEP_STYLE = { display: "flex" as const, alignItems: "center" as const, gap: 8 };
const NUM_STYLE = {
  fontSize: 11, fontWeight: 700, color: "#fff",
  background: "rgba(255,255,255,0.15)", borderRadius: 99,
  width: 18, height: 18, display: "flex" as const,
  alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0,
};
const LBL = { fontSize: 12, color: "rgba(255,255,255,0.6)" };
const B = { color: "#fff" };
const IC = { display: "inline" as const, verticalAlign: "middle" as const, marginBottom: 1 };

export function InstallTutoSteps({ browser }: { browser: BrowserType }) {
  // Firefox: no PWA but can add shortcut
  if (browser === "firefox") return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LBL}>Appuie sur <MoreHorizontal size={13} style={IC} color="#fff" /> <strong style={B}>en bas de Firefox</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LBL}>Choisis <strong style={B}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LBL}>Puis <strong style={B}>"Sur l'écran d'accueil"</strong></span>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 10, color: "rgba(255,255,255,0.30)", lineHeight: 1.4 }}>
        ⚠️ Firefox ne supporte pas les notifications push — utilise Safari pour les activer.
      </p>
    </>
  );

  if (browser === "opera") return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LBL}>Appuie sur <Share size={13} style={IC} color="#fff" /> <strong style={B}>en bas d'Opera</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LBL}>Choisis <strong style={B}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LBL}>Puis <strong style={B}>"En voir plus"</strong> → <strong style={B}>"Sur l'écran d'accueil"</strong></span>
      </div>
    </>
  );

  if (browser === "brave") return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LBL}>Appuie sur <Share size={13} style={IC} color="#fff" /> <strong style={B}>en bas de Brave</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LBL}>Choisis <strong style={B}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LBL}>Puis <strong style={B}>"En voir plus"</strong> → <strong style={B}>"Sur l'écran d'accueil"</strong></span>
      </div>
    </>
  );

  if (browser === "safari") return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LBL}>Appuie sur <MoreHorizontal size={13} style={IC} color="#fff" /> <strong style={B}>en haut de Safari</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LBL}>Choisis <strong style={B}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LBL}>Puis <strong style={B}>"En voir plus"</strong> → <strong style={B}>"Sur l'écran d'accueil"</strong></span>
      </div>
    </>
  );

  if (browser === "chrome") return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LBL}>Appuie sur <Share size={13} style={IC} color="#fff" /> <strong style={B}>en haut de Chrome</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LBL}>Choisis <strong style={B}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LBL}>Puis <strong style={B}>"En voir plus"</strong> → <strong style={B}>"Sur l'écran d'accueil"</strong></span>
      </div>
    </>
  );

  // google
  return (
    <>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>1</span>
        <span style={LBL}>Appuie sur <Share size={13} style={IC} color="#fff" /> <strong style={B}>en haut de Google</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>2</span>
        <span style={LBL}>Choisis <strong style={B}>"Partager"</strong></span>
      </div>
      <div style={STEP_STYLE}>
        <span style={NUM_STYLE}>3</span>
        <span style={LBL}>Puis <strong style={B}>"En voir plus"</strong> → <strong style={B}>"Sur l'écran d'accueil"</strong></span>
      </div>
    </>
  );
}

export function IOSInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [browser, setBrowser] = useState<BrowserType>("safari");

  useEffect(() => {
    if (!shouldShowInstallTuto()) return;
    setBrowser(detectBrowser());
    markInstallTutoShown();
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

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
            left: 16, right: 16, zIndex: 9999,
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
            onClick={() => setVisible(false)}
            style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X size={16} color="rgba(255,255,255,0.45)" />
          </button>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <img src="/apple-touch-icon.png" alt="Fowards"
              style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                Installe Fowards sur ton iPhone
              </p>
              <div style={{ margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 5 }}>
                <InstallTutoSteps browser={browser} />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
