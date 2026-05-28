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
        background: "rgba(255,255,255,0.08)",
        borderRadius: 999,
        border: "0.5px solid rgba(255,255,255,0.12)",
        padding: "10px 14px",
        marginBottom: 10,
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
              : "Ton message…"
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

      {/* Mode buttons */}
      <div style={{ display: "flex", gap: 8 }}>
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
      </div>
    </div>
  );
}
