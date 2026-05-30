import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import {
  getConversations, getQuotaStatus, deleteConversation,
  type AiConversation, type QuotaStatus, type ChatMode,
} from "../api/aiApi";
import { toast } from "sonner";
import mascot from "figma:asset/cd3b49eafdee7adc585eb4cea8cc18850443b810.png";

// ── Design tokens ──────────────────────────────────────────────────────────────
const GRAD = "linear-gradient(120deg, #a86bff 0%, #8a6bff 55%, #7287ff 100%)";

const CHIPS: { label: string; hint: string }[] = [
  { label: "Structurer",  hint: "une idée" },
  { label: "Débloquer",   hint: "un blocage" },
  { label: "Planifier",   hint: "ma semaine" },
  { label: "Avancer",     hint: "sur un projet" },
];

// ── Robot icon SVG ─────────────────────────────────────────────────────────────
function RobotIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="3"/>
      <path d="M8 8V6a4 4 0 0 1 8 0v2"/>
      <circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M9 18h6"/>
    </svg>
  );
}

// ── Round button ───────────────────────────────────────────────────────────────
function RoundBtn({
  children, onClick, gradient = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  gradient?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      style={{
        width: 42, height: 42, borderRadius: 999, flexShrink: 0,
        border: gradient ? "none" : "1px solid rgba(165,125,255,0.22)",
        background: gradient ? GRAD : "rgba(150,110,255,0.12)",
        cursor: "pointer", padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: gradient ? "#0c0c12" : "#fff",
      }}
    >
      {children}
    </motion.button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function AIHomePage() {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const token    = session?.access_token ?? "";
  const username = user?.username || "toi";

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [quota,         setQuota]         = useState<QuotaStatus | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [text,          setText]          = useState("");
  const [mode,          setMode]          = useState<ChatMode>("normal");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Data load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!token) { setTimeout(() => setLoading(false), 6000); return; }
    try {
      const [convs, q] = await Promise.all([getConversations(token), getQuotaStatus(token)]);
      setConversations(convs);
      setQuota(q);
      if (!q.isPhase1Complete) setMode("normal");
    } catch (err) {
      console.error("[AIHomePage] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 10_000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleSend(txt?: string) {
    const trimmed = (txt ?? text).trim();
    if (!trimmed) return;
    navigate("/ai/new", { state: { initialMessage: trimmed, initialMode: mode } });
  }

  async function handleDeleteConv(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteConversation(token, id);
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────
  const isPhase1Complete = quota?.isPhase1Complete ?? true;
  const canDiagnostic    = isPhase1Complete && (!quota || quota.canSendDiagnostic);
  const hasText          = text.trim().length > 0;
  const hasConvs         = !loading && isPhase1Complete && conversations.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0a0a10",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      {/* SVG filter — remove black pixels from mascot */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="ai-rm-black">
            <feColorMatrix type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 1 -1"/>
          </filter>
        </defs>
      </svg>

      {/* Halos */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background:
          "radial-gradient(120% 80% at 78% -8%, rgba(160,100,255,0.42) 0%, transparent 52%), " +
          "radial-gradient(110% 70% at 8% 6%, rgba(118,120,255,0.30) 0%, transparent 48%)",
      }}/>
      {/* Grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.5,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "4px 4px", mixBlendMode: "overlay" as const,
      }}/>

      {/* ── TopBar ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 10px",
      }}>
        {/* Left spacer — no hamburger */}
        <div style={{ width: 42 }}/>

        {/* Center title */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: 0.1 }}>Fowards</span>
          <span style={{ fontSize: 18, fontWeight: 400, color: "rgba(233,233,245,0.55)" }}>IA</span>
        </div>

        {/* Robot → profil IA */}
        <RoundBtn onClick={() => navigate("/ai/profile")}>
          <RobotIcon size={20}/>
        </RoundBtn>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch" as any,
      }}>
        {/* Hero */}
        <div style={{
          flex: hasConvs ? "0 0 auto" : 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center",
          padding: hasConvs ? "16px 22px 12px" : "0 22px 40px",
        }}>
          <motion.img
            src={mascot}
            alt=""
            animate={{ y: [0, -9, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            style={{
              width: hasConvs ? 68 : 132,
              height: "auto",
              filter: "url(#ai-rm-black) drop-shadow(0 0 14px rgba(160,100,255,0.7))",
              display: "block",
              transition: "width 0.35s",
            }}
          />
          <h1 style={{
            margin: hasConvs ? "12px 0 0" : "24px 0 0",
            fontSize: hasConvs ? 22 : 33,
            lineHeight: 1.18, fontWeight: 600,
            letterSpacing: -0.5, color: "#fff",
            transition: "font-size 0.3s",
          }}>
            Eyy, {username} !
          </h1>
          <p style={{
            margin: "10px 0 0",
            fontSize: hasConvs ? 14 : 16.5,
            lineHeight: 1.5, maxWidth: 260,
            background: GRAD,
            WebkitBackgroundClip: "text", backgroundClip: "text",
            color: "transparent",
          }}>
            Que veux-tu structurer ?
          </p>
        </div>

        {/* Conversation history */}
        {hasConvs && (
          <div style={{ padding: "0 18px 12px", flex: 1 }}>
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.22)",
              margin: "0 0 10px", fontWeight: 600, letterSpacing: 0.8,
            }}>CONVERSATIONS</p>
            {conversations.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/ai/${conv.id}`)}
                style={{
                  padding: "13px 0",
                  borderBottom: "0.5px solid rgba(255,255,255,0.07)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span style={{
                  fontSize: 14, color: "rgba(235,235,245,0.7)", fontWeight: 500,
                  flex: 1, marginRight: 12,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {conv.title || `Discussion ${conversations.length - i}`}
                </span>
                <button
                  onClick={(e) => handleDeleteConv(conv.id, e)}
                  style={{
                    background: "transparent", border: "none",
                    color: "rgba(235,235,245,0.20)", cursor: "pointer",
                    fontSize: 18, padding: "0 4px", lineHeight: 1, flexShrink: 0,
                  }}
                >×</button>
              </motion.div>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 24 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.06)",
              borderTop: "2px solid rgba(255,255,255,0.35)",
              animation: "ai-spin 0.7s linear infinite",
            }}/>
          </div>
        )}
      </div>

      {/* ── Dock ─────────────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10, flexShrink: 0,
        paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
      }}>
        {/* Chips — visible seulement sans conversations */}
        {!hasConvs && !loading && (
          <div style={{
            display: "flex", gap: 9,
            overflowX: "auto", padding: "0 16px 12px",
            scrollbarWidth: "none" as const,
          } as React.CSSProperties}>
            {CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleSend(`${chip.label} ${chip.hint}`)}
                style={{
                  flexShrink: 0,
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                  gap: 2, padding: "10px 15px", borderRadius: 16, cursor: "pointer",
                  background: "#1c1c20", border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "#fff" }}>{chip.label}</span>
                <span style={{ fontSize: 12.5, color: "rgba(233,233,245,0.55)" }}>{chip.hint}</span>
              </button>
            ))}
          </div>
        )}

        {/* Mode pills */}
        <div style={{ display: "flex", gap: 8, padding: "0 16px 10px" }}>
          <button
            onClick={() => setMode("normal")}
            style={{
              flex: 1, height: 32, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${mode === "normal" ? "rgba(168,107,255,0.60)" : "rgba(255,255,255,0.08)"}`,
              background: mode === "normal" ? "rgba(168,107,255,0.10)" : "transparent",
              color: mode === "normal" ? "rgba(235,235,245,0.90)" : "rgba(255,255,255,0.28)",
              fontSize: 12, fontWeight: mode === "normal" ? 600 : 400,
              transition: "all 0.15s",
            }}
          >Discussion</button>
          <button
            onClick={() => { if (isPhase1Complete && canDiagnostic) setMode("diagnostic"); }}
            disabled={!isPhase1Complete || !canDiagnostic}
            style={{
              flex: 1, height: 32, borderRadius: 999,
              border: `1px solid ${
                (!isPhase1Complete || !canDiagnostic)
                  ? "rgba(255,255,255,0.05)"
                  : mode === "diagnostic"
                  ? "rgba(168,107,255,0.60)"
                  : "rgba(255,255,255,0.08)"
              }`,
              background: (mode === "diagnostic" && isPhase1Complete && canDiagnostic)
                ? "rgba(168,107,255,0.10)" : "transparent",
              color: (!isPhase1Complete || !canDiagnostic)
                ? "rgba(255,255,255,0.14)"
                : mode === "diagnostic"
                ? "rgba(235,235,245,0.90)"
                : "rgba(255,255,255,0.28)",
              fontSize: 12, fontWeight: (mode === "diagnostic" && isPhase1Complete) ? 600 : 400,
              cursor: (isPhase1Complete && canDiagnostic) ? "pointer" : "default",
              opacity: isPhase1Complete ? 1 : 0.45,
              transition: "all 0.15s",
            }}
          >Diagnostic</button>
        </div>

        {/* Composer */}
        <div style={{ padding: "0 16px" }}>
          <div style={{
            borderRadius: 30, padding: "6px 6px 6px 8px",
            background: "#1c1c20",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {/* + decorative */}
            <button style={{
              width: 42, height: 42, borderRadius: 999, flexShrink: 0,
              border: "none", background: "transparent", cursor: "default", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(233,233,245,0.40)", fontSize: 22,
            }}>+</button>

            {/* Input */}
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && hasText) handleSend(); }}
              placeholder="Demander à Fowards"
              style={{
                flex: 1, minWidth: 0,
                background: "transparent", border: "none", outline: "none",
                color: "#fff", fontSize: 16.5, fontFamily: "inherit",
                padding: "4px 2px",
              }}
            />

            {/* Right — send OR mic+wave */}
            {hasText ? (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => handleSend()}
                style={{
                  width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                  border: "none", cursor: "pointer", padding: 0,
                  background: GRAD,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#0c0c12",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h13M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.button>
            ) : (
              <>
                {/* Mic */}
                <button style={{
                  width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                  border: "none", background: "transparent", cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(233,233,245,0.55)",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <rect x="9" y="3" width="6" height="11" rx="3"/>
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>
                  </svg>
                </button>
                {/* Waveform gradient */}
                <button style={{
                  width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                  border: "none", background: GRAD, cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 10v4M9 6v12M15 8v8M20 11v2"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ai-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
