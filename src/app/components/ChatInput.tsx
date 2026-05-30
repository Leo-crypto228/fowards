import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { Mic, MicOff } from "lucide-react";
import type { ChatMode } from "../api/aiApi";

// ── Design tokens ──────────────────────────────────────────────────────────────
const GRAD = "linear-gradient(120deg, #a86bff 0%, #8a6bff 55%, #7287ff 100%)";

// ── Web Speech API — détection à la construction du module (pas dans le render)
// SpeechRecognition n'est pas dans les types TS standard → cast any
const SpeechRecognitionAPI: (new () => SpeechRecognitionInstance) | null =
  typeof window !== "undefined"
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
    : null;

// Type minimal pour éviter les any partout dans le composant
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number };
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onSend: (message: string, mode: ChatMode) => void;
  disabled?: boolean;
  canDiagnostic?: boolean;
  showModeButtons?: boolean;
}

export function ChatInput({ onSend, disabled = false, canDiagnostic = true, showModeButtons = true }: Props) {
  const [text, setText]               = useState("");
  const [mode, setMode]               = useState<ChatMode>("normal");
  const [isRecording, setIsRecording] = useState(false);

  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const recognitionRef   = useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef     = useRef(""); // texte confirmé (résultats isFinal)
  const displayedRef     = useRef(""); // miroir du text state — toujours à jour

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function resizeTextarea(target?: HTMLTextAreaElement | null) {
    const ta = target ?? textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  // Toujours passer par setTextSynced pour garder displayedRef à jour
  function setTextSynced(val: string) {
    displayedRef.current = val;
    setText(val);
  }

  // ── Envoi ─────────────────────────────────────────────────────────────────────
  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    // Couper l'enregistrement si actif
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
      setIsRecording(false);
      finalTextRef.current = "";
    }
    onSend(trimmed, mode);
    setTextSynced("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    finalTextRef.current = e.target.value;
    setTextSynced(e.target.value);
    resizeTextarea(e.target);
  }

  // ── Microphone ────────────────────────────────────────────────────────────────

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset complet — appelé depuis stopRecording ET les handlers onerror/onend
  const resetRecording = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;
    finalTextRef.current = "";
    setIsRecording(false);
  }, []);

  // Nettoyage du timeout également au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      recognitionRef.current?.abort();
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!SpeechRecognitionAPI || disabled) return;

    finalTextRef.current = text;

    const rec = new SpeechRecognitionAPI();
    rec.lang            = "fr-FR";
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const base = finalTextRef.current;
          finalTextRef.current = base ? base.trimEnd() + " " + t : t;
        } else {
          interim = t;
        }
      }
      const displayed = finalTextRef.current
        ? (interim ? finalTextRef.current.trimEnd() + " " + interim : finalTextRef.current)
        : interim;
      setTextSynced(displayed);
      resizeTextarea();
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech") console.warn("[Mic] erreur:", e.error);
      const toPreserve = finalTextRef.current || displayedRef.current;
      resetRecording();
      setTextSynced(toPreserve);
    };

    rec.onend = () => {
      const toPreserve = finalTextRef.current || displayedRef.current;
      resetRecording();
      setTextSynced(toPreserve);
      resizeTextarea();
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsRecording(true);
      timeoutRef.current = setTimeout(() => {
        console.warn("[Mic] timeout — aucun résultat en 10s");
        resetRecording();
      }, 10_000);
    } catch {
      recognitionRef.current = null;
    }
  }, [text, disabled, resetRecording]);

  function handleMicClick() {
    if (disabled) return;
    if (isRecording) {
      const toPreserve = finalTextRef.current || displayedRef.current;
      resetRecording();
      setTextSynced(toPreserve);
      resizeTextarea();
    } else {
      startRecording();
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  const hasMic = Boolean(SpeechRecognitionAPI);
  const hasText = text.trim().length > 0;

  return (
    <div style={{
      paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))",
    }}>
      {/* ── Boutons de mode ───────────────────────────────────────────────── */}
      {showModeButtons && (
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
          >
            Discussion
          </button>
          <button
            onClick={() => { if (canDiagnostic) setMode("diagnostic"); }}
            disabled={!canDiagnostic}
            style={{
              flex: 1, height: 32, borderRadius: 999,
              border: `1px solid ${
                !canDiagnostic
                  ? "rgba(255,255,255,0.05)"
                  : mode === "diagnostic"
                  ? "rgba(168,107,255,0.60)"
                  : "rgba(255,255,255,0.08)"
              }`,
              background: (mode === "diagnostic" && canDiagnostic)
                ? "rgba(168,107,255,0.10)" : "transparent",
              color: !canDiagnostic
                ? "rgba(255,255,255,0.14)"
                : mode === "diagnostic"
                ? "rgba(235,235,245,0.90)"
                : "rgba(255,255,255,0.28)",
              fontSize: 12, fontWeight: (mode === "diagnostic" && canDiagnostic) ? 600 : 400,
              cursor: canDiagnostic ? "pointer" : "default",
              opacity: canDiagnostic ? 1 : 0.45,
              transition: "all 0.15s",
            }}
          >
            Diagnostic
          </button>
        </div>
      )}

      {/* ── Composer Aura ─────────────────────────────────────────────────── */}
      <div style={{ padding: "0 16px" }}>
        <div style={{
          borderRadius: 30,
          padding: "6px 6px 6px 8px",
          background: "#1c1c20",
          border: `1px solid ${isRecording ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.07)"}`,
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          transition: "border-color 0.2s",
        }}>
          {/* + décoratif */}
          <button
            tabIndex={-1}
            style={{
              width: 42, height: 42, borderRadius: 999, flexShrink: 0,
              border: "none", background: "transparent", cursor: "default", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(233,233,245,0.40)", fontSize: 22, lineHeight: 1,
            }}
          >+</button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={isRecording ? "Je t'écoute…" : "Demander à Fowards"}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: isRecording ? "rgba(235,235,245,0.6)" : "#fff",
              fontSize: 16.5,
              lineHeight: 1.5,
              padding: "8px 2px",
              fontFamily: "inherit",
              minHeight: 24,
              maxHeight: 120,
              overflowY: "auto",
              alignSelf: "center",
            } as React.CSSProperties}
          />

          {/* Boutons droite */}
          {hasText ? (
            /* Envoyer */
            <motion.button
              whileTap={disabled ? {} : { scale: 0.88 }}
              onClick={handleSubmit}
              disabled={disabled}
              style={{
                width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                border: "none", cursor: disabled ? "default" : "pointer", padding: 0,
                background: disabled ? "rgba(168,107,255,0.3)" : GRAD,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#0c0c12",
                opacity: disabled ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h13M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
          ) : (
            <>
              {/* Micro */}
              {hasMic && (
                <motion.button
                  whileTap={disabled ? {} : { scale: 0.82 }}
                  onClick={handleMicClick}
                  type="button"
                  aria-label={isRecording ? "Arrêter l'enregistrement" : "Dicter un message"}
                  style={{
                    width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                    border: "none",
                    background: isRecording ? "rgba(239,68,68,0.18)" : "transparent",
                    color: isRecording ? "rgba(239,68,68,0.85)" : "rgba(233,233,245,0.55)",
                    cursor: disabled ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: disabled ? 0.35 : 1,
                    transition: "all 0.18s",
                  }}
                >
                  {isRecording ? (
                    <motion.div
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <MicOff size={18} />
                    </motion.div>
                  ) : (
                    <Mic size={18} />
                  )}
                </motion.button>
              )}

              {/* Waveform gradient */}
              <button
                style={{
                  width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                  border: "none", background: GRAD, cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff",
                }}
              >
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
  );
}
