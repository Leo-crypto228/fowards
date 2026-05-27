import { useState, useRef } from "react";
import { motion } from "motion/react";
import type { ChatMode } from "../api/aiApi";

interface Props {
  onSend: (message: string, mode: ChatMode) => void;
  disabled?: boolean;
  canDiagnostic?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, canDiagnostic = true, placeholder }: Props) {
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
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  return (
    <div style={{
      padding: "12px 16px",
      borderTop: "0.5px solid rgba(255,255,255,0.08)",
      background: "#000",
      paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
    }}>
      {/* Input row */}
      <div style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        background: "rgba(255,255,255,0.06)",
        borderRadius: 14,
        border: "0.5px solid rgba(255,255,255,0.10)",
        padding: "8px 12px",
        marginBottom: 10,
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder ?? (mode === "diagnostic" ? "Demande un diagnostic complet…" : "Ton message…")}
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
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            background: !text.trim() || disabled ? "rgba(255,255,255,0.08)" : "#fff",
            color: !text.trim() || disabled ? "rgba(255,255,255,0.3)" : "#000",
            fontSize: 16,
            cursor: !text.trim() || disabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s",
            fontWeight: 700,
          }}
        >
          ↑
        </motion.button>
      </div>

      {/* Mode buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setMode("normal")}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 8,
            border: `1px solid ${mode === "normal" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)"}`,
            background: mode === "normal" ? "rgba(255,255,255,0.10)" : "transparent",
            color: mode === "normal" ? "#fff" : "rgba(255,255,255,0.45)",
            fontSize: 13,
            fontWeight: mode === "normal" ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Discussion normale
        </button>
        <button
          onClick={() => setMode("diagnostic")}
          disabled={!canDiagnostic}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 8,
            border: `1px solid ${mode === "diagnostic" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)"}`,
            background: mode === "diagnostic" ? "rgba(255,255,255,0.10)" : "transparent",
            color: !canDiagnostic
              ? "rgba(255,255,255,0.2)"
              : mode === "diagnostic"
              ? "#fff"
              : "rgba(255,255,255,0.45)",
            fontSize: 13,
            fontWeight: mode === "diagnostic" ? 600 : 400,
            cursor: canDiagnostic ? "pointer" : "not-allowed",
            transition: "all 0.15s",
            opacity: canDiagnostic ? 1 : 0.5,
          }}
        >
          Diagnostic
        </button>
      </div>
    </div>
  );
}
