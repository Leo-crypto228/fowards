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

// ── Photo quota (localStorage) — 4 photos / 5 jours ──────────────────────────
const PHOTO_QUOTA_KEY = "ff_photo_quota";
const PHOTO_MAX = 4;
const PHOTO_PERIOD_MS = 5 * 24 * 60 * 60 * 1000;

function getPhotoQuota(): { count: number; since: number } {
  try {
    const raw = localStorage.getItem(PHOTO_QUOTA_KEY);
    if (!raw) return { count: 0, since: Date.now() };
    const q = JSON.parse(raw);
    if (Date.now() - q.since > PHOTO_PERIOD_MS) {
      const fresh = { count: 0, since: Date.now() };
      localStorage.setItem(PHOTO_QUOTA_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return q;
  } catch { return { count: 0, since: Date.now() }; }
}
function incrementPhotoQuota() {
  const q = getPhotoQuota();
  localStorage.setItem(PHOTO_QUOTA_KEY, JSON.stringify({ ...q, count: q.count + 1 }));
}

// ── Robot icon SVG ─────────────────────────────────────────────────────────────
function RobotIcon({ size = 18 }: { size?: number }) {
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
  const [photo,         setPhoto]         = useState<string | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPhoto(null);
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

  // ── Photo ─────────────────────────────────────────────────────────────────────
  function handlePlusClick() {
    const q = getPhotoQuota();
    if (q.count >= PHOTO_MAX) {
      const daysLeft = Math.ceil((PHOTO_PERIOD_MS - (Date.now() - q.since)) / (24 * 60 * 60 * 1000));
      toast.error(`Quota photo atteint (${PHOTO_MAX} / 5 jours). Revient dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}.`);
      return;
    }
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    const reader = new FileReader();
    reader.onload = () => { setPhoto(reader.result as string); incrementPhotoQuota(); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isPhase1Complete = quota?.isPhase1Complete ?? true;
  const canDiagnostic    = isPhase1Complete && (!quota || quota.canSendDiagnostic);
  const hasText          = text.trim().length > 0;
  const canSend          = hasText || !!photo;
  // Max 4 conversations affichées — pas de scroll sur la liste
  const hasConvs  = !loading && isPhase1Complete && conversations.length > 0;
  const shownConvs = conversations.slice(0, 4);

  function quotaLabel() {
    if (!quota) return null;
    if (!quota.canSendNormal) return "Quota atteint";
    return `${quota.normalRemaining} message${quota.normalRemaining > 1 ? "s" : ""} restant${quota.normalRemaining > 1 ? "s" : ""}`;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: "100dvh",
      background: "#0a0a10",
      display: "flex", flexDirection: "column",
      position: "relative",
      overflow: "hidden",   /* ← toute la page : jamais de scroll */
    }}>
      {/* SVG filter */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="ai-rm-black">
            <feColorMatrix type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 1 -1"/>
          </filter>
        </defs>
      </svg>

      {/* Halos background */}
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

      {/* ── Mini header : quota + robot ────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "calc(env(safe-area-inset-top, 0px) + 10px) 18px 4px",
      }}>
        {quota ? (
          <div style={{
            fontSize: 11.5, fontWeight: 500,
            color: "rgba(255,255,255,0.42)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999, padding: "4px 11px",
          }}>
            {quotaLabel()}
          </div>
        ) : <div/>}

        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => navigate("/ai/profile")}
          style={{
            width: 36, height: 36, borderRadius: 999, flexShrink: 0,
            border: "1px solid rgba(165,125,255,0.22)",
            background: "rgba(150,110,255,0.12)",
            cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
          }}
        >
          <RobotIcon size={18}/>
        </motion.button>
      </div>

      {/* ── Body — flex 1, NO scroll ────────────────────────────────────────── */}
      <div style={{
        flex: 1, position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
        overflow: "hidden",   /* ← jamais de scroll ici non plus */
      }}>
        {/* Hero */}
        <div style={{
          flex: hasConvs ? "0 0 auto" : 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center",
          padding: hasConvs ? "16px 22px 10px" : "0 22px 32px",
        }}>
          <motion.img
            src={mascot} alt=""
            animate={{ y: [0, -9, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            style={{
              width: hasConvs ? 52 : 96,
              height: "auto",
              filter: "url(#ai-rm-black) drop-shadow(0 0 14px rgba(160,100,255,0.7))",
              display: "block",
              transition: "width 0.35s",
            }}
          />
          <h1 style={{
            margin: "10px 0 0",
            fontSize: hasConvs ? 20 : 30,
            lineHeight: 1.18, fontWeight: 600,
            letterSpacing: -0.5, color: "#fff",
            transition: "font-size 0.3s",
          }}>
            Eyy, {username} !
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: hasConvs ? 13.5 : 16,
            lineHeight: 1.5, maxWidth: 260,
            background: GRAD,
            WebkitBackgroundClip: "text", backgroundClip: "text",
            color: "transparent",
          }}>
            Que veux-tu structurer ?
          </p>
        </div>

        {/* Conversations — max 4, pas de scroll */}
        {hasConvs && (
          <div style={{ padding: "0 18px 0", flex: 1, overflow: "hidden" }}>
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.22)",
              margin: "0 0 8px", fontWeight: 600, letterSpacing: 0.8,
            }}>CONVERSATIONS</p>
            {shownConvs.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/ai/${conv.id}`)}
                style={{
                  padding: "11px 0",
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
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 20, flexShrink: 0 }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.06)",
              borderTop: "2px solid rgba(255,255,255,0.35)",
              animation: "ai-spin 0.7s linear infinite",
            }}/>
          </div>
        )}

        {/* Dégradé de transition vers le dock noir ↓ */}
        <div style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: 90,
          background: "linear-gradient(to bottom, transparent 0%, #000 100%)",
          pointerEvents: "none",
          zIndex: 4,
        }}/>
      </div>

      {/* ── Dock (fond noir) ─────────────────────────────────────────────────── */}
      {/* paddingBottom = nav bar (56px) + home indicator + un peu d'air */}
      <div style={{
        position: "relative", zIndex: 10, flexShrink: 0,
        background: "#000",
        paddingBottom: "calc(56px + max(10px, env(safe-area-inset-bottom, 10px)))",
      }}>
        {/* Mode pills */}
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 10px" }}>
          {/*
            Inactif  : fond légèrement plus clair que la barre (#1c1c20)
            Actif    : même couleur que la barre (#1c1c20)
            Aucun violet.
          */}
          <button
            onClick={() => setMode("normal")}
            style={{
              flex: 1, height: 32, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${mode === "normal" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
              background: mode === "normal" ? "#1c1c20" : "rgba(255,255,255,0.05)",
              color: mode === "normal" ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.35)",
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
                  ? "rgba(255,255,255,0.04)"
                  : mode === "diagnostic"
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(255,255,255,0.07)"
              }`,
              background: (mode === "diagnostic" && isPhase1Complete && canDiagnostic)
                ? "#1c1c20"
                : "rgba(255,255,255,0.05)",
              color: (!isPhase1Complete || !canDiagnostic)
                ? "rgba(255,255,255,0.15)"
                : mode === "diagnostic"
                ? "rgba(255,255,255,0.80)"
                : "rgba(255,255,255,0.35)",
              fontSize: 12,
              fontWeight: (mode === "diagnostic" && isPhase1Complete) ? 600 : 400,
              cursor: (isPhase1Complete && canDiagnostic) ? "pointer" : "default",
              opacity: isPhase1Complete ? 1 : 0.40,
              transition: "all 0.15s",
            }}
          >Diagnostic</button>
        </div>

        {/* Composer */}
        <div style={{ padding: "0 16px" }}>
          <input
            ref={fileInputRef}
            type="file" accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div style={{
            borderRadius: 30, padding: "6px 6px 6px 8px",
            background: "#1c1c20",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {/* + / photo thumbnail */}
            {photo ? (
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src={photo} alt="" style={{
                  width: 42, height: 42, borderRadius: 12,
                  objectFit: "cover", display: "block",
                }}/>
                <button onClick={() => setPhoto(null)} style={{
                  position: "absolute", top: -5, right: -5,
                  width: 17, height: 17, borderRadius: "50%",
                  background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.20)",
                  color: "#fff", fontSize: 9, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  lineHeight: 1,
                }}>×</button>
              </div>
            ) : (
              <button onClick={handlePlusClick} style={{
                width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                border: "none", background: "transparent", cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(233,233,245,0.40)", fontSize: 24, lineHeight: 1,
              }}>+</button>
            )}

            {/* Input */}
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canSend) handleSend(); }}
              placeholder="Demander à Fowards"
              style={{
                flex: 1, minWidth: 0,
                background: "transparent", border: "none", outline: "none",
                color: "#fff", fontSize: 16.5, fontFamily: "inherit",
                padding: "4px 2px",
              }}
            />

            {/* Micro */}
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

            {/* Send violet — toujours visible */}
            <motion.button
              whileTap={canSend ? { scale: 0.88 } : {}}
              onClick={() => { if (canSend) handleSend(); }}
              style={{
                width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                border: "none", cursor: canSend ? "pointer" : "default", padding: 0,
                background: canSend ? GRAD : "rgba(168,107,255,0.20)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#0c0c12",
                opacity: canSend ? 1 : 0.55,
                transition: "opacity 0.2s, background 0.2s",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h13M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
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
