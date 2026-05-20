/**
 * GradeBadge — Affiche " · Niveau X" ou " · Top Voice" à côté d'un pseudo.
 *
 * Style : blanc, non gras, petite taille, discret.
 * "Top Voice" utilise translate="no" pour empêcher les traductions auto.
 *
 * Usage :
 *   <GradeBadge grade={grade} />
 *   → rend  " · Niveau 2"  ou  " · Top Voice"
 *
 * Retourne null si grade est vide / invalide → dégradation propre.
 */

interface GradeBadgeProps {
  grade?: string | null;
  /** Taille de police en px. Défaut: 12 */
  fontSize?: number;
  style?: React.CSSProperties;
}

export function GradeBadge({ grade, fontSize = 12, style }: GradeBadgeProps) {
  if (!grade) return null;

  const baseStyle: React.CSSProperties = {
    fontSize,
    fontWeight: 400,
    color: "rgba(255,255,255,0.55)",
    whiteSpace: "nowrap",
    flexShrink: 0,
    ...style,
  };

  const gradeNode =
    grade === "Top Voice" ? (
      <span translate="no">Top Voice</span>
    ) : (
      grade
    );

  return (
    <span style={baseStyle}>
      {" · "}
      {gradeNode}
    </span>
  );
}
