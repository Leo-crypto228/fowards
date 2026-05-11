import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Search, X, Loader2, TrendingUp } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;

interface GifItem {
  id: string;
  title: string;
  url: string;
  preview: string;
  original: string;
}

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
  /** conservé pour compatibilité, ignoré — le picker est toujours un bottom sheet */
  anchor?: "bottom" | "center";
}

function parseGiphy(data: Record<string, unknown>[]): GifItem[] {
  return data.map((g: Record<string, unknown>) => {
    const images = g.images as Record<string, Record<string, string>>;
    return {
      id: g.id as string,
      title: (g.title as string) || "",
      url:      images?.fixed_height?.webp  || images?.fixed_height?.url  || "",
      preview:  images?.preview_gif?.url    || images?.fixed_height_small?.url || "",
      original: images?.original?.url       || images?.fixed_height?.url  || "",
    };
  });
}

// ── GifTile ────────────────────────────────────────────────────────────────────
function GifTile({ gif, onSelect }: { gif: GifItem; onSelect: (g: GifItem) => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={() => onSelect(gif)}
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(255,255,255,0.05)",
        border: "0.5px solid rgba(255,255,255,0.07)",
        cursor: "pointer",
        padding: 0,
        display: "block",
        width: "100%",
      }}
    >
      {!loaded && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(110deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
          backgroundSize: "200% 100%",
          animation: "gifShimmer 1.4s infinite",
          borderRadius: 10,
        }} />
      )}
      <img
        src={gif.url || gif.preview}
        alt={gif.title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%", height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.2s",
          display: "block",
        }}
      />
    </motion.button>
  );
}

