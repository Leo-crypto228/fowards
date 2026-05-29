import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { Mic, MicOff } from "lucide-react";
import type { ChatMode } from "../api/aiApi";

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
      setTextSynced(displayed); // met aussi displayedRef à jour
      resizeTextarea();
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech") console.warn("[Mic] erreur:", e.error);
      // Préserver ce qui était affiché (final ou intermédiaire)
      const toPreserve = finalTextRef.current || displayedRef.current;
      resetRecording();
      setTextSynced(toPreserve);
    };

    rec.onend = () => {
      // Préserver ce qui était affiché — finalTextRef OU displayedRef (résultats intermédiaires)
      const toPreserve = finalTextRef.current || displayedRef.current;
      resetRecording();
      setTextSynced(toPreserve);
      resizeTextarea();
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsRecording(true);
      // Timeout de sécurité : si rien ne se passe dans 10s, on annule
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
      // Préserver ce qui était affiché avant le reset
      const toPreserve = finalTextRef.current || displayedRef.current;
      resetRecording();
      // Toujours re-setter pour forcer le re-render avec le bon texte
      setTextSynced(toPreserve);
      resizeTextarea();
    } else {
      startRecording();
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  const hasMic = Boolean(SpeechRecognitionAPI);

  return (
    <div style={{
      padding: "12px 16px",
      borderTop: "0.5px solid rgba(255,255,255,0.08)",
      background: "#000",
      paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
    }}>

      {/* ── Input row ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        background: "rgba(255,255,255,0.08)",
        borderRadius: 999,
        border: `0.5px solid ${isRecording ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.12)"}`,
        padding: "10px 14px",
        marginBottom: showModeButtons ? 10 : 0,
        transition: "border-color 0.2s",
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={isRecording ? "Je t'écoute…" : "Entame la conversation…"}
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            color: "rgba(235,235,245,0.92)",
            fontSize: 15,
            lineHeight: 1.5,
            padding: 0,
            fontFamily: "inherit",
            minHeight: 24,
            maxHeight: 120,
            overflowY: "auto",
          } as React.CSSProperties}
        />

        {/* Bouton micro — uniquement si l'API est dispo dans ce navigateur */}
        {hasMic && (
          <motion.button
            whileTap={disabled ? {} : { scale: 0.82 }}
            onClick={handleMicClick}
            type="button"
            aria-label={isRecording ? "Arrêter l'enregistrement" : "Dicter un message"}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              background: isRecording ? "rgba(239,68,68,0.18)" : "transparent",
              color: isRecording ? "rgba(239,68,68,0.85)" : "rgba(255,255,255,0.32)",
              cursor: disabled ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
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
                <MicOff size={15} />
              </motion.div>
            ) : (
              <Mic size={15} />
            )}
          </motion.button>
        )}

        {/* Bouton envoyer */}
        <motion.button
          whileTap={!text.trim() || disabled ? {} : { scale: 0.88 }}
          onClick={handleSubmit}
          disabled={!text.trim() || disabled}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: "#7C3AED",
            color: "#fff",
            fontSize: !text.trim() || disabled ? 13 : 15,
            cursor: !text.trim() || disabled ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontWeight: 700,
            letterSpacing: !text.trim() || disabled ? "0.05em" : 0,
            opacity: !text.trim() || disabled ? 0.45 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {!text.trim() || disabled ? "···" : "↑"}
        </motion.button>
      </div>

      {/* ── Boutons de mode ───────────────────────────────────────────────── */}
      {showModeButtons && <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setMode("normal")}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 999,
            border: `1px solid ${mode === "normal" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)"}`,
            background: mode === "normal" ? "rgba(255,255,255,0.12)" : "transparent",
            color: mode === "normal" ? "rgba(235,235,245,0.88)" : "rgba(255,255,255,0.3)",
            fontSize: 13,
            fontWeight: mode === "normal" ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Discussion normale
        </button>
        <button
          onClick={() => { if (canDiagnostic) setMode("diagnostic"); }}
          disabled={!canDiagnostic}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 999,
            border: `1px solid ${!canDiagnostic ? "rgba(255,255,255,0.08)" : mode === "diagnostic" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)"}`,
            background: !canDiagnostic ? "transparent" : mode === "diagnostic" ? "rgba(255,255,255,0.12)" : "transparent",
            color: !canDiagnostic ? "rgba(255,255,255,0.18)" : mode === "diagnostic" ? "rgba(235,235,245,0.88)" : "rgba(255,255,255,0.3)",
            fontSize: 13,
            fontWeight: mode === "diagnostic" && canDiagnostic ? 600 : 400,
            cursor: canDiagnostic ? "pointer" : "default",
            transition: "all 0.15s",
            opacity: canDiagnostic ? 1 : 0.4,
          }}
        >
          Diagnostic
        </button>
      </div>}

    </div>
  );
}
