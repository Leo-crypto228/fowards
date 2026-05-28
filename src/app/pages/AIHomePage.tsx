import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import {
  getConversations,
  getQuotaStatus,
  deleteConversation,
  type AiConversation,
  type QuotaStatus,
  type ChatMode,
} from "../api/aiApi";
import { toast } from "sonner";

export function AIHomePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token ?? "";

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Input state
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ChatMode>("normal");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [convs, q] = await Promise.all([
        getConversations(token),
        getQuotaStatus(token),
      ]);
      setConversations(convs);
      setQuota(q);
      // Si Phase 1 pas complète, forcer le mode normal
      if (!q.isPhase1Complete) setMode("normal");
    } catch (err) {
      console.error("[AIHomePage] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    navigate("/ai/new", { state: { initialMessage: trimmed, initialMode: mode } });
  }

  async function handleDeleteConv(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteConversation(token, id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  const isPhase1Complete = quota?.isPhase1Complete ?? true; // défaut true pour éviter flash
  const canDiagnostic = isPhase1Complete && (!quota || quota.canSendDiagnostic);

  return (
    <div style={{ minHeight: "100dvh", background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{
        flex: 1,
        padding: "24px 16px 16px",
        display: "flex",
        flexDirection: "column",
        maxWidth: 520,
        width: "100%",
        margin: "0 auto",
        alignSelf: "stretch",
      }}>

        {/* Top row — quota + profil */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          {quota && (
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ fontSize: 12, color: "rgba(235,235,245,0.35)" }}>
                Messages {quota.normalUsed}/{quota.normalLimit}
              </span>
              {isPhase1Complete && (
                <span style={{ fontSize: 12, color: "rgba(235,235,245,0.35)" }}>
                  Diagnostic {quota.diagnosticsUsed}/{quota.diagnosticsLimit}
                  {quota.diagnosticsUnlockedViaPost && (
                    <span style={{ marginLeft: 4 }}>🔓</span>
                  )}
                </span>
              )}
            </div>
          )}
          {/* Mon Profil IA */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => navigate("/ai/profile")}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "rgba(235,235,245,0.6)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
            }}
          >
            <span>👤</span>
            <span>Mon Profil IA</span>
          </motion.button>
        </div>

        {/* Bandeau Phase 1 — visible uniquement si profil incomplet */}
        {!loading && quota && !isPhase1Complete && (
          <div style={{
            background: "rgba(99,102,241,0.08)",
            border: "0.5px solid rgba(99,102,241,0.22)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>🎯</span>
            <span style={{ fontSize: 12, color: "rgba(235,235,245,0.55)", lineHeight: 1.4 }}>
              Réponds aux questions de l'IA pour débloquer le Diagnostic personnalisé.
            </span>
          </div>
        )}

        {/* Input box */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 14,
          border: "0.5px solid rgba(255,255,255,0.10)",
          padding: "12px 14px",
          marginBottom: 10,
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder='Écris "GO"'
            rows={1}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: "rgba(235,235,245,0.92)",
              fontSize: 15,
              lineHeight: 1.5,
              padding: 0,
              fontFamily: "inherit",
              minHeight: 36,
              maxHeight: 120,
              overflowY: "auto",
              display: "block",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleSend}
              disabled={!text.trim()}
              style={{
                width: 34, height: 34,
                borderRadius: "50%",
                border: "none",
                background: text.trim() ? "#fff" : "rgba(255,255,255,0.08)",
                color: text.trim() ? "#000" : "rgba(255,255,255,0.3)",
                fontSize: 16, fontWeight: 700,
                cursor: text.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
            >
              ↑
            </motion.button>
          </div>
        </div>

        {/* Mode buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          <button
            onClick={() => setMode("normal")}
            style={{
              flex: 1, height: 36, borderRadius: 8,
              border: `1px solid ${mode === "normal" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)"}`,
              background: mode === "normal" ? "rgba(255,255,255,0.10)" : "transparent",
              color: mode === "normal" ? "#fff" : "rgba(255,255,255,0.4)",
              fontSize: 13, fontWeight: mode === "normal" ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            Discussion normale
          </button>
          <button
            onClick={() => {
              if (!isPhase1Complete) {
                toast("Termine le profilage d'abord pour débloquer le Diagnostic.", {
                  icon: "🔒",
                  duration: 2500,
                });
                return;
              }
              if (canDiagnostic) setMode("diagnostic");
            }}
            style={{
              flex: 1, height: 36, borderRadius: 8,
              border: `1px solid ${mode === "diagnostic" && isPhase1Complete ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)"}`,
              background: mode === "diagnostic" && isPhase1Complete ? "rgba(255,255,255,0.10)" : "transparent",
              color: !isPhase1Complete ? "rgba(255,255,255,0.2)"
                : mode === "diagnostic" ? "#fff" : "rgba(255,255,255,0.4)",
              fontSize: 13, fontWeight: mode === "diagnostic" && isPhase1Complete ? 600 : 400,
              cursor: isPhase1Complete && canDiagnostic ? "pointer" : "not-allowed",
              opacity: isPhase1Complete ? 1 : 0.45,
              transition: "all 0.15s",
              position: "relative",
            } as React.CSSProperties}
          >
            {!isPhase1Complete ? "🔒 Diagnostic" : "Diagnostic"}
          </button>
        </div>

        {/* Conversation history — visible uniquement si Phase 1 complète */}
        {!loading && isPhase1Complete && conversations.length > 0 && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/ai/${conv.id}`)}
                style={{
                  padding: "13px 0",
                  borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 14, color: "rgba(235,235,245,0.75)", fontWeight: 500 }}>
                  Discussion {conversations.length - i}
                </span>
                <button
                  onClick={(e) => handleDeleteConv(conv.id, e)}
                  style={{
                    background: "transparent", border: "none",
                    color: "rgba(235,235,245,0.2)", cursor: "pointer",
                    fontSize: 16, padding: "0 4px",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 20 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.08)",
              borderTop: "2px solid rgba(255,255,255,0.4)",
              animation: "spin 0.7s linear infinite",
            }} />
          </div>
        )}

      </div>
    </div>
  );
}
