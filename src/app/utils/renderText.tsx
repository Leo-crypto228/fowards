import React from "react";

/**
 * Strips a leading "@" from a handle string for display.
 * The raw handle (with @) is preserved in data/database.
 */
export function stripAt(handle: string | null | undefined): string {
  if (!handle) return "";
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

/**
 * Renders post/comment text with @mentions displayed WITHOUT the "@" symbol
 * but still rendered as clickable, styled spans that navigate to the profile.
 *
 * The original "@username" strings remain intact in the database — this is
 * purely a display transformation.
 *
 * @param text     The raw text (may contain @mentions)
 * @param navigate Optional react-router navigate function for clickable mentions
 */
export function renderPostText(
  text: string,
  navigate?: (to: string) => void
): React.ReactNode {
  if (!text) return null;

  // Split on @word boundaries, keeping the delimiter
  const parts = text.split(/(@[A-Za-z0-9_À-ÿ]+)/g);

  return parts.map((part, i) => {
    if (/^@[A-Za-z0-9_À-ÿ]+$/.test(part)) {
      const username = part.slice(1); // strip the @
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
            color: "#a5b4fc",
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
