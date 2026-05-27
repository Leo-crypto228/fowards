import { useState, useRef } from "react";
import { motion } from "motion/react";
import type { ChatMode } from "../api/aiApi";

interface Props {
  onSend: (message: string, mode: ChatMode) => void;
  disabled?: boolean;
  canDiagnostic?: boolean;
}

export function ChatInput({ onSend, disabled = false, canDiagnostic = true }: Props) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ChatMode>("normal");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, mode);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    // Auto-grow textarea
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  return (
    <div style={{
      padding: "12px 16px",
      borderTop: "0.5px solid rgba(255,255,255,0.10)",
      background: "#050510",
      paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
    }}>
      {/* Mode selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => setMode("normal")}
          style={{
            flex: 1,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${mode === "normal" ? "#6366f1" : "rgba(255,255,255,0.12)"}`,
            background: mode === "normal" ? "rgba(99,102,241,0.15)" : "transparent",
            color: mode === "normal" ? "#a5b4fc" : "rgba(235,235,245,0.5)",
            fontSize: 12,
            fontWeight: mode === "normal" ? 700 : 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          💬 Discussion
        </button>
        <button
          onClick={() => setMode("diagnostic")}
          disabled={!canDiagnostic}
          style={{
            flex: 1,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${mode === "diagnostic" ? "#7c3aed" : "rgba(255,255,255,0.12)"}`,
            background: mode === "diagnostic" ? "rgba(124,58,237,0.15)" : "transparent",
            color: !canDiagnostic
              ? "rgba(235,235,245,0.25)"
              : mode === "diagnostic"
              ? "#c4b5fd"
              : "rgba(235,235,245,0.5)",
            fontSize: 12,
            fontWeight: mode === "diagnostic" ? 700 : 500,
            cursor: canDiagnostic ? "pointer" : "not-allowed",
            transition: "all 0.15s",
            opacity: canDiagnostic ? 1 : 0.5,
          }}
        >
          📊 Diagnostic
        </button>
      </div>

      {/* Input row */}
      <div style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        background: "rgba(255,255,255,0.05)",
        borderRadius: 16,
        border: "0.5px solid rgba(255,255,255,0.12)",
        padding: "8px 12px",
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            mode === "diagnostic"
              ? "Demande un diagnostic complet…"
              : "Écris ton message…"
          }
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
          }}
        />
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handleSubmit}
          disabled={!text.trim() || disabled}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: !text.trim() || disabled
              ? "rgba(255,255,255,0.08)"
              : mode === "diagnostic"
              ? "#7c3aed"
              : "#4f46e5",
            color: "#fff",
            fontSize: 16,
            cursor: !text.trim() || disabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          ↑
        </motion.button>
      </div>
    </div>
  );
}
