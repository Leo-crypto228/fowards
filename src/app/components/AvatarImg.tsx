/**
 * AvatarImg — Image d'avatar avec fallback initiale colorée.
 * Remplace tous les <img src={avatar}> pour les avatars utilisateur.
 */
import { useState, useEffect, type CSSProperties } from "react";

interface AvatarImgProps {
  src?: string | null;
  name?: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

/** Palette déterministe basée sur le premier caractère du nom */
function fallbackColor(name: string): string {
  const palette = [
    "#1e1b4b", "#0f172a", "#14291a",
    "#1a1429", "#1a2740", "#2d1b4e",
    "#3b2a1a", "#0d2137",
  ];
  return palette[(name?.charCodeAt(0) ?? 0) % palette.length];
}

export function AvatarImg({ src, name = "", size = 40, style, className }: AvatarImgProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const bg = fallbackColor(name);

  // Reset si la src change
  useEffect(() => { setFailed(false); }, [src]);

  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "block",
    ...style,
  };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={className}
        style={{ objectFit: "cover", ...base }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        ...base,
        background: bg,
        border: "1.5px solid rgba(255,255,255,0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{
        fontSize: Math.round(size * 0.40),
        fontWeight: 700,
        color: "rgba(255,255,255,0.78)",
        lineHeight: 1,
        userSelect: "none",
      }}>
        {initial}
      </span>
    </div>
  );
}
