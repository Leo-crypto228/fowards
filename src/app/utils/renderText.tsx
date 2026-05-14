import React from "react";

export function stripAt(handle: string | null | undefined): string {
  if (!handle) return "";
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

/** Extrait les hashtags d'un texte brut (pour les afficher en bas en pills). */
export function extractHashtagsFromText(text: string): string[] {
  if (!text) return [];
  return [...new Set(text.match(/#[\wÀ-ÿ]+/g) || [])];
}

/**
 * Rend le texte d'un post/commentaire :
 * - Les #hashtags sont supprimés du texte (affichés séparément en bas).
 * - Les @mentions sont cliquables et colorées en violet #818cf8.
 */
export function renderPostText(
  text: string,
  navigate?: (to: string) => void
): React.ReactNode {
  if (!text) return null;

  // Supprimer les hashtags du texte affiché (ils sont montrés en bas)
  const stripped = text
    .replace(/\s*#[\wÀ-ÿ]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (!stripped) return null;

  const parts = stripped.split(/(@[A-Za-z0-9_À-ÿ]+)/g);

  return parts.map((part, i) => {
    if (/^@[A-Za-z0-9_À-ÿ]+$/.test(part)) {
      const username = part.slice(1);
      return (
        <span
          key={i}
          onClick={
            navigate
              ? (e) => {
                  e.stopPropagation();
                  navigate(`/profile/${username.toLowerCase()}`);
                }
              : undefined
          }
          style={{
            color: "#818cf8",
            fontWeight: 600,
            cursor: navigate ? "pointer" : "inherit",
          }}
        >
          {username}
        </span>
      );
    }
    return part;
  });
}
