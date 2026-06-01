import { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import mascot from "figma:asset/cd3b49eafdee7adc585eb4cea8cc18850443b810.png";
import { useAuth } from "../context/AuthContext";
import { upsertProfile } from "../api/profileApi";
import {
  sendMessageStream,
  completePhase1,
  type AiMessage,
  type QuotaStatus,
  type ChoicesBlock,
} from "../api/aiApi";
import { MessageBubble } from "../components/MessageBubble";
import { ChatInput, type ChatInputHandle } from "../components/ChatInput";
import { toast } from "sonner";

// ── Design tokens ─────────────────────────────────────────────────────────────
const GRAD = "linear-gradient(120deg, #a86bff 0%, #8a6bff 55%, #7287ff 100%)";

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
  const [phase1Complete, setPhase1Complete] = useState(false);
  const [validating, setValidating] = useState(false);

  const isDesktop = useIsDesktop();

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const hasTriggeredRef   = useRef(false);
  const typingKeyRef      = useRef(0);   // compteur pour générer des keys uniques au typing indicator
  const chatInputRef      = useRef<ChatInputHandle>(null); // ref pour focus iOS (UX-04)
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

    const streamingId = `a-${Date.now()}`;
    const typingId = `typing-${++typingKeyRef.current}`;
    setMessages([{ id: typingId, role: "assistant", content: "…", mode: "normal", fowards_data: null, created_at: new Date().toISOString() }]);

    try {
      console.log("[OnboardingIA] Déclenchement Phase 1 (streaming)…");
      const response = await sendMessageStream(tok, {
        message: "Bonjour",
        mode: "normal",
        is_onboarding_trigger: true,
      }, (partialText) => {
        setMessages((prev) => {
          if (!prev.some((m) => m.id === streamingId)) {
            // Premier chunk — remplacer le typing indicator
            return [{ id: streamingId, role: "assistant" as const, content: partialText, mode: "normal", fowards_data: null, created_at: new Date().toISOString() }];
          }
          return prev.map((m) => m.id === streamingId ? { ...m, content: partialText } : m);
        });
      });

      console.log("[OnboardingIA] Phase 1 réponse reçue, convId=", response.conversationId);

      // Finaliser avec le contenu nettoyé (sans les blocs XML)
      setMessages([{
        id: streamingId, role: "assistant" as const,
        content: response.message, mode: response.mode,
        fowards_data: response.forwardsData,
        created_at: new Date().toISOString(),
      }]);

      setActiveConvId(response.conversationId);
      setQuota(response.quota);

      // Phase 1 déjà complète (session précédente interrompue) → afficher le bouton
      if (response.quota.isPhase1Complete) {
        setPhase1Complete(true);
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

    // BUG-03 : nonce aléatoire pour éviter les collisions d'ID (ex: StrictMode double-fire)
    const msgNonce = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
    const tempUserId = `temp-${msgNonce}`;
    const streamingAiId = `a-${msgNonce}`;
    const typingId = `typing-${++typingKeyRef.current}`;

    const tempUser: AiMessage = {
      id: tempUserId, role: "user", content: text, mode: "normal",
      fowards_data: null, created_at: new Date().toISOString(),
    };
    const typingMsg: AiMessage = {
      id: typingId, role: "assistant", content: "…", mode: "normal",
      fowards_data: null, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser, typingMsg]);

    try {
      const response = await sendMessageStream(token, {
        conversationId: activeConvId,
        message: text,
        mode: "normal",
        is_onboarding_trigger: true,
      }, (partialText) => {
        setMessages((prev) => {
          if (!prev.some((m) => m.id === streamingAiId)) {
            // Premier chunk — remplacer le typing indicator
            return [
              ...prev.filter((m) => m.id !== typingId),
              { id: streamingAiId, role: "assistant" as const, content: partialText, mode: "normal", fowards_data: null, created_at: new Date().toISOString() },
            ];
          }
          return prev.map((m) => m.id === streamingAiId ? { ...m, content: partialText } : m);
        });
      });

      // Finaliser : contenu nettoyé + remplacer message temp user
      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== typingId && m.id !== tempUserId);
        return base.map((m) =>
          m.id === streamingAiId
            ? { ...m, content: response.message, fowards_data: response.forwardsData ?? null }
            : m,
        );
      });

      setQuota(response.quota);
      if (!activeConvId) setActiveConvId(response.conversationId);

      if (response.choices) {
        setCurrentChoices(response.choices);
        setMultiSelected(new Set());
      }

      // Phase 1 terminée → afficher le bouton de validation
      if (response.isPhase1JustCompleted || response.quota.isPhase1Complete) {
        setCurrentChoices(null);
        setPhase1Complete(true);
      }
    } catch (err: unknown) {
      // On retire le typing indicator et l'éventuel début de stream, mais on GARDE
      // le message utilisateur (tempUserId) pour qu'il puisse le relire et réessayer (UX-03)
      setMessages((prev) => prev.filter((m) => m.id !== typingId && m.id !== streamingAiId));
      const error = err as Error & { quota?: QuotaStatus };
      toast.error(error.message ?? "Erreur lors de l'envoi");
      if (error.quota) setQuota(error.quota);
    } finally {
      setSending(false);
    }
  }

  // ── Valider le récap et rejoindre Fowards ────────────────────────────────────

  async function handleValidate() {
    if (validating) return;
    setValidating(true);

    // 1. État local EN PREMIER (protège contre race condition background-refresh)
    updateLocalUser({ onboarding_complete: true, onboarding_step: "done", onboardingDone: true });

    // 2. Filet de sécurité — garantit is_phase1_complete = true en DB même si
    //    Gemini n'a pas émis le bloc <profile-update> (timeout 3s max pour ne pas bloquer)
    try {
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000),
      );
      await Promise.race([completePhase1(token), timeout]);
      console.log("[OnboardingIA] completePhase1 OK");
    } catch (e) {
      // Non bloquant — on navigue quand même (le flag sera corrigé à la prochaine session)
      console.warn("[OnboardingIA] completePhase1 warning:", e);
    }

    // 3. Navigation vers la page IA
    navigate("/ai", { replace: true });

    // 4. KV en fire-and-forget
    if (user?.username) {
      upsertProfile(user.username, { onboardingComplete: true, onboardingStep: "done" })
        .catch((e) => console.error("[OnboardingIA] handleValidate KV error:", e));
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

  // Détecte "Autre / Personnaliser" indépendamment de la casse ou des variantes
  function isCustomChoice(choice: string): boolean {
    const c = choice.toLowerCase().trim();
    return (
      c === "autre" ||
      c === "personnaliser" ||
      c.startsWith("autre ") ||
      c.startsWith("personnaliser") ||
      c === "other" ||
      c === "customize"
    );
  }

  function handleOtherChoice() {
    // flushSync force la mise à jour DOM de façon synchrone (dans le callstack du geste)
    // puis focus() est appelé immédiatement → iOS Safari ouvre bien le clavier (UX-04)
    flushSync(() => setCurrentChoices(null));
    chatInputRef.current?.focus();
  }

  // En onboarding : on ne bloque jamais sur le quota (is_onboarding_trigger bypass côté serveur)
  const inputDisabled = sending;

  // Le bouton "Accéder à Fowards" apparaît dès que :
  //   a) le serveur confirme Phase 1 complete (isPhase1JustCompleted ou quota.isPhase1Complete)
  //   b) OU l'IA a envoyé ≥ 15 messages (fallback si le bloc <profile-update> est manqué)
  // Le bouton ET l'input coexistent — l'user peut toujours écrire même quand le bouton est visible
  const aiMessageCount = messages.filter(
    (m) => m.role === "assistant" && !m.id.startsWith("typing-")
  ).length;
  const showValidateButton = phase1Complete || aiMessageCount >= 15;

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh",
      width: "100%",
      background: "#000",
      overflow: "hidden",
      position: "relative",
      ...(isDesktop ? {
        paddingLeft: "max(0px, calc(50vw - 368px))",
        paddingRight: "max(0px, calc(50vw - 440px))",
      } : {}),
    }}>

      {/* SVG filter — supprime le fond noir natif du PNG mascot (alpha = R+G+B-1) */}
      <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="conv-rm-black">
            <feColorMatrix type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 1 -1"/>
          </filter>
        </defs>
      </svg>

      {/* ── Header fixe ───────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: "env(safe-area-inset-top, 0px)", left: 0, right: 0, zIndex: 20,
        height: 52,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 16px",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(235,235,245,0.55)" }}>
          Configuration du profil IA
        </span>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        overflowY: "auto", overflowX: "hidden",
        position: "relative", zIndex: 1,
        WebkitOverflowScrolling: "touch",
        maskImage: "linear-gradient(to bottom, transparent, #000 22px)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22px)",
      } as React.CSSProperties}>
        <div style={isDesktop ? {
          maxWidth: 768, margin: "0 auto",
          padding: "calc(60px + env(safe-area-inset-top, 0px)) 32px 8px",
          display: "flex", flexDirection: "column", gap: 30,
        } : {
          padding: "calc(60px + env(safe-area-inset-top, 0px)) 18px 8px",
          display: "flex", flexDirection: "column",
        }}>
        {messages.length === 0 && !sending && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            {triggerError ? (
              <div style={{ padding: "0 24px" }}>
                <p style={{
                  fontSize: 14, color: "rgba(239,68,68,0.75)",
                  marginBottom: 16, lineHeight: 1.5,
                }}>
                  {triggerError}
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
              {msg.id.startsWith("typing-") ? <TypingIndicator /> : <MessageBubble message={msg} />}
            </motion.div>
          ))}
        </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>{/* end inner responsive div */}
      </div>

      {/* ── Zone basse ────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        {/* Boutons choix Phase 1 — masqués quand le bouton de validation est visible */}
        <AnimatePresence>
          {currentChoices && !sending && !showValidateButton && (
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
                        if (isCustomChoice(choice)) handleOtherChoice();
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
                            if (isCustomChoice(choice)) {
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

        {/* Bouton "Accéder à Fowards" — pill compact, coin droit, juste au-dessus de l'input */}
        <AnimatePresence>
          {showValidateButton && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "6px 14px 4px",
                background: "#000",
              }}
            >
              <motion.button
                whileTap={validating ? {} : { scale: 0.93 }}
                onClick={handleValidate}
                disabled={validating}
                style={{
                  padding: "11px 22px",
                  borderRadius: 999,
                  border: "none",
                  background: validating ? "rgba(255,255,255,0.55)" : "#fff",
                  color: "#000",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: validating ? "default" : "pointer",
                  letterSpacing: "-0.01em",
                  boxShadow: "0 2px 20px rgba(255,255,255,0.18)",
                  whiteSpace: "nowrap",
                  transition: "background 0.15s",
                }}
              >
                {validating ? "Un instant…" : "Accéder à Fowards →"}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input texte — visible quand pas de choix en cours OU quand le bouton de validation est affiché */}
        {(!currentChoices || showValidateButton) && (
          <ChatInput
            ref={chatInputRef}
            onSend={handleSend}
            disabled={inputDisabled}
            canDiagnostic={false}
            showModeButtons={false}
          />
        )}
      </div>

    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

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
            style={{ width: 8, height: 8, borderRadius: 999, background: GRAD }}
          />
        ))}
      </div>
    </div>
  );
}
