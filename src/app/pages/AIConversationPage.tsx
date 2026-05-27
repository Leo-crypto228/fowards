import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getConversation,
  sendMessage,
  type AiMessage,
  type QuotaStatus,
  type ChatMode,
} from "../api/aiApi";
import { MessageBubble } from "../components/MessageBubble";
import { ChatInput } from "../components/ChatInput";
import { toast } from "sonner";

export function AIConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const isNew = !conversationId || conversationId === "new";

  // Initial message passed from home page
  const locationState = location.state as { initialMessage?: string; initialMode?: ChatMode } | null;

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(
    isNew ? undefined : conversationId,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Load existing conversation
  useEffect(() => {
    if (isNew || !conversationId || !token) return;
    getConversation(token, conversationId)
      .then(({ messages: msgs }) => {
        setMessages(msgs);
        setActiveConvId(conversationId);
        setTimeout(() => scrollToBottom(false), 50);
      })
      .catch(() => {
        toast.error("Conversation introuvable");
        navigate("/ai");
      });
  }, [conversationId, token, isNew, navigate, scrollToBottom]);

  // Auto-send initial message from home page (new conversation)
  useEffect(() => {
    if (!isNew || autoSentRef.current || !token || !locationState?.initialMessage) return;
    autoSentRef.current = true;
    handleSend(locationState.initialMessage, locationState.initialMode ?? "normal");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function handleSend(text: string, mode: ChatMode) {
    if (sending) return;
    setSending(true);

    const tempUserMsg: AiMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      mode,
      fowards_data: null,
      created_at: new Date().toISOString(),
    };
    const typingMsg: AiMessage = {
      id: "typing",
      role: "assistant",
      content: "…",
      mode,
      fowards_data: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg, typingMsg]);

    try {
      const response = await sendMessage(token, {
        conversationId: activeConvId,
        message: text,
        mode,
      });

      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== "typing" && m.id !== tempUserMsg.id);
        return [
          ...base,
          { id: `u-${Date.now()}`, role: "user" as const, content: text, mode, fowards_data: null, created_at: new Date().toISOString() },
          { id: `a-${Date.now()}`, role: "assistant" as const, content: response.message, mode: response.mode, fowards_data: response.forwardsData, created_at: new Date(Date.now() + 1).toISOString() },
        ];
      });

      setQuota(response.quota);

      if (!activeConvId) {
        setActiveConvId(response.conversationId);
        window.history.replaceState(null, "", `/ai/${response.conversationId}`);
      }
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== "typing" && m.id !== tempUserMsg.id));
      const error = err as Error & { quotaExceeded?: boolean; quota?: QuotaStatus };
      toast.error(error.message ?? "Erreur lors de l'envoi", { duration: 4000 });
      if (error.quota) setQuota(error.quota);
    } finally {
      setSending(false);
    }
  }

  const canDiagnostic = !quota || quota.canSendDiagnostic;
  const inputDisabled = sending || (!!quota && !quota.canSendNormal && !quota.canSendDiagnostic);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100dvh - env(safe-area-inset-top, 0px))",
      background: "#000",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Floating back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileTap={{ scale: 0.88 }}
        onClick={() => navigate("/ai")}
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 20,
          width: 36, height: 36,
          borderRadius: "50%",
          border: "0.5px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          color: "rgba(235,235,245,0.8)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <ArrowLeft style={{ width: 17, height: 17 }} />
      </motion.button>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "60px 16px 8px",
        WebkitOverflowScrolling: "touch",
      } as React.CSSProperties}>
        {messages.length === 0 && !sending && (
          <div style={{
            textAlign: "center", paddingTop: 80,
            color: "rgba(235,235,245,0.25)", fontSize: 14,
          }}>
            En attente de réponse…
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {msg.id === "typing" ? (
                <TypingIndicator />
              ) : (
                <MessageBubble message={msg} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0 }}>
        <ChatInput
          onSend={handleSend}
          disabled={inputDisabled}
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
        background: "rgba(255,255,255,0.08)",
        border: "0.5px solid rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 2,
        fontSize: 11, color: "rgba(235,235,245,0.7)", fontWeight: 700,
      }}>
        IA
      </div>
      <div style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: "4px 18px 18px 18px",
        padding: "12px 16px",
        border: "0.5px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(235,235,245,0.4)" }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  );
}
