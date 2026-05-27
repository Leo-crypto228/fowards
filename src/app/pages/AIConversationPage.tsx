import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getConversation,
  sendMessage,
  type AiMessage,
  type AiConversation,
  type QuotaStatus,
  type ChatMode,
} from "../api/aiApi";
import { MessageBubble } from "../components/MessageBubble";
import { ChatInput } from "../components/ChatInput";
import { QuotaBar } from "../components/QuotaBar";
import { toast } from "sonner";

export function AIConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const isNew = !conversationId || conversationId === "new";

  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [sending, setSending] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(
    isNew ? undefined : conversationId,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Load existing conversation
  useEffect(() => {
    if (isNew || !conversationId || !token) return;
    setLoading(true);
    getConversation(token, conversationId)
      .then(({ conversation: conv, messages: msgs }) => {
        setConversation(conv);
        setMessages(msgs);
        setActiveConvId(conv.id);
        scrollToBottom(false);
      })
      .catch((err) => {
        console.error("[AIConversationPage] load error:", err);
        toast.error("Erreur lors du chargement");
        navigate("/ai");
      })
      .finally(() => setLoading(false));
  }, [conversationId, token, isNew, navigate, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function handleSend(text: string, mode: ChatMode) {
    if (sending) return;
    setSending(true);

    // Optimistic user message
    const tempUserMsg: AiMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      mode,
      fowards_data: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // Typing indicator
    const tempAiMsg: AiMessage = {
      id: "typing",
      role: "assistant",
      content: "…",
      mode,
      fowards_data: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    try {
      const response = await sendMessage(token, {
        conversationId: activeConvId,
        message: text,
        mode,
      });

      // Replace optimistic messages with real ones
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== "typing" && m.id !== tempUserMsg.id);
        return [
          ...withoutTemp,
          {
            id: `user-${Date.now()}`,
            role: "user" as const,
            content: text,
            mode,
            fowards_data: null,
            created_at: new Date().toISOString(),
          },
          {
            id: `ai-${Date.now()}`,
            role: "assistant" as const,
            content: response.message,
            mode: response.mode,
            fowards_data: response.forwardsData,
            created_at: new Date().toISOString(),
          },
        ];
      });

      setQuota(response.quota);

      // Update conversation ID if new
      if (!activeConvId) {
        setActiveConvId(response.conversationId);
        // Replace URL without navigation (no re-render)
        window.history.replaceState(null, "", `/ai/${response.conversationId}`);
      }
    } catch (err: unknown) {
      // Remove optimistic messages
      setMessages((prev) => prev.filter((m) => m.id !== "typing" && m.id !== tempUserMsg.id));

      const error = err as Error & { quotaExceeded?: boolean; quota?: QuotaStatus };
      if (error.quotaExceeded) {
        toast.error(error.message, { duration: 5000 });
        if (error.quota) setQuota(error.quota);
      } else {
        toast.error(error.message ?? "Erreur lors de l'envoi");
      }
    } finally {
      setSending(false);
    }
  }

  const canDiagnostic = !quota || quota.canSendDiagnostic;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100dvh - env(safe-area-inset-top, 0px))",
      background: "#050510",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px",
        borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        background: "#050510",
        flexShrink: 0,
      }}>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => navigate("/ai")}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "0.5px solid rgba(255,255,255,0.12)",
            background: "transparent", color: "rgba(235,235,245,0.7)",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </motion.button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 14,
          }}>
            ✨
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 700,
              color: "#fff",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {isNew ? "Nouveau coaching" : (conversation?.title ?? "Fowards IA")}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(235,235,245,0.4)" }}>
              {sending ? "En train de répondre…" : "Coach business IA"}
            </p>
          </div>
        </div>

        {quota && (
          <QuotaBar quota={quota} compact />
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 16px 8px",
        WebkitOverflowScrolling: "touch",
      } as React.CSSProperties}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <Loader2 style={{ width: 24, height: 24, color: "#6366f1", animation: "spin 1s linear infinite" }} />
          </div>
        ) : messages.length === 0 ? (
          <WelcomeHint />
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {msg.id === "typing" ? (
                  <TypingIndicator />
                ) : (
                  <MessageBubble message={msg} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0 }}>
        <ChatInput
          onSend={handleSend}
          disabled={sending || (!quota ? false : !quota.canSendNormal && !quota.canSendDiagnostic)}
          canDiagnostic={canDiagnostic}
        />
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 2, fontSize: 14,
      }}>
        ✨
      </div>
      <div style={{
        background: "rgba(255,255,255,0.06)",
        borderRadius: "4px 18px 18px 18px",
        padding: "12px 16px",
        border: "0.5px solid rgba(255,255,255,0.10)",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8" }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  );
}

function WelcomeHint() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        textAlign: "center",
        paddingTop: 40,
        paddingBottom: 20,
        color: "rgba(235,235,245,0.45)",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
      <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 260, margin: "0 auto" }}>
        Dis <strong style={{ color: "rgba(235,235,245,0.7)" }}>GO</strong> pour commencer, ou pose directement ta question.
      </p>
    </motion.div>
  );
}