// ── GifPicker — Bottom Sheet ───────────────────────────────────────────────────
export function GifPicker({ isOpen, onClose, onSelect }: GifPickerProps) {
  const [query, setQuery]           = useState("");
  const [gifs, setGifs]             = useState<GifItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [debouncedQ, setDebouncedQ] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQ(query), 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(
        `${BASE}/giphy/search?q=${encodeURIComponent(q)}&limit=24`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGifs(parseGiphy(data.data ?? []));
    } catch (e) {
      console.error("Erreur GIF picker:", e);
      setError("Impossible de charger les GIFs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchGifs(debouncedQ);
  }, [isOpen, debouncedQ, fetchGifs]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 220);
    } else {
      setQuery(""); setGifs([]); setError(null);
    }
  }, [isOpen]);

  const handleSelect = (gif: GifItem) => {
    const url = gif.url || gif.original;
    onSelect(url);
    onClose();
  };

  const content = (
    <>
      {/* Keyframes shimmer */}
      <style>{`
        @keyframes gifShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>

      
        {isOpen && (
          <>
            {/* ── Backdrop ── */}
            <motion.div
              key="gif-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              style={{
                position: "fixed", inset: 0,
                zIndex: 9998,
                background: "rgba(0,0,0,0.72)",
                WebkitTapHighlightColor: "transparent",
              }}
            />

            {/* ── Bottom Sheet ── */}
            <motion.div
              key="gif-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
              style={{
                position: "fixed",
                bottom: 0, left: 0, right: 0,
                zIndex: 9999,
                height: "54vh",
                minHeight: 320,
                background: "rgba(8,8,14,0.98)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                border: "0.5px solid rgba(255,255,255,0.09)",
                borderBottom: "none",
                boxShadow: "0 -12px 60px rgba(0,0,0,0.70), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Drag handle */}
              <div style={{
                display: "flex", justifyContent: "center",
                paddingTop: 10, paddingBottom: 4, flexShrink: 0,
              }}>
                <div style={{
                  width: 38, height: 4, borderRadius: 99,
                  background: "rgba(255,255,255,0.16)",
                }} />
              </div>

              {/* Header — barre de recherche */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px 10px",
                borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                flexShrink: 0,
              }}>
                {/* Search */}
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "0.5px solid rgba(255,255,255,0.10)",
                  borderRadius: 14, padding: "9px 12px",
                }}>
                  <Search style={{ width: 14, height: 14, color: "rgba(255,255,255,0.28)", flexShrink: 0 }} />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un GIF…"
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      fontSize: 14, color: "rgba(255,255,255,0.88)",
                      caretColor: "#6366f1",
                    }}
                  />
                  {query && (
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setQuery("")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                    >
                      <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.30)" }} />
                    </motion.button>
                  )}
                </div>

                {/* Fermer */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "rgba(255,255,255,0.07)",
                    border: "0.5px solid rgba(255,255,255,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.50)" }} />
                </motion.button>
              </div>

              {/* Label tendances */}
              {!query && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px 4px", flexShrink: 0,
                }}>
                  <TrendingUp style={{ width: 12, height: 12, color: "rgba(99,102,241,0.65)" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(99,102,241,0.65)", letterSpacing: "0.04em" }}>
                    TENDANCES
                  </span>
                </div>
              )}
              {query && !loading && gifs.length > 0 && (
                <div style={{ padding: "6px 14px 2px", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)" }}>
                    {gifs.length} résultat{gifs.length > 1 ? "s" : ""} pour « {query} »
                  </span>
                </div>
              )}

              {/* Grille */}
              <div style={{
                flex: 1, overflowY: "auto", overscrollBehavior: "contain",
                padding: "4px 10px 16px",
                scrollbarWidth: "none",
              }}>
                {loading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 10 }}>
                    <Loader2 style={{ width: 18, height: 18, color: "#6366f1" }} className="animate-spin" />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.30)" }}>Chargement…</span>
                  </div>
                ) : error ? (
                  <div style={{ textAlign: "center", paddingTop: 32 }}>
                    <p style={{ fontSize: 13, color: "rgba(255,99,99,0.70)", margin: "0 0 10px" }}>{error}</p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => fetchGifs(query)}
                      style={{
                        padding: "6px 16px", borderRadius: 999,
                        background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)",
                        fontSize: 12, color: "rgba(255,255,255,0.55)", cursor: "pointer",
                      }}
                    >
                      Réessayer
                    </motion.button>
                  </div>
                ) : gifs.length === 0 ? (
                  <div style={{ textAlign: "center", paddingTop: 36 }}>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0 }}>
                      Aucun GIF pour « {query} »
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 6,
                  }}>
                    {gifs.map((gif) => (
                      <GifTile key={gif.id} gif={gif} onSelect={handleSelect} />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer GIPHY */}
              <div style={{
                padding: "6px 14px 10px",
                borderTop: "0.5px solid rgba(255,255,255,0.05)",
                flexShrink: 0,
                display: "flex", justifyContent: "center", alignItems: "center",
              }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}>
                  Powered by GIPHY
                </span>
              </div>
            </motion.div>
          </>
        )}
      
    </>
  );

  return createPortal(content, document.body);
}

// ── isGifUrl ───────────────────────────────────────────────────────────────────
export function isGifUrl(content: string): boolean {
  const trimmed = content.trim();
  return (
    (trimmed.includes("media.giphy.com") || trimmed.includes("giphy.com")) &&
    !trimmed.includes(" ") &&
    trimmed.length < 600
  );
}

// ── GifMessage — rendu dans les fils ──────────────────────────────────────────
export function GifMessage({ url }: { url: string; caption?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ display: "inline-block", maxWidth: "100%" }}>
      <div style={{
        position: "relative",
        maxWidth: 260,
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: "0.5px solid rgba(255,255,255,0.08)",
      }}>
        {!loaded && (
          <div style={{ width: 200, height: 140, background: "rgba(255,255,255,0.05)" }} />
        )}
        <img
          src={url}
          alt="GIF"
          onLoad={() => setLoaded(true)}
          style={{
            display: "block", maxWidth: "100%",
            height: "auto",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.2s",
          }}
        />
        <div style={{
          position: "absolute", bottom: 6, left: 6,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
          borderRadius: 4, padding: "2px 5px",
        }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.70)", letterSpacing: "0.05em" }}>
            GIF
          </span>
        </div>
      </div>
    </div>
  );
}
