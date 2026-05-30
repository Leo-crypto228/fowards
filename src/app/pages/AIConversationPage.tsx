import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getConversation,
  sendMessageStream,
  type AiMessage,
  type QuotaStatus,
  type ChatMode,
  type ChoicesBlock,
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

  const locationState = location.state as { initialMessage?: string; initialMode?: ChatMode } | null;

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(
    isNew ? undefined : conversationId,
  );

  // V6 — choices (boutons Phase 1)
  const [currentChoices, setCurrentChoices] = useState<ChoicesBlock | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());

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
    setCurrentChoices(null);
    setMultiSelected(new Set());

    const tempUserId = `temp-${Date.now()}`;
    const streamingAiId = `a-${Date.now() + 1}`;

    const tempUserMsg: AiMessage = {
      id: tempUserId, role: "user", content: text, mode,
      fowards_data: null, created_at: new Date().toISOString(),
    };
    const typingMsg: AiMessage = {
      id: "typing", role: "assistant", content: "…", mode,
      fowards_data: null, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg, typingMsg]);

    try {
      const response = await sendMessageStream(token, {
        conversationId: activeConvId,
        message: text,
        mode,
      }, (partialText) => {
        setMessages((prev) => {
          if (!prev.some((m) => m.id === streamingAiId)) {
            return [
              ...prev.filter((m) => m.id !== "typing"),
              { id: streamingAiId, role: "assistant" as const, content: partialText, mode, fowards_data: null, created_at: new Date().toISOString() },
            ];
          }
          return prev.map((m) => m.id === streamingAiId ? { ...m, content: partialText } : m);
        });
      });

      // Finaliser avec contenu propre
      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== "typing" && m.id !== tempUserId);
        return base.map((m) =>
          m.id === streamingAiId
            ? { ...m, content: response.message, fowards_data: response.forwardsData ?? null }
            : m,
        );
      });

      setQuota(response.quota);

      if (response.choices) {
        setCurrentChoices(response.choices);
        setMultiSelected(new Set());
      }

      if (response.isPhase1JustCompleted) {
        toast("Profil créé ! Le Diagnostic est maintenant disponible.", {
          duration: 4000,
          style: {
            background: "rgba(99,102,241,0.15)",
            border: "0.5px solid rgba(99,102,241,0.35)",
            color: "rgba(235,235,245,0.92)",
          },
        });
      }

      if (!activeConvId) {
        setActiveConvId(response.conversationId);
        window.history.replaceState(null, "", `/ai/${response.conversationId}`);
      }
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== "typing" && m.id !== tempUserId && m.id !== streamingAiId));
      const error = err as Error & { quotaExceeded?: boolean; quota?: QuotaStatus };
      toast.error(error.message ?? "Erreur lors de l'envoi", { duration: 4000 });
      if (error.quota) setQuota(error.quota);
    } finally {
      setSending(false);
    }
  }

  // Clic sur un choix "single"
  function handleSingleChoice(choice: string, mode: ChatMode) {
    handleSend(choice, mode);
  }

  // Toggle d'une option "multi"
  function toggleMultiChoice(choice: string) {
    setMultiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(choice)) next.delete(choice);
      else next.add(choice);
      return next;
    });
  }

  // Valider la sélection multi
  function handleMultiValidate(mode: ChatMode) {
    if (multiSelected.size === 0) return;
    const combined = [...multiSelected].join(", ");
    handleSend(combined, mode);
  }

  // Bouton "Autre" → ouvre la barre de saisie
  function handleOtherChoice() {
    setCurrentChoices(null);
  }

  const isPhase1Complete = quota?.isPhase1Complete ?? true;
  const canDiagnostic = isPhase1Complete && (!quota || quota.canSendDiagnostic);
  const inputDisabled = sending || (!!quota && !quota.canSendNormal && !quota.canSendDiagnostic);

  // Mode courant de la conv (pour envoyer les choix dans le bon mode)
  const currentMode: ChatMode = messages.length > 0
    ? (messages[messages.length - 1].mode ?? "normal")
    : (locationState?.initialMode ?? "normal");

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

      {/* Zone basse — boutons Phase 1 OU input */}
      <div style={{ flexShrink: 0 }}>

        {/* Boutons de choix Phase 1 */}
        <AnimatePresence>
          {currentChoices && !sending && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              style={{
                padding: "8px 16px 4px",
                borderTop: "0.5px solid rgba(255,255,255,0.06)",
                background: "#000",
              }}
            >
              {currentChoices.type === "single" ? (
                /* Single choice — boutons */
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {currentChoices.choices.map((choice) => (
                    <motion.button
                      key={choice}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (choice === "Autre" || choice === "Personnaliser") {
                          handleOtherChoice();
                        } else {
                          handleSingleChoice(choice, currentMode);
                        }
                      }}
                      style={{
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 10,
                        border: "0.5px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.05)",
                        color: "rgba(235,235,245,0.88)",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        textAlign: "left",
                        padding: "0 14px",
                        transition: "background 0.12s",
                      }}
                    >
                      {choice}
                    </motion.button>
                  ))}
                </div>
              ) : (
                /* Multi choice — toggle + valider */
                <div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                    {currentChoices.choices.map((choice) => {
                      const isSelected = multiSelected.has(choice);
                      return (
                        <motion.button
                          key={choice}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            if (choice === "Autre" || choice === "Personnaliser") {
                              if (multiSelected.size > 0) {
                                handleMultiValidate(currentMode);
                              } else {
                                handleOtherChoice();
                              }
                            } else {
                              toggleMultiChoice(choice);
                            }
                          }}
                          style={{
                            width: "100%",
                            minHeight: 44,
                            borderRadius: 10,
                            border: `0.5px solid ${isSelected ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.18)"}`,
                            background: isSelected ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                            color: isSelected ? "rgba(235,235,245,0.95)" : "rgba(235,235,245,0.7)",
                            fontSize: 14,
                            fontWeight: isSelected ? 600 : 400,
                            cursor: "pointer",
                            textAlign: "left",
                            padding: "0 14px",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            transition: "all 0.12s",
                          }}
                        >
                          <span style={{
                            width: 18, height: 18,
                            borderRadius: 5,
                            border: `1.5px solid ${isSelected ? "rgba(99,102,241,0.8)" : "rgba(255,255,255,0.25)"}`,
                            background: isSelected ? "rgba(99,102,241,0.6)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            fontSize: 10, color: "#fff",
                            transition: "all 0.12s",
                          }}>
                            {isSelected ? "✓" : ""}
                          </span>
                          {choice}
                        </motion.button>
                      );
                    })}
                  </div>
                  {multiSelected.size > 0 && (
                    <motion.button
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleMultiValidate(currentMode)}
                      style={{
                        width: "100%",
                        height: 44,
                        borderRadius: 10,
                        border: "none",
                        background: "rgba(255,255,255,0.9)",
                        color: "#000",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                        marginBottom: 6,
                      }}
                    >
                      Valider ({multiSelected.size} sélectionné{multiSelected.size > 1 ? "s" : ""})
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input texte — caché quand des choix sont affichés */}
        {!currentChoices && (
          <ChatInput
            onSend={handleSend}
            disabled={inputDisabled}
            canDiagnostic={canDiagnostic}
          />
        )}
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
