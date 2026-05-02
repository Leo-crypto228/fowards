import { RefObject, KeyboardEvent } from "react";

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

interface HighlightInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement>;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  fontSize?: number;
  fontWeight?: number;
  caretColor?: string;
  placeholderClassName?: string;
}

/**
 * A drop-in replacement for <input type="text"> that colors
 * #hashtags and @mentions in violet (#818cf8) as the user types.
 *
 * Technique: the real input renders with `color: transparent` (invisible text
 * but fully functional cursor/selection), while an absolutely-positioned
 * mirror <div> renders the same text with colored spans on top.
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
}: HighlightInputProps) {
  const segments = parseSegments(value);

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
      {/* ── Mirror: colored text, pointer-events none ── */}
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

      {/* ── Actual input: transparent text, visible caret ── */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
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
