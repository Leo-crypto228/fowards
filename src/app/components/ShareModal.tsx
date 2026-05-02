import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Share2, Check, X, AlertCircle } from "lucide-react";
import { sendCommunityMessage } from "../api/sharesApi";
import { useAuth } from "../context/AuthContext";
import { useCommunityMember } from "../context/CommunityMemberContext";
import { getUserCommunities } from "../api/communityMembersApi";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { toast } from "sonner";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;

// Communautés statiques connues
const STATIC_COMMUNITIES: Record<string, string> = {
  "1": "Créateurs SaaS",
  "2": "Runners du matin",
  "3": "Écrivains constants",
  "4": "Investisseurs disciplinés",
  "5": "Minimalistes zen",
};

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postAuthor: string;
  postText: string;
  postBadge?: string;
  onShared?: () => void;
}

export function ShareModal({
  isOpen,
  onClose,
  postId,
  postAuthor,
  postText,
  postBadge,
  onShared,
}: ShareModalProps) {
  const { user } = useAuth();
  const { isMember } = useCommunityMember();

  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [loadingCommus, setLoadingCommus] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les communautés de l'utilisateur
  useEffect(() => {
    if (!isOpen || !user) return;
    setLoadingCommus(true);

    const userId = user.username || user.supabaseId || "";
    getUserCommunities(userId)
      .then(async (communityIds) => {
        // Build list from static + dynamic
        const list: { id: string; name: string }[] = [];

        // Add all known static communities first
        for (const [id, name] of Object.entries(STATIC_COMMUNITIES)) {
          if (isMember(id) || communityIds.includes(id)) {
            list.push({ id, name });
          }
        }

        // Add dynamic communities
        const dynamicIds = communityIds.filter((id) => !STATIC_COMMUNITIES[id]);
        await Promise.all(
          dynamicIds.map(async (id) => {
            try {
              const res = await fetch(`${BASE}/communities/${id}`, {
                headers: { Authorization: `Bearer ${publicAnonKey}` },
              });
              const data = await res.json();
              if (data.community?.name) {
                list.push({ id, name: data.community.name });
              }
            } catch {}
          })
        );

        setCommunities(list);
      })
      .catch(() => {
        // Fallback: show static communities the user is member of
        const list = Object.entries(STATIC_COMMUNITIES)
          .filter(([id]) => isMember(id))
          .map(([id, name]) => ({ id, name }));
        setCommunities(list);
      })
      .finally(() => setLoadingCommus(false));
  }, [isOpen, user, isMember]);

  // Find "général" channel id (first channel of first category)
  const getGeneralChannelId = async (communityId: string): Promise<string> => {
    try {
      const res = await fetch(`${BASE}/communities/${communityId}/channels`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (data.channels?.length > 0 && data.channels[0].channels?.length > 0) {
        return data.channels[0].channels[0].id;
      }
    } catch {}
    return "ch-aide"; // fallback
  };

  const handleShare = async () => {
    if (!selectedCommunity || loading) return;
    const community = communities.find((c) => c.id === selectedCommunity);
    if (!community) return;
    if (!user) { setError("Tu dois être connecté."); return; }

    setError(null);
    setLoading(true);
    try {
      // Get the first (général) channel of the community
      const channelId = await getGeneralChannelId(selectedCommunity);

      // Send as a channel post with optional message
      const res = await fetch(
        `${BASE}/communities/${selectedCommunity}/channels/${channelId}/posts`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.supabaseId,
            author: user.name,
            avatar: user.avatar || "",
            badge: postBadge || "Partage",
            text: message.trim()
              ? `${message.trim()}\n\n— Post de ${postAuthor} : « ${postText.slice(0, 80)}${postText.length > 80 ? "…" : ""} »`
              : `Post de ${postAuthor} : « ${postText.slice(0, 120)}${postText.length > 120 ? "…" : ""} »`,
            hashtags: [],
          }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Erreur serveur");

      setShared(true);
      toast.success("Post partagé !", { description: `Dans ${community.name}`, duration: 2000 });
      setTimeout(() => {
        setShared(false);
        setSelectedCommunity(null);
        setMessage("");
        onShared?.();
        onClose();
      }, 1400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("Erreur partage:", err);
      setError(msg || "Impossible de partager. Réessayez.");
      toast.error("Échec du partage", { description: msg, duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setSelectedCommunity(null);
    setMessage("");
    setShared(false);
    setError(null);
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            }}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            style={{
              position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999,
              display: "flex", flexDirection: "column",
              background: "#0a0a0a",
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              border: "0.5px solid rgba(255,255,255,0.10)", borderBottom: "none",
              boxShadow: "0 -10px 60px rgba(0,0,0,0.80)",
              maxHeight: "80vh",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 8, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.16)" }} />
            </div>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 12px", flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>
                Partager dans une communauté
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                style={{
                  background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%",
                  width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", WebkitTapHighlightColor: "transparent",
                }}
              >
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.55)" }} />
              </motion.button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 16px" }}>

              {/* Post preview */}
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.09)",
                borderRadius: 14, padding: "12px 14px", marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginBottom: 4, fontWeight: 600 }}>
                  {postAuthor} {postBadge ? `· ${postBadge}` : ""}
                </div>
                <div style={{
                  fontSize: 14, color: "rgba(255,255,255,0.70)", lineHeight: 1.55,
                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                }}>
                  {postText}
                </div>
              </div>

              {/* Community selector */}
              <div style={{
                fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.30)",
                textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 10,
              }}>
                Choisir une communauté
              </div>

              {loadingCommus ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.28)", fontSize: 13 }}>
                  Chargement…
                </div>
              ) : communities.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "20px 16px",
                  background: "rgba(255,255,255,0.03)", borderRadius: 14,
                  border: "0.5px dashed rgba(255,255,255,0.10)", marginBottom: 18,
                }}>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: "0 0 6px" }}>
                    Tu n'es membre d'aucune communauté.
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>
                    Rejoins une communauté pour partager des posts.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                  {communities.map((c) => {
                    const isSelected = selectedCommunity === c.id;
                    return (
                      <motion.button
                        key={c.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedCommunity(isSelected ? null : c.id)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 14px", borderRadius: 12,
                          border: isSelected ? "1px solid rgba(255,255,255,0.28)" : "0.5px solid rgba(255,255,255,0.08)",
                          background: isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                          cursor: "pointer", transition: "all 0.15s ease",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <span style={{
                          fontSize: 15, fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)",
                        }}>
                          {c.name}
                        </span>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              style={{
                                width: 20, height: 20, borderRadius: "50%",
                                background: "#ffffff",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              }}
                            >
                              <Check style={{ width: 11, height: 11, color: "#000" }} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Message optionnel */}
              <div style={{
                fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.30)",
                textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 10,
              }}>
                Message (optionnel)
              </div>
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.10)",
                borderRadius: 12, padding: "12px 14px", marginBottom: 24,
              }}>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ajoutez un commentaire..."
                  maxLength={280}
                  rows={3}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    outline: "none", resize: "none",
                    fontSize: 15, color: "rgba(235,235,245,0.88)",
                    caretColor: "#6366f1", lineHeight: 1.55,
                  }}
                  className="placeholder:text-[rgba(144,144,168,0.35)]"
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              flexShrink: 0,
              padding: "12px 20px",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              borderTop: "0.5px solid rgba(255,255,255,0.07)",
            }}>
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      marginBottom: 10, padding: "8px 12px", borderRadius: 10,
                      background: "rgba(239,68,68,0.10)",
                      border: "0.5px solid rgba(239,68,68,0.25)",
                    }}
                  >
                    <AlertCircle style={{ width: 13, height: 13, color: "#ef4444", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "rgba(239,68,68,0.90)" }}>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                onClick={handleShare}
                disabled={!selectedCommunity || loading || shared || communities.length === 0}
                whileTap={selectedCommunity && !loading ? { scale: 0.97 } : {}}
                style={{
                  width: "100%", padding: "15px 20px", borderRadius: 999,
                  cursor: selectedCommunity && !loading && !shared ? "pointer" : "default",
                  background: shared ? "rgba(34,197,94,0.20)" : selectedCommunity ? "#ffffff" : "rgba(255,255,255,0.10)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontSize: 15, fontWeight: 700,
                  color: shared ? "#22c55e" : selectedCommunity ? "#000000" : "rgba(255,255,255,0.30)",
                  transition: "all 0.20s ease",
                  border: shared ? "1px solid rgba(34,197,94,0.35)" : "none",
                  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                }}
              >
                <AnimatePresence mode="wait">
                  {shared ? (
                    <motion.span key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Check style={{ width: 16, height: 16 }} />
                      Partagé !
                    </motion.span>
                  ) : loading ? (
                    <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      Partage en cours...
                    </motion.span>
                  ) : (
                    <motion.span key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Share2 style={{ width: 16, height: 16 }} />
                      Partager dans le canal général
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
