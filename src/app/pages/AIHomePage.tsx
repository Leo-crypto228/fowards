import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Plus, Trash2, MessageSquare, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getConversations,
  getQuotaStatus,
  deleteConversation,
  type AiConversation,
  type QuotaStatus,
} from "../api/aiApi";
import { QuotaBar } from "../components/QuotaBar";
import { toast } from "sonner";

export function AIHomePage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const token = session?.access_token ?? "";

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [convs, q] = await Promise.all([
        getConversations(token),
        getQuotaStatus(token),
      ]);
      setConversations(convs);
      setQuota(q);
    } catch (err) {
      console.error("[AIHomePage] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteConversation(token, id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      toast("Conversation supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `il y a ${diffMin}min`;
    if (diffH < 24) return `il y a ${diffH}h`;
    if (diffD === 1) return "Hier";
    if (diffD < 7) return `il y a ${diffD} jours`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#050510", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 0",
        position: "sticky",
        top: 0,
        background: "#050510",
        zIndex: 10,
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        paddingBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles style={{ width: 18, height: 18, color: "#fff" }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>Fowards IA</h1>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(235,235,245,0.45)" }}>Coach business personnel</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => navigate("/ai/new")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 36, paddingLeft: 14, paddingRight: 14,
              borderRadius: 10, border: "none",
              background: "#4f46e5", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Nouveau
          </motion.button>
        </div>

        {/* Quota bar */}
        {quota && <QuotaBar quota={quota} />}
      </div>

      {/* Content */}
      <div style={{ padding: "16px 20px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "2.5px solid rgba(99,102,241,0.18)",
              borderTop: "2.5px solid #6366f1",
              animation: "spin 0.7s linear infinite",
            }} />
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState onStart={() => navigate("/ai/new")} />
        ) : (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(235,235,245,0.35)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
              Conversations
            </p>
            <AnimatePresence>
              {conversations.map((conv, i) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ marginBottom: 8 }}
                >
                  <div
                    onClick={() => navigate(`/ai/${conv.id}`)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 14,
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "rgba(99,102,241,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <MessageSquare style={{ width: 16, height: 16, color: "#818cf8" }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: 14, fontWeight: 600,
                        color: "rgba(235,235,245,0.92)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {conv.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: "rgba(235,235,245,0.4)", marginTop: 2 }}>
                        {formatDate(conv.last_message_at)}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <motion.button
                        whileTap={{ scale: 0.82 }}
                        onClick={(e) => handleDelete(conv.id, e)}
                        disabled={deletingId === conv.id}
                        style={{
                          width: 30, height: 30, borderRadius: 8,
                          border: "none", background: "transparent",
                          color: "rgba(235,235,245,0.25)",
                          cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          opacity: deletingId === conv.id ? 0.4 : 1,
                        }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </motion.button>
                      <ChevronRight style={{ width: 16, height: 16, color: "rgba(235,235,245,0.25)" }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        textAlign: "center", paddingTop: 60,
      }}
    >
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.2))",
        border: "1px solid rgba(124,58,237,0.3)",
        margin: "0 auto 20px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32,
      }}>
        ✨
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
        Ton coach business
      </h2>
      <p style={{ fontSize: 14, color: "rgba(235,235,245,0.5)", marginBottom: 24, lineHeight: 1.6, maxWidth: 280, margin: "0 auto 24px" }}>
        Diagnostic, acquisition, pricing, mindset… Parle à Fowards IA comme à un advisor Y Combinator.
      </p>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={onStart}
        style={{
          height: 48, paddingLeft: 28, paddingRight: 28,
          borderRadius: 14, border: "none",
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          color: "#fff", fontSize: 15, fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Commencer
      </motion.button>
    </motion.div>
  );
}
