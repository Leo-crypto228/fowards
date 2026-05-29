import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { upsertProfile } from "../api/profileApi";
import {
  sendMessage,
  type AiMessage,
  type QuotaStatus,
  type ChoicesBlock,
} from "../api/aiApi";
import { MessageBubble } from "../components/MessageBubble";
import { ChatInput } from "../components/ChatInput";
import { toast } from "sonner";

// ── OnboardingIAPage ──────────────────────────────────────────────────────────
// Page dédiée à la configuration du profil IA (Phase 1).
// - Pas de bouton retour, pas de bottom nav.
// - Déclenche automatiquement la Phase 1 à l'arrivée.
// - Bouton "Passer" : dialog de confirmation → marque onboarding_complete + nav /ai.
// - Quand Phase 1 terminée : marque onboarding_complete + nav /ai.

export function OnboardingIAPage() {
  const navigate = useNavigate();
  const { session, user, updateLocalUser } = useAuth();
  const token = session?.access_token ?? "";

  const [messages, setMessages]           = useState<AiMessage[]>([]);
  const [quota, setQuota]                 = useState<QuotaStatus | null>(null);
  const [sending, setSending]             = useState(false);
  const [activeConvId, setActiveConvId]   = useState<string | undefined>(undefined);
  const [currentChoices, setCurrentChoices] = useState<ChoicesBlock | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [skipping, setSkipping]           = useState(false);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const hasTriggeredRef   = useRef(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // ── Auto-trigger Phase 1 dès que le token est disponible ─────────────────────
  // hasTriggeredRef évite le double-fire React StrictMode.
  // Si l'appel échoue, triggerPhase1() le remet à false → retry possible.

  useEffect(() => {
    if (!token || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    triggerPhase1();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function triggerPhase1(currentToken?: string) {
    const tok = currentToken ?? token;
    if (!tok) {
      console.warn("[OnboardingIA] triggerPhase1 appelé sans token, abandon");
      hasTriggeredRef.current = false;
      return;
    }

    setTriggerError(null);
    setSending(true);

    const typingMsg: AiMessage = {
      id: "typing", role: "assistant", content: "…", mode: "normal",
      fowards_data: null, created_at: new Date().toISOString(),
    };
    setMessages([typingMsg]);

    try {
      console.log("[OnboardingIA] Déclenchement Phase 1…");
      const response = await sendMessage(tok, {
        message: "Bonjour",
        mode: "normal",
        is_onboarding_trigger: true,
      });
      console.log("[OnboardingIA] Phase 1 réponse reçue, convId=", response.conversationId);

      setMessages([{
        id: `a-${Date.now()}`, role: "assistant" as const,
        content: response.message, mode: response.mode,
        fowards_data: response.forwardsData,
        created_at: new Date().toISOString(),
      }]);

      setActiveConvId(response.conversationId);
      setQuota(response.quota);

      // Phase 1 déjà complète (session précédente interrompue)
      if (response.quota.isPhase1Complete) {
        await completeOnboarding();
        return;
      }

      if (response.choices) {
        setCurrentChoices(response.choices);
        setMultiSelected(new Set());
      }
    } catch (err: unknown) {
      setMessages([]);
      hasTriggeredRef.current = false; // Permet retry
      const error = err as Error;
      const msg = error.message ?? "Impossible de contacter l'IA";
      console.error("[OnboardingIA] triggerPhase1 erreur:", msg);
      setTriggerError(msg);
    } finally {
      setSending(false);
    }
  }

  function handleRetry() {
    if (sending) return;
    hasTriggeredRef.current = false;
    setTriggerError(null);
    triggerPhase1();
  }

  // ── Envoi de message ──────────────────────────────────────────────────────────

  async function handleSend(text: string) {
    if (sending) return;
    setSending(true);
    setCurrentChoices(null);
    setMultiSelected(new Set());

    const tempUser: AiMessage = {
      id: `temp-${Date.now()}`, role: "user", content: text, mode: "normal",
      fowards_data: null, created_at: new Date().toISOString(),
    };
    const typingMsg: AiMessage = {
      id: "typing", role: "assistant", content: "…", mode: "normal",
      fowards_data: null, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser, typingMsg]);

    try {
      const response = await sendMessage(token, {
        conversationId: activeConvId,
        message: text,
        mode: "normal",
      });

      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== "typing" && m.id !== tempUser.id);
        return [
          ...base,
          { id: `u-${Date.now()}`, role: "user" as const, content: text, mode: "normal", fowards_data: null, created_at: new Date().toISOString() },
          { id: `a-${Date.now()}`, role: "assistant" as const, content: response.message, mode: response.mode, fowards_data: response.forwardsData, created_at: new Date(Date.now() + 1).toISOString() },
        ];
      });

      setQuota(response.quota);

      if (!activeConvId) setActiveConvId(response.conversationId);

      if (response.choices) {
        setCurrentChoices(response.choices);
        setMultiSelected(new Set());
      }

      // Phase 1 terminée → onboarding_complete
      if (response.isPhase1JustCompleted) {
        await completeOnboarding();
      }
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== "typing" && m.id !== tempUser.id));
      const error = err as Error & { quota?: QuotaStatus };
      toast.error(error.message ?? "Erreur lors de l'envoi");
      if (error.quota) setQuota(error.quota);
    } finally {
      setSending(false);
    }
  }

  // ── Marquer onboarding_complete = true + navigate ─────────────────────────────

  async function completeOnboarding() {
    console.log("[OnboardingIA] Phase 1 terminée → SET onboardingComplete=true dans KV");
    try {
      if (user?.username) {
        await upsertProfile(user.username, { onboardingComplete: true, onboardingStep: "done" });
        console.log("[OnboardingIA] onboardingComplete=true KV OK");
      }
    } catch (e) {
      console.error("[OnboardingIA] completeOnboarding exception:", e);
    }

    updateLocalUser({ onboarding_complete: true, onboarding_step: "done" });

    toast("Profil IA créé ! Bienvenue sur Fowards 🎉", {
      duration: 4000,
      style: {
        background: "rgba(99,102,241,0.15)",
        border: "0.5px solid rgba(99,102,241,0.35)",
        color: "rgba(235,235,245,0.92)",
      },
    });

    setTimeout(() => navigate("/ai", { replace: true }), 1500);
  }

  // ── "Passer" : passer Phase 1 (sans profil IA complet) ───────────────────────

  async function handleSkip() {
    setSkipping(true);
    try {
      if (user?.username) {
        await upsertProfile(user.username, { onboardingComplete: true, onboardingStep: "done" });
      }
      updateLocalUser({ onboarding_complete: true, onboarding_step: "done" });
    } catch (e) {
      console.error("[OnboardingIA] skip error:", e);
    } finally {
      setSkipping(false);
      navigate("/ai", { replace: true });
    }
  }

  // ── Choix Phase 1 ─────────────────────────────────────────────────────────────

  function handleSingleChoice(choice: string) {
    handleSend(choice);
  }

  function toggleMultiChoice(choice: string) {
    setMultiSelected((prev) => {
      const next = new Set(prev);
      next.has(choice) ? next.delete(choice) : next.add(choice);
      return next;
    });
  }

  function handleMultiValidate() {
    if (multiSelected.size === 0) return;
    handleSend([...multiSelected].join(", "));
  }

  function handleOtherChoice() {
    setCurrentChoices(null);
  }

  const inputDisabled = sending || (!!quota && !quota.canSendNormal);

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh",
      paddingTop: "env(safe-area-inset-top, 0px)",
      background: "#000",
      position: "relative",
    }}>

      {/* ── Header fixe ───────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(235,235,245,0.55)" }}>
          Configuration du profil IA
        </span>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => setShowSkipDialog(true)}
          style={{
            background: "transparent", border: "none",
            color: "rgba(235,235,245,0.35)", fontSize: 14,
            cursor: "pointer", padding: "6px 0",
          }}
        >
          Passer
        </motion.button>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "60px 16px 8px",
        WebkitOverflowScrolling: "touch",
      } as React.CSSProperties}>
        {messages.length === 0 && !sending && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            {triggerError ? (
              <div style={{ padding: "0 24px" }}>
                <p style={{
                  fontSize: 14, color: "rgba(239,68,68,0.75)",
                  marginBottom: 16, lineHeight: 1.5,
                }}>
                  Connexion à l'IA échouée.{"\n"}Vérifie ta connexion internet.
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRetry}
                  style={{
                    padding: "10px 24px", borderRadius: 10, border: "none",
                    background: "rgba(255,255,255,0.9)", color: "#000",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Réessayer
                </motion.button>
              </div>
            ) : (
              <div style={{ color: "rgba(235,235,245,0.25)", fontSize: 14 }}>
                {token ? "Connexion à l'IA…" : "Chargement de la session…"}
              </div>
            )}
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
              {msg.id === "typing" ? <TypingIndicator /> : <MessageBubble message={msg} />}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* ── Zone basse ────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {/* Boutons choix Phase 1 */}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {currentChoices.choices.map((choice) => (
                    <motion.button
                      key={choice}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (choice === "Autre" || choice === "Personnaliser") handleOtherChoice();
                        else handleSingleChoice(choice);
                      }}
                      style={{
                        width: "100%", minHeight: 44, borderRadius: 10,
                        border: "0.5px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.05)",
                        color: "rgba(235,235,245,0.88)", fontSize: 14, fontWeight: 500,
                        cursor: "pointer", textAlign: "left", padding: "0 14px",
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
                              multiSelected.size > 0 ? handleMultiValidate() : handleOtherChoice();
                            } else {
                              toggleMultiChoice(choice);
                            }
                          }}
                          style={{
                            width: "100%", minHeight: 44, borderRadius: 10,
                            border: `0.5px solid ${isSelected ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.18)"}`,
                            background: isSelected ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                            color: isSelected ? "rgba(235,235,245,0.95)" : "rgba(235,235,245,0.7)",
                            fontSize: 14, fontWeight: isSelected ? 600 : 400,
                            cursor: "pointer", textAlign: "left", padding: "0 14px",
                            display: "flex", alignItems: "center", gap: 8,
                            transition: "all 0.12s",
                          }}
                        >
                          <span style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: `1.5px solid ${isSelected ? "rgba(99,102,241,0.8)" : "rgba(255,255,255,0.25)"}`,
                            background: isSelected ? "rgba(99,102,241,0.6)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, color: "#fff", transition: "all 0.12s",
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
                      onClick={handleMultiValidate}
                      style={{
                        width: "100%", height: 44, borderRadius: 10, border: "none",
                        background: "rgba(255,255,255,0.9)", color: "#000",
                        fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 6,
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

        {/* Input texte */}
        {!currentChoices && (
          <ChatInput
            onSend={(text) => handleSend(text)}
            disabled={inputDisabled}
            canDiagnostic={false}
          />
        )}
      </div>

      {/* ── Dialog "Passer" ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSkipDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.7)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              padding: "0 16px",
            }}
            onClick={() => setShowSkipDialog(false)}
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 480,
                background: "rgba(18,18,22,0.98)",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderRadius: "20px 20px 0 0",
                padding: "24px 20px",
                paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>
                Passer la configuration ?
              </h3>
              <p style={{ fontSize: 14, color: "rgba(235,235,245,0.45)", margin: "0 0 24px", lineHeight: 1.5 }}>
                Tu peux revenir plus tard dans "Mon Profil IA". Le profil IA te permet d'obtenir
                des diagnostics personnalisés — sans lui, les fonctionnalités avancées ne seront
                pas disponibles.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowSkipDialog(false)}
                  style={{
                    width: "100%", height: 48, borderRadius: 12,
                    border: "none", background: "rgba(255,255,255,0.9)",
                    color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Continuer la configuration
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSkip}
                  disabled={skipping}
                  style={{
                    width: "100%", height: 48, borderRadius: 12,
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    background: "transparent",
                    color: "rgba(255,255,255,0.4)", fontSize: 15, cursor: "pointer",
                    opacity: skipping ? 0.6 : 1,
                  }}
                >
                  {skipping ? "Redirection…" : "Passer pour l'instant"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

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
