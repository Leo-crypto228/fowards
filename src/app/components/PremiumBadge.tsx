import React from "react";

interface PremiumBadgeProps {
  size?: "sm" | "md";
}

export function PremiumBadge({ size = "md" }: PremiumBadgeProps) {
  const styles: React.CSSProperties = {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    color: "white",
    fontWeight: 700,
    borderRadius: 999,
    letterSpacing: 0.3,
    display: "inline-flex",
    alignItems: "center",
    fontSize: size === "sm" ? 9 : 11,
    padding: size === "sm" ? "1px 5px" : "2px 8px",
  };

  return <span style={styles}>{"⭐ Premium"}</span>;
}
