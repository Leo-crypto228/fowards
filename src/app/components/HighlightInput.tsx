import { RefObject, KeyboardEvent, useEffect, useRef } from "react";

/* ─── Parse text into normal / #hashtag / @mention segments ─────────────── */
type Segment = { text: string; type: "normal" | "hash" | "mention" };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /(#\S+|@\S+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index), type: "normal" });
    }
    segments.push({
      text: match[0],
      type: match[0].startsWith("#") ? "hash" : "mention",
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), type: "normal" });
  }
  return segments;
}

type AnyInputEl = HTMLInputElement | HTMLTextAreaElement;

interface HighlightInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: RefObject<AnyInputEl>;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent<AnyInputEl>) => void;
  fontSize?: number;
  fontWeight?: number;
  caretColor?: string;
  placeholderClassName?: string;
  /** Si true, rend un <textarea> avec auto-resize (préserve les \n).
   *  Si false (défaut), rend un <input type="text"> single-line. */
  multiline?: boolean;
  /** Hauteur max en mode multiline avant scroll interne. */
  maxHeight?: number;
  /** Hauteur min en mode multiline. */
  minHeight?: number;
}

/**
 * A drop-in replacement for <input type="text"> that colors
 * #hashtags and @mentions in violet (#818cf8) as the user types.
 *
 * Technique: the real input renders with `color: transparent` (invisible text
 * but fully functional cursor/selection), while an absolutely-positioned
 * mirror <div> renders the same text with colored spans on top.
 *
 * En mode multiline=true, le composant utilise un <textarea> qui auto-resize
 * en hauteur, et le miroir utilise whiteSpace: "pre-wrap" pour faire wrapper
 * le texte sur plusieurs lignes en respectant aussi les \n volontaires.
 */
export function HighlightInput({
  value,
  onChange,
  placeholder,
  inputRef,
  onFocus,
  onBlur,
  onKeyDown,
  fontSize = 14,
  fontWeight = 400,
  caretColor = "#6366f1",
  placeholderClassName = "placeholder:text-[rgba(144,144,168,0.40)]",
  multiline = false,
  maxHeight = 140,
  minHeight = 22,
}: HighlightInputProps) {
  const segments = parseSegments(value);
  const internalRef = useRef<AnyInputEl>(null);

  // Auto-resize the textarea to fit content (multiline only).
  useEffect(() => {
    if (!multiline) return;
    const el = (inputRef?.current ?? internalRef.current) as HTMLTextAreaElement | null;
    if (!el || el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = next + "px";
  }, [value, multiline, maxHeight, minHeight, inputRef]);

  const lineHeight = 1.5;

  if (multiline) {
    return (
      <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "stretch" }}>
        {/* ── Mirror: colored text, pointer-events none ── */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            fontSize,
            fontWeight,
            lineHeight,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            overflow: "hidden",
            pointerEvents: "none",
            userSelect: "none",
            paddingTop: 6,
            paddingBottom: 6,
          }}
        >
          {segments.map((seg, i) => (
            <span
              key={i}
              style={{
                color: seg.type === "normal" ? "rgba(240,240,245,0.88)" : "#818cf8",
                fontWeight: seg.type === "normal" ? fontWeight : Math.max(fontWeight, 600),
              }}
            >
              {seg.text}
            </span>
          ))}
        </div>

        {/* ── Actual textarea: transparent text, visible caret ── */}
        <textarea
          ref={(el) => {
            internalRef.current = el;
            if (inputRef) (inputRef as { current: AnyInputEl | null }).current = el;
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown as (e: KeyboardEvent<HTMLTextAreaElement>) => void}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontSize,
            fontWeight,
            lineHeight,
            color: "transparent",
            caretColor,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            paddingTop: 6,
            paddingBottom: 6,
            minHeight,
            maxHeight,
            overflowY: "auto",
            fontFamily: "inherit",
          }}
          className={placeholderClassName}
        />
      </div>
    );
  }

  // ── Single-line mode (par défaut) ─────────────────────────────────────────
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          fontSize,
          fontWeight,
          whiteSpace: "pre",
          overflow: "hidden",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {segments.map((seg, i) => (
          <span
            key={i}
            style={{
              color: seg.type === "normal" ? "rgba(240,240,245,0.88)" : "#818cf8",
              fontWeight: seg.type === "normal" ? fontWeight : Math.max(fontWeight, 600),
            }}
          >
            {seg.text}
          </span>
        ))}
      </div>

      <input
        ref={inputRef as RefObject<HTMLInputElement> | undefined}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown as (e: KeyboardEvent<HTMLInputElement>) => void}
        placeholder={placeholder}
        style={{
          flex: 1,
          width: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize,
          fontWeight,
          color: "transparent",
          caretColor,
        }}
        className={placeholderClassName}
      />
    </div>
  );
}
