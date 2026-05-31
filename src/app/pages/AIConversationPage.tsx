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
import mascot from "figma:asset/cd3b49eafdee7adc585eb4cea8cc18850443b810.png";

// ── Design tokens ──────────────────────────────────────────────────────────────
const GRAD = "linear-gradient(120deg, #a86bff 0%, #8a6bff 55%, #7287ff 100%)";

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

// ── Desktop media hook ─────────────────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

// ── Round button ───────────────────────────────────────────────────────────────
function RoundBtn({
  children, onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      style={{
        width: 42, height: 42, borderRadius: 999, flexShrink: 0,
        border: "1px solid rgba(165,125,255,0.22)",
        background: "rgba(150,110,255,0.12)",
        cursor: "pointer", padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff",
      }}
    >
      {children}
    </motion.button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
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
  const autoSentRef    = useRef(false);
  const typingKeyRef   = useRef(0);   // compteur pour générer des keys uniques au typing indicator

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

    // BUG-03 : nonce aléatoire pour éviter les collisions d'ID (ex: StrictMode double-fire)
    const msgNonce = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
    const tempUserId = `temp-${msgNonce}`;
    const streamingAiId = `a-${msgNonce}`;
    const typingId = `typing-${++typingKeyRef.current}`;

    const tempUserMsg: AiMessage = {
      id: tempUserId, role: "user", content: text, mode,
      fowards_data: null, created_at: new Date().toISOString(),
    };
    const typingMsg: AiMessage = {
      id: typingId, role: "assistant", content: "…", mode,
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
              ...prev.filter((m) => m.id !== typingId),
              { id: streamingAiId, role: "assistant" as const, content: partialText, mode, fowards_data: null, created_at: new Date().toISOString() },
            ];
          }
          return prev.map((m) => m.id === streamingAiId ? { ...m, content: partialText } : m);
        });
      });

      // Finaliser avec contenu propre — on retire uniquement le typing indicator,
      // le message utilisateur (tempUserId) reste dans la conversation
      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== typingId);
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
            background: "rgba(168,107,255,0.15)",
            border: "0.5px solid rgba(168,107,255,0.35)",
            color: "rgba(235,235,245,0.92)",
          },
        });
      }

      if (!activeConvId) {
        setActiveConvId(response.conversationId);
        window.history.replaceState(null, "", `/ai/${response.conversationId}`);
      }
    } catch (err: unknown) {
      // On retire le typing indicator et l'éventuel début de stream, mais on GARDE
      // le message utilisateur (tempUserId) pour qu'il puisse le relire et réessayer (UX-03)
      setMessages((prev) => prev.filter((m) => m.id !== typingId && m.id !== streamingAiId));
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

  const isDesktop = useIsDesktop();

  return (
    <div style={{
      height: "100dvh",
      display: "flex", flexDirection: "column",
      background: "#000000",
      overflow: "hidden",
      position: "relative",
      ...(isDesktop ? {
        paddingLeft: "max(0px, calc(50vw - 368px))",
        paddingRight: "max(0px, calc(50vw - 440px))",
      } : {}),
    }}>
      {/* Halos — mobile uniquement, fond noir plat sur desktop */}
      {!isDesktop && <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background:
          "radial-gradient(120% 80% at 78% -8%, rgba(160,100,255,0.42) 0%, transparent 52%), " +
          "radial-gradient(110% 70% at 8% 6%, rgba(118,120,255,0.30) 0%, transparent 48%)",
      }}/>}
      {/* Grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.5,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "4px 4px", mixBlendMode: "overlay" as const,
      }}/>

      {/* SVG filter — supprime le fond noir natif du PNG mascot (alpha = R+G+B-1) */}
      <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="conv-rm-black">
            <feColorMatrix type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 1 -1"/>
          </filter>
        </defs>
      </svg>

      {/* ── TopBar ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 10px",
      }}>
        {/* Back → /ai */}
        <RoundBtn onClick={() => navigate("/ai")}>
          <ArrowLeft style={{ width: 18, height: 18 }}/>
        </RoundBtn>

        {/* Centre */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: 0.1 }}>Fowards</span>
          <span style={{ fontSize: 18, fontWeight: 400, color: "rgba(233,233,245,0.55)" }}>IA</span>
        </div>

        {/* Robot → profil IA */}
        <RoundBtn onClick={() => navigate("/ai/profile")}>
          <RobotIcon size={20}/>
        </RoundBtn>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative", zIndex: 1,
          WebkitOverflowScrolling: "touch",
          maskImage: "linear-gradient(to bottom, transparent, #000 22px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22px)",
        } as React.CSSProperties}
      >
        <div style={isDesktop ? {
          maxWidth: 768, margin: "0 auto",
          padding: "14px 32px 8px",
          display: "flex", flexDirection: "column", gap: 30,
        } : {
          padding: "8px 18px 4px", display: "flex", flexDirection: "column",
        }}>
          {messages.length === 0 && !sending && (
            <div style={{
              textAlign: "center", paddingTop: 80,
              color: "rgba(235,235,245,0.22)", fontSize: 14,
            }}>
              En attente de réponse…
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {msg.id.startsWith("typing-") ? (
                  <TypingIndicator />
                ) : (
                  <MessageBubble message={msg} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Zone basse — boutons Phase 1 OU input ──────────────────────────── */}
      <div style={{ flexShrink: 0, position: "relative", zIndex: 10 }}>
        {/* Sur desktop : centré dans une colonne max-width 768px */}
        <div style={isDesktop ? { maxWidth: 768, margin: "0 auto" } : {}}>

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
              }}
            >
              {currentChoices.type === "single" ? (
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
                        borderRadius: 12,
                        border: "1px solid rgba(165,125,255,0.22)",
                        background: "rgba(150,110,255,0.08)",
                        color: "rgba(235,235,245,0.88)",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        textAlign: "left",
                        padding: "0 16px",
                        transition: "background 0.12s",
                      }}
                    >
                      {choice}
                    </motion.button>
                  ))}
                </div>
              ) : (
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
                            borderRadius: 12,
                            border: `1px solid ${isSelected ? "rgba(168,107,255,0.60)" : "rgba(165,125,255,0.22)"}`,
                            background: isSelected ? "rgba(168,107,255,0.15)" : "rgba(150,110,255,0.08)",
                            color: isSelected ? "rgba(235,235,245,0.95)" : "rgba(235,235,245,0.7)",
                            fontSize: 14,
                            fontWeight: isSelected ? 600 : 400,
                            cursor: "pointer",
                            textAlign: "left",
                            padding: "0 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            transition: "all 0.12s",
                          }}
                        >
                          <span style={{
                            width: 18, height: 18,
                            borderRadius: 5,
                            border: `1.5px solid ${isSelected ? "rgba(168,107,255,0.8)" : "rgba(255,255,255,0.25)"}`,
                            background: isSelected ? "rgba(168,107,255,0.6)" : "transparent",
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
                        borderRadius: 12,
                        border: "none",
                        background: GRAD,
                        color: "#0c0c12",
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
            onPhotoToast={(msg) => toast.error(msg)}
          />
        )}

        {/* Disclaimer — desktop uniquement */}
        {isDesktop && (
          <p style={{
            textAlign: "center", margin: "0 0 14px",
            fontSize: 12, color: "rgba(233,233,245,0.32)",
          }}>
            Fowards peut faire des erreurs. Vérifie les informations importantes.
          </p>
        )}

        </div>{/* fin du wrapper desktop */}
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, marginBottom: 22 }}>
      <img
        src={mascot}
        alt=""
        style={{
          width: 28, height: 28, flexShrink: 0,
          objectFit: "contain",
          filter: "url(#conv-rm-black) drop-shadow(0 0 8px rgba(160,100,255,0.65))",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {([0, 0.16, 0.32] as number[]).map((delay, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.1, delay, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 8, height: 8, borderRadius: 999,
              background: GRAD,
            }}
          />
        ))}
      </div>
    </div>
  );
}
