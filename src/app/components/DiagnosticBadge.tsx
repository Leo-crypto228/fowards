interface Props {
  mode: "normal" | "diagnostic";
}

export function DiagnosticBadge({ mode }: Props) {
  if (mode !== "diagnostic") return null;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 999,
      background: "rgba(167,139,250,0.15)",
      color: "#a78bfa",
      border: "0.5px solid rgba(167,139,250,0.35)",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    }}>
      📊 Diagnostic
    </span>
  );
}
