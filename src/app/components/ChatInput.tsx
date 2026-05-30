import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { Mic, MicOff } from "lucide-react";
import type { ChatMode } from "../api/aiApi";

// ── Design tokens ──────────────────────────────────────────────────────────────
const GRAD = "linear-gradient(120deg, #a86bff 0%, #8a6bff 55%, #7287ff 100%)";

// ── Photo quota (localStorage) — 4 photos / 5 jours ──────────────────────────
const PHOTO_QUOTA_KEY = "ff_photo_quota";
const PHOTO_MAX = 4;
const PHOTO_PERIOD_MS = 5 * 24 * 60 * 60 * 1000;

function getPhotoQuota(): { count: number; since: number } {
  try {
    const raw = localStorage.getItem(PHOTO_QUOTA_KEY);
    if (!raw) return { count: 0, since: Date.now() };
    const q = JSON.parse(raw);
    if (Date.now() - q.since > PHOTO_PERIOD_MS) {
      const fresh = { count: 0, since: Date.now() };
      localStorage.setItem(PHOTO_QUOTA_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return q;
  } catch { return { count: 0, since: Date.now() }; }
}
function incrementPhotoQuota() {
  const q = getPhotoQuota();
  localStorage.setItem(PHOTO_QUOTA_KEY, JSON.stringify({ ...q, count: q.count + 1 }));
}

// ── Web Speech API ────────────────────────────────────────────────────────────
const SpeechRecognitionAPI: (new () => SpeechRecognitionInstance) | null =
  typeof window !== "undefined"
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
    : null;

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
  onPhotoToast?: (msg: string) => void;
}

export function ChatInput({ onSend, disabled = false, canDiagnostic = true, showModeButtons = true, onPhotoToast }: Props) {
  const [text, setText]               = useState("");
  const [mode, setMode]               = useState<ChatMode>("normal");
  const [isRecording, setIsRecording] = useState(false);
  const [photo, setPhoto]             = useState<string | null>(null);

  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef   = useRef("");
  const displayedRef   = useRef("");
  const fileInputRef   = useRef<HTMLInputElement>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function resizeTextarea(target?: HTMLTextAreaElement | null) {
    const ta = target ?? textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  function setTextSynced(val: string) {
    displayedRef.current = val;
    setText(val);
  }

  // ── Envoi ─────────────────────────────────────────────────────────────────────
  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
      setIsRecording(false);
      finalTextRef.current = "";
    }
    onSend(trimmed, mode);
    setTextSynced("");
    setPhoto(null);
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

  const resetRecording = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;
    finalTextRef.current = "";
    setIsRecording(false);
  }, []);

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
        } else { interim = t; }
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
    } catch { recognitionRef.current = null; }
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

  // ── Photo ─────────────────────────────────────────────────────────────────────
  function handlePlusClick() {
    if (disabled) return;
    const q = getPhotoQuota();
    if (q.count >= PHOTO_MAX) {
      const daysLeft = Math.ceil((PHOTO_PERIOD_MS - (Date.now() - q.since)) / (24 * 60 * 60 * 1000));
      const msg = `Quota photo atteint (${PHOTO_MAX} / 5 jours). Revient dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}.`;
      if (onPhotoToast) onPhotoToast(msg);
      return;
    }
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      if (onPhotoToast) onPhotoToast("Image trop lourde (max 5 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      incrementPhotoQuota();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  const hasMic  = Boolean(SpeechRecognitionAPI);
  const hasText = text.trim().length > 0;
  const canSend = hasText && !disabled;

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
              border: `1px solid ${mode === "normal" ? "rgba(168,107,255,0.55)" : "rgba(255,255,255,0.09)"}`,
              background: mode === "normal" ? "rgba(168,107,255,0.10)" : "#1c1c20",
              color: mode === "normal" ? "rgba(235,235,245,0.90)" : "rgba(255,255,255,0.40)",
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
                  ? "rgba(168,107,255,0.55)"
                  : "rgba(255,255,255,0.09)"
              }`,
              background: (mode === "diagnostic" && canDiagnostic)
                ? "rgba(168,107,255,0.10)" : "#1c1c20",
              color: !canDiagnostic
                ? "rgba(255,255,255,0.18)"
                : mode === "diagnostic"
                ? "rgba(235,235,245,0.90)"
                : "rgba(255,255,255,0.40)",
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

      {/* ── Composer ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "0 16px" }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

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
          {/* + / photo thumbnail */}
          {photo ? (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={photo}
                alt=""
                style={{ width: 42, height: 42, borderRadius: 12, objectFit: "cover", display: "block" }}
              />
              <button
                onClick={() => setPhoto(null)}
                style={{
                  position: "absolute", top: -5, right: -5,
                  width: 17, height: 17, borderRadius: "50%",
                  background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.20)",
                  color: "#fff", fontSize: 9, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  lineHeight: 1,
                }}
              >×</button>
            </div>
          ) : (
            <button
              onClick={handlePlusClick}
              tabIndex={-1}
              style={{
                width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                border: "none", background: "transparent",
                cursor: disabled ? "default" : "pointer", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(233,233,245,0.40)", fontSize: 24, lineHeight: 1,
              }}
            >+</button>
          )}

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

          {/* Send — toujours violet, flèche, s'active quand canSend */}
          <motion.button
            whileTap={canSend ? { scale: 0.88 } : {}}
            onClick={handleSubmit}
            disabled={!canSend}
            style={{
              width: 42, height: 42, borderRadius: 999, flexShrink: 0,
              border: "none",
              cursor: canSend ? "pointer" : "default", padding: 0,
              background: canSend ? GRAD : "rgba(168,107,255,0.20)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#0c0c12",
              opacity: canSend ? 1 : 0.55,
              transition: "opacity 0.15s, background 0.15s",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h13M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
