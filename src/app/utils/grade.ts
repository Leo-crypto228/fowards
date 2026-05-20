/**
 * grade.ts — Utilitaire de calcul et affichage des grades Impact
 *
 * Échelle :
 *   0–29    → Membre
 *   30–99   → Niveau 1
 *   100–299 → Niveau 2
 *   300–799 → Niveau 3
 *   800+    → Top Voice
 */

export type Grade = "Membre" | "Niveau 1" | "Niveau 2" | "Niveau 3" | "Top Voice";

export function getGrade(score: number | null | undefined): Grade {
  const s = typeof score === "number" && isFinite(score) ? score : 0;
  if (s >= 800) return "Top Voice";
  if (s >= 300) return "Niveau 3";
  if (s >= 100) return "Niveau 2";
  if (s >= 30)  return "Niveau 1";
  return "Membre";
}
