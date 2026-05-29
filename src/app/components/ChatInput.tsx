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
  const finalTextRef     = useRef(""); // texte confirmé (non-intermédiaire)

  // ── Nettoyage si le composant est démonté pendant un enregistrement ──────────
  useEffect(() => {
    return () => { recognitionRef.current?.abort(); };
  }, []);

  // ── Resize textarea helper ────────────────────────────────────────────────────
  function resizeTextarea(target?: HTMLTextAreaElement | null) {
    const ta = target ?? textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
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
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    // Si l'user édite manuellement pendant un enregistrement, on garde le texte édité
    finalTextRef.current = e.target.value;
    setText(e.target.value);
    resizeTextarea(e.target);
  }

  // ── Microphone ────────────────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    if (!SpeechRecognitionAPI || disabled) return;

    // On part du texte déjà saisi comme base
    finalTextRef.current = text;

    const rec = new SpeechRecognitionAPI();
    rec.lang             = "fr-FR";
    rec.continuous       = false;   // s'arrête automatiquement après silence
    rec.interimResults   = true;    // affiche les mots en temps réel
    rec.maxAlternatives  = 1;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          // Ajouter un espace entre le texte existant et la nouvelle phrase
          const base = finalTextRef.current;
          finalTextRef.current = base
            ? base.trimEnd() + " " + t
            : t;
        } else {
          interim = t;
        }
      }
      // Afficher : texte final + résultat intermédiaire
      const displayed = finalTextRef.current
        ? (interim
          ? finalTextRef.current.trimEnd() + " " + interim
          : finalTextRef.current)
        : interim;
      setText(displayed);
      resizeTextarea();
    };

    rec.onerror = (e) => {
      // "no-speech" n'est pas une vraie erreur — l'user n'a juste rien dit
      if (e.error !== "no-speech") {
        console.warn("[Mic] erreur recognition:", e.error);
      }
      recognitionRef.current = null;
      setIsRecording(false);
      finalTextRef.current = "";
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setIsRecording(false);
      // S'assurer que le texte affiché = texte final (sans partie intermédiaire fantôme)
      setText(finalTextRef.current);
      finalTextRef.current = "";
      resizeTextarea();
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsRecording(true);
    } catch {
      // Déjà en cours dans un autre onglet, etc.
      recognitionRef.current = null;
    }
  }, [text, disabled]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop(); // déclenche onend → reset propre
  }, []);

  function handleMicClick() {
    if (disabled) return;
    if (isRecording) stopRecording();
    else startRecording();
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
